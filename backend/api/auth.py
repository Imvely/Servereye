"""인증 API 라우터"""
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.hash import bcrypt
from sqlalchemy import text
from backend.config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_MINUTES
from backend.db.database import async_session, get_db, AsyncSession
from backend.db.schemas import LoginRequest, TokenResponse, UserInfo

router = APIRouter(prefix="/api/v1/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login", auto_error=False)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(token: str = Depends(oauth2_scheme)) -> dict:
    if not token:
        raise HTTPException(status_code=401, detail="인증이 필요합니다")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="유효하지 않은 토큰")
    except JWTError:
        raise HTTPException(status_code=401, detail="유효하지 않은 토큰")

    async with async_session() as session:
        result = await session.execute(
            text("SELECT user_id, username, display_name, role, is_active FROM users WHERE username=:u"),
            {"u": username}
        )
        user = result.fetchone()
        if not user or not user[4]:
            raise HTTPException(status_code=401, detail="비활성화된 계정")
        return {
            "user_id": user[0],
            "username": user[1],
            "display_name": user[2],
            "role": user[3]
        }


async def get_optional_user(token: str = Depends(oauth2_scheme)):
    """선택적 인증 (비로그인도 허용)"""
    if not token:
        return None
    try:
        return await get_current_user(token)
    except HTTPException:
        return None


@router.post("/login", response_model=TokenResponse)
async def login(request: LoginRequest):
    async with async_session() as session:
        result = await session.execute(
            text("SELECT user_id, username, password_hash, display_name, role, is_active FROM users WHERE username=:u"),
            {"u": request.username}
        )
        user = result.fetchone()

    if not user:
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")
    if not user[5]:
        raise HTTPException(status_code=401, detail="비활성화된 계정입니다")
    if not bcrypt.verify(request.password, user[2]):
        raise HTTPException(status_code=401, detail="아이디 또는 비밀번호가 올바르지 않습니다")

    # 마지막 로그인 시간 업데이트
    async with async_session() as session:
        await session.execute(
            text("UPDATE users SET last_login=datetime('now','localtime') WHERE user_id=:uid"),
            {"uid": user[0]}
        )
        await session.commit()

    token = create_access_token({"sub": user[1]})
    return TokenResponse(access_token=token)


@router.post("/logout")
async def logout():
    return {"message": "로그아웃 완료"}


@router.get("/me", response_model=UserInfo)
async def get_me(current_user: dict = Depends(get_current_user)):
    return UserInfo(**current_user)
