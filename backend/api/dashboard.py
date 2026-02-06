"""대시보드 API 라우터"""
from fastapi import APIRouter, HTTPException
from sqlalchemy import text
from backend.db.database import async_session
from backend.db.schemas import DashboardSummary, ActiveAlert

router = APIRouter(prefix="/api/v1/dashboard", tags=["dashboard"])


@router.get("/summary", response_model=DashboardSummary)
async def get_dashboard_summary():
    """대시보드 요약 정보 조회"""
    try:
        async with async_session() as session:
            # 전체 서버 수 및 상태별 카운트
            result = await session.execute(
                text("""SELECT status, COUNT(*) as cnt
                     FROM servers WHERE is_active=1
                     GROUP BY status""")
            )
            rows = result.fetchall()
            status_counts = {}
            total_servers = 0
            for r in rows:
                status_counts[r[0] or "unknown"] = r[1]
                total_servers += r[1]

            # 평균 CPU/MEM (최신 메트릭 기준)
            result = await session.execute(
                text("""SELECT
                    ROUND(AVG(m.cpu_usage_pct), 1),
                    ROUND(AVG(m.mem_usage_pct), 1)
                    FROM (
                        SELECT server_id, cpu_usage_pct, mem_usage_pct,
                            ROW_NUMBER() OVER (PARTITION BY server_id ORDER BY collected_at DESC) as rn
                        FROM metrics_raw
                    ) m
                    WHERE m.rn=1""")
            )
            avg_row = result.fetchone()
            avg_cpu = avg_row[0] or 0.0 if avg_row else 0.0
            avg_mem = avg_row[1] or 0.0 if avg_row else 0.0

            # 활성 알림 수 (미해결)
            result = await session.execute(
                text("SELECT COUNT(*) FROM alert_history WHERE resolved_at IS NULL")
            )
            active_alerts = result.scalar() or 0

            # 미확인 알림 수
            result = await session.execute(
                text("SELECT COUNT(*) FROM alert_history WHERE resolved_at IS NULL AND acknowledged=0")
            )
            unacknowledged_alerts = result.scalar() or 0

            # 오늘 알림 수
            result = await session.execute(
                text("""SELECT COUNT(*) FROM alert_history
                     WHERE DATE(created_at)=DATE('now','localtime')""")
            )
            today_alert_count = result.scalar() or 0

            # 가동률 (online 서버 비율)
            online_count = status_counts.get("online", 0)
            uptime_pct = round((online_count / total_servers * 100), 1) if total_servers > 0 else 0.0

        return DashboardSummary(
            total_servers=total_servers,
            status_counts=status_counts,
            avg_cpu=avg_cpu,
            avg_mem=avg_mem,
            active_alerts=active_alerts,
            unacknowledged_alerts=unacknowledged_alerts,
            today_alert_count=today_alert_count,
            uptime_pct=uptime_pct
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"대시보드 요약 조회 실패: {str(e)}")


@router.get("/alerts/active", response_model=list[ActiveAlert])
async def get_active_alerts():
    """활성(미해결) 알림 목록 조회"""
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
