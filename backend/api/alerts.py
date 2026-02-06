"""알림 이력 API 라우터"""
from fastapi import APIRouter, HTTPException, Query
from sqlalchemy import text
from backend.db.database import async_session
from backend.db.schemas import ActiveAlert, PaginatedResponse, MessageResponse

router = APIRouter(prefix="/api/v1/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    severity: str = None,
    server_id: int = None,
    acknowledged: int = Query(None, description="0=미확인, 1=확인"),
    date_from: str = Query(None, alias="from"),
    date_to: str = Query(None, alias="to"),
    page: int = Query(1, ge=1),
    size: int = Query(50, ge=1, le=200)
):
    """알림 이력 조회 (필터/페이징)"""
    try:
        conditions = []
        params = {}

        if severity:
            conditions.append("a.severity=:severity")
            params["severity"] = severity
        if server_id is not None:
            conditions.append("a.server_id=:server_id")
            params["server_id"] = server_id
        if acknowledged is not None:
            conditions.append("a.acknowledged=:ack")
            params["ack"] = acknowledged
        if date_from:
            conditions.append("a.created_at >= :df")
            params["df"] = date_from
        if date_to:
            conditions.append("a.created_at <= :dt")
            params["dt"] = date_to

        where = " AND ".join(conditions) if conditions else "1=1"
        offset = (page - 1) * size
        params["limit"] = size
        params["offset"] = offset

        async with async_session() as session:
            count_result = await session.execute(
                text(f"SELECT COUNT(*) FROM alert_history a WHERE {where}"), params
            )
            total = count_result.scalar()

            result = await session.execute(
                text(f"""SELECT a.alert_id, a.server_id, s.display_name,
                    a.severity, a.metric_name, a.metric_value, a.threshold_value,
                    a.message, a.acknowledged, a.acknowledged_by, a.acknowledged_at,
                    a.resolved_at, a.webhook_sent, a.created_at,
                    CASE WHEN a.resolved_at IS NOT NULL
                        THEN CAST((julianday(a.resolved_at) - julianday(a.created_at)) * 86400 AS INTEGER)
                        ELSE CAST((julianday('now','localtime') - julianday(a.created_at)) * 86400 AS INTEGER)
                    END as duration_seconds
                    FROM alert_history a
                    JOIN servers s ON a.server_id=s.server_id
                    WHERE {where}
                    ORDER BY a.created_at DESC
                    LIMIT :limit OFFSET :offset"""),
                params
            )
            rows = result.fetchall()

        items = []
        for r in rows:
            items.append({
                "alert_id": r[0],
                "server_id": r[1],
                "server_name": r[2] or f"Server {r[1]}",
                "severity": r[3],
                "metric_name": r[4],
                "metric_value": r[5],
                "threshold_value": r[6],
                "message": r[7],
                "acknowledged": bool(r[8]),
                "acknowledged_by": r[9],
                "acknowledged_at": r[10],
                "resolved_at": r[11],
                "webhook_sent": bool(r[12]),
                "created_at": r[13],
                "duration_seconds": r[14] or 0
            })

        return {"items": items, "total": total, "page": page, "size": size}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"알림 이력 조회 실패: {str(e)}")


@router.get("/active", response_model=list[ActiveAlert])
async def get_active_alerts():
    """활성(미해결) 알림 목록"""
    try:
        async with async_session() as session:
            result = await session.execute(
                text("""SELECT a.alert_id, a.server_id, s.display_name,
                    a.severity, a.metric_name, a.metric_value, a.threshold_value,
                    a.message, a.acknowledged, a.created_at,
                    CAST((julianday('now','localtime') - julianday(a.created_at)) * 86400 AS INTEGER) as duration_seconds
                    FROM alert_history a
                    JOIN servers s ON a.server_id=s.server_id
                    WHERE a.resolved_at IS NULL
                    ORDER BY
                        CASE a.severity WHEN 'critical' THEN 0 WHEN 'warning' THEN 1 ELSE 2 END,
                        a.created_at DESC""")
            )
            rows = result.fetchall()

        alerts = []
        for r in rows:
            alerts.append(ActiveAlert(
                alert_id=r[0],
                server_id=r[1],
                server_name=r[2] or f"Server {r[1]}",
                severity=r[3],
                metric_name=r[4],
                metric_value=r[5],
                threshold_value=r[6],
                message=r[7],
                acknowledged=bool(r[8]),
                created_at=r[9],
                duration_seconds=r[10] or 0
            ))
        return alerts
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"활성 알림 조회 실패: {str(e)}")


@router.put("/{alert_id}/acknowledge", response_model=MessageResponse)
async def acknowledge_alert(alert_id: int, username: str = "admin"):
    """알림 확인 처리"""
    try:
        async with async_session() as session:
            result = await session.execute(
                text("SELECT alert_id, acknowledged FROM alert_history WHERE alert_id=:aid"),
                {"aid": alert_id}
            )
            row = result.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다")
            if row[1]:
                raise HTTPException(status_code=400, detail="이미 확인된 알림입니다")

            await session.execute(
                text("""UPDATE alert_history
                     SET acknowledged=1, acknowledged_by=:by,
                         acknowledged_at=datetime('now','localtime')
                     WHERE alert_id=:aid"""),
                {"aid": alert_id, "by": username}
            )
            await session.commit()

        return MessageResponse(message="알림이 확인 처리되었습니다")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"알림 확인 처리 실패: {str(e)}")


@router.put("/{alert_id}/resolve", response_model=MessageResponse)
async def resolve_alert(alert_id: int):
    """알림 해결 처리"""
    try:
        async with async_session() as session:
            result = await session.execute(
                text("SELECT alert_id, resolved_at FROM alert_history WHERE alert_id=:aid"),
                {"aid": alert_id}
            )
            row = result.fetchone()
            if not row:
                raise HTTPException(status_code=404, detail="알림을 찾을 수 없습니다")
            if row[1]:
                raise HTTPException(status_code=400, detail="이미 해결된 알림입니다")

            await session.execute(
                text("""UPDATE alert_history
                     SET resolved_at=datetime('now','localtime')
                     WHERE alert_id=:aid"""),
                {"aid": alert_id}
            )
            await session.commit()

        return MessageResponse(message="알림이 해결 처리되었습니다")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"알림 해결 처리 실패: {str(e)}")


@router.put("/acknowledge-all", response_model=MessageResponse)
async def acknowledge_all_alerts(username: str = "admin"):
    """미확인 활성 알림 일괄 확인"""
    try:
        async with async_session() as session:
            result = await session.execute(
                text("""SELECT COUNT(*) FROM alert_history
                     WHERE resolved_at IS NULL AND acknowledged=0""")
            )
            count = result.scalar() or 0

            if count == 0:
                return MessageResponse(message="확인할 알림이 없습니다")

            await session.execute(
                text("""UPDATE alert_history
                     SET acknowledged=1, acknowledged_by=:by,
                         acknowledged_at=datetime('now','localtime')
                     WHERE resolved_at IS NULL AND acknowledged=0"""),
                {"by": username}
            )
            await session.commit()

        return MessageResponse(message=f"{count}건의 알림이 일괄 확인 처리되었습니다")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"일괄 확인 처리 실패: {str(e)}")
