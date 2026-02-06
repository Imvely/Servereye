"""설정 API 라우터"""
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from backend.db.database import async_session
from backend.db.schemas import SettingsUpdateRequest, WebhookTestRequest, MessageResponse
from backend.core.notifier import notifier

router = APIRouter(prefix="/api/v1/settings", tags=["settings"])


@router.get("")
async def get_settings(category: str = None):
    """설정 목록 조회"""
    try:
        conditions = []
        params = {}

        if category:
            conditions.append("category=:category")
            params["category"] = category

        where = " AND ".join(conditions) if conditions else "1=1"

        async with async_session() as session:
            result = await session.execute(
                text(f"""SELECT key, value, label, category, value_type, description, updated_at
                     FROM app_settings
                     WHERE {where}
                     ORDER BY category, key"""),
                params
            )
            rows = result.fetchall()

        settings = []
        for r in rows:
            settings.append({
                "key": r[0],
                "value": r[1],
                "label": r[2],
                "category": r[3],
                "value_type": r[4],
                "description": r[5],
                "updated_at": r[6]
            })

        # 카테고리별 그룹핑
        grouped = {}
        for s in settings:
            cat = s["category"] or "general"
            if cat not in grouped:
                grouped[cat] = []
            grouped[cat].append(s)

        return {"settings": settings, "grouped": grouped}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"설정 조회 실패: {str(e)}")


@router.put("", response_model=MessageResponse)
async def update_settings(request: SettingsUpdateRequest):
    """설정 일괄 업데이트"""
    try:
        if not request.settings:
            raise HTTPException(status_code=400, detail="변경할 설정이 없습니다")

        updated_count = 0
        async with async_session() as session:
            for key, value in request.settings.items():
                # 설정 키 존재 여부 확인
                existing = await session.execute(
                    text("SELECT key FROM app_settings WHERE key=:k"),
                    {"k": key}
                )
                if not existing.fetchone():
                    raise HTTPException(status_code=400, detail=f"존재하지 않는 설정 키: {key}")

                await session.execute(
                    text("""UPDATE app_settings
                         SET value=:v, updated_at=datetime('now','localtime')
                         WHERE key=:k"""),
                    {"k": key, "v": value}
                )
                updated_count += 1

            await session.commit()

        return MessageResponse(message=f"{updated_count}개 설정이 저장되었습니다")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"설정 저장 실패: {str(e)}")


@router.post("/webhook/test")
async def test_webhook(request: WebhookTestRequest):
    """Webhook 테스트 메시지 발송"""
    try:
        valid_types = ("slack", "teams", "webex")
        if request.webhook_type not in valid_types:
            raise HTTPException(
                status_code=400,
                detail=f"webhook_type은 {', '.join(valid_types)} 중 하나여야 합니다"
            )

        if not request.url or not request.url.startswith("http"):
            raise HTTPException(status_code=400, detail="유효한 URL을 입력해주세요")

        result = await notifier.send_test(request.webhook_type, request.url)
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Webhook 테스트 실패: {str(e)}")


@router.get("/categories")
async def get_setting_categories():
    """설정 카테고리 목록 조회"""
    try:
        async with async_session() as session:
            result = await session.execute(
                text("SELECT DISTINCT category FROM app_settings ORDER BY category")
            )
            rows = result.fetchall()

        categories = [r[0] for r in rows if r[0]]
        return {"categories": categories}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"카테고리 조회 실패: {str(e)}")
