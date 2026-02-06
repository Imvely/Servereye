"""사용자 관리 API 라우터"""
from fastapi import APIRouter, HTTPException, Query
from passlib.hash import bcrypt
from sqlalchemy import text
from backend.db.database import async_session
from backend.db.schemas import CreateUserRequest, UpdateUserRequest, MessageResponse

router = APIRouter(prefix="/api/v1/users", tags=["users"])


@router.get("")
async def list_users(
    role: str = None,
    is_active: int = Query(None, description="0=비활성, 1=활성"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200)
):
    """사용자 목록 조회"""
    try:
        conditions = []
        params = {}

        if role:
            conditions.append("role=:role")
            params["role"] = role
        if is_active is not None:
            conditions.append("is_active=:is_active")
            params["is_active"] = is_active

        where = " AND ".join(conditions) if conditions else "1=1"
        offset = (page - 1) * size
        params["limit"] = size
        params["offset"] = offset

        async with async_session() as session:
            count_result = await session.execute(
                text(f"SELECT COUNT(*) FROM users WHERE {where}"), params
            )
            total = count_result.scalar()

            result = await session.execute(
                text(f"""SELECT user_id, username, display_name, role,
                    is_active, last_login, created_at
                    FROM users
                    WHERE {where}
                    ORDER BY created_at
                    LIMIT :limit OFFSET :offset"""),
                params
            )
            rows = result.fetchall()

        users = []
        for r in rows:
            users.append({
                "user_id": r[0],
                "username": r[1],
                "display_name": r[2],
                "role": r[3],
                "is_active": bool(r[4]),
                "last_login": r[5],
                "created_at": r[6]
            })

        return {"items": users, "total": total, "page": page, "size": size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"사용자 목록 조회 실패: {str(e)}")


@router.get("/{user_id}")
async def get_user(user_id: int):
    """사용자 상세 조회"""
    try:
        async with async_session() as session:
            result = await session.execute(
                text("""SELECT user_id, username, display_name, role,
                    is_active, preferences, last_login, created_at
                    FROM users WHERE user_id=:uid"""),
                {"uid": user_id}
            )
            r = result.fetchone()

        if not r:
            raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

        return {
            "user_id": r[0],
            "username": r[1],
            "display_name": r[2],
            "role": r[3],
            "is_active": bool(r[4]),
            "preferences": r[5],
            "last_login": r[6],
            "created_at": r[7]
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"사용자 조회 실패: {str(e)}")


@router.post("")
async def create_user(request: CreateUserRequest):
    """사용자 생성"""
    try:
        valid_roles = ("admin", "operator", "viewer")
        if request.role not in valid_roles:
            raise HTTPException(
                status_code=400,
                detail=f"role은 {', '.join(valid_roles)} 중 하나여야 합니다"
            )

        async with async_session() as session:
            # 사용자명 중복 체크
            existing = await session.execute(
                text("SELECT user_id FROM users WHERE username=:u"),
                {"u": request.username}
            )
            if existing.fetchone():
                raise HTTPException(status_code=400, detail="이미 존재하는 사용자명입니다")

            password_hash = bcrypt.hash(request.password)

            await session.execute(
                text("""INSERT INTO users
                    (username, password_hash, display_name, role)
                    VALUES (:u, :ph, :dn, :r)"""),
                {
                    "u": request.username,
                    "ph": password_hash,
                    "dn": request.display_name or request.username,
                    "r": request.role
                }
            )
            await session.commit()
            result = await session.execute(text("SELECT last_insert_rowid()"))
            user_id = result.scalar()

        return await get_user(user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"사용자 생성 실패: {str(e)}")


@router.put("/{user_id}")
async def update_user(user_id: int, request: UpdateUserRequest):
    """사용자 수정"""
    try:
        updates = {}
        if request.display_name is not None:
            updates["display_name"] = request.display_name
        if request.password is not None:
            if len(request.password) < 4:
                raise HTTPException(status_code=400, detail="비밀번호는 4자 이상이어야 합니다")
            updates["password_hash"] = bcrypt.hash(request.password)
        if request.role is not None:
            valid_roles = ("admin", "operator", "viewer")
            if request.role not in valid_roles:
                raise HTTPException(
                    status_code=400,
                    detail=f"role은 {', '.join(valid_roles)} 중 하나여야 합니다"
                )
            updates["role"] = request.role
        if request.is_active is not None:
            updates["is_active"] = 1 if request.is_active else 0

        if not updates:
            raise HTTPException(status_code=400, detail="변경할 항목이 없습니다")

        async with async_session() as session:
            # 사용자 존재 여부 확인
            existing = await session.execute(
                text("SELECT user_id, username FROM users WHERE user_id=:uid"),
                {"uid": user_id}
            )
            row = existing.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

            # admin 계정 비활성화 방지
            if row[1] == "admin" and "is_active" in updates and updates["is_active"] == 0:
                raise HTTPException(status_code=400, detail="기본 관리자 계정은 비활성화할 수 없습니다")

            set_clause = ", ".join(f"{k}=:{k}" for k in updates)
            updates["uid"] = user_id

            await session.execute(
                text(f"UPDATE users SET {set_clause} WHERE user_id=:uid"),
                updates
            )
            await session.commit()

        return await get_user(user_id)
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"사용자 수정 실패: {str(e)}")


@router.delete("/{user_id}", response_model=MessageResponse)
async def delete_user(user_id: int):
    """사용자 비활성화 (소프트 삭제)"""
    try:
        async with async_session() as session:
            result = await session.execute(
                text("SELECT user_id, username FROM users WHERE user_id=:uid"),
                {"uid": user_id}
            )
            row = result.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="사용자를 찾을 수 없습니다")

            # admin 계정 삭제 방지
            if row[1] == "admin":
                raise HTTPException(status_code=400, detail="기본 관리자 계정은 삭제할 수 없습니다")

            await session.execute(
                text("UPDATE users SET is_active=0 WHERE user_id=:uid"),
                {"uid": user_id}
            )
            await session.commit()

        return MessageResponse(message="사용자가 비활성화되었습니다")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"사용자 삭제 실패: {str(e)}")
