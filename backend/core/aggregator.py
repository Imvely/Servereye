"""데이터 집계 모듈 (raw → 5min → hourly)"""
import logging
from sqlalchemy import text
from backend.db.database import async_session

logger = logging.getLogger(__name__)


async def aggregate_5min():
    """5분 집계 수행"""
    async with async_session() as session:
        await session.execute(text("""
            INSERT OR REPLACE INTO metrics_5min
                (server_id, bucket_time, cpu_avg, cpu_max, cpu_min,
                 mem_avg_pct, mem_max_pct, disk_read_avg, disk_write_avg,
                 net_in_avg, net_out_avg, sample_count)
            SELECT
                server_id,
                strftime('%Y-%m-%d %H:', collected_at) ||
                    CAST((CAST(strftime('%M', collected_at) AS INTEGER) / 5) * 5 AS TEXT) ||
                    ':00' AS bucket_time,
                ROUND(AVG(cpu_usage_pct), 1),
                ROUND(MAX(cpu_usage_pct), 1),
                ROUND(MIN(cpu_usage_pct), 1),
                ROUND(AVG(mem_usage_pct), 1),
                ROUND(MAX(mem_usage_pct), 1),
                ROUND(AVG(disk_read_mbps), 2),
                ROUND(AVG(disk_write_mbps), 2),
                NULL, NULL,
                COUNT(*)
            FROM metrics_raw
            WHERE collected_at >= datetime('now', '-10 minutes', 'localtime')
            GROUP BY server_id, bucket_time
        """))
        await session.commit()
        logger.debug("5min aggregation completed")


async def aggregate_hourly():
    """1시간 집계 수행"""
    async with async_session() as session:
        await session.execute(text("""
            INSERT OR REPLACE INTO metrics_hourly
                (server_id, bucket_time, cpu_avg, cpu_max, cpu_p95,
                 mem_avg_pct, mem_max_pct, disk_read_avg, disk_write_avg,
                 net_in_avg, net_out_avg, sample_count)
            SELECT
                server_id,
                strftime('%Y-%m-%d %H:00:00', bucket_time) AS bucket_time,
                ROUND(AVG(cpu_avg), 1),
                ROUND(MAX(cpu_max), 1),
                ROUND(MAX(cpu_max), 1),
                ROUND(AVG(mem_avg_pct), 1),
                ROUND(MAX(mem_max_pct), 1),
                ROUND(AVG(disk_read_avg), 2),
                ROUND(AVG(disk_write_avg), 2),
                ROUND(AVG(net_in_avg), 2),
                ROUND(AVG(net_out_avg), 2),
                SUM(sample_count)
            FROM metrics_5min
            WHERE bucket_time >= datetime('now', '-2 hours', 'localtime')
            GROUP BY server_id, strftime('%Y-%m-%d %H:00:00', bucket_time)
        """))
        await session.commit()
        logger.debug("Hourly aggregation completed")


async def cleanup_old_data():
    """보존 기간 초과 데이터 삭제"""
    async with async_session() as session:
        # 설정에서 보존 기간 가져오기
        result = await session.execute(
            text("SELECT key, value FROM app_settings WHERE category='retention'")
        )
        retention = {row[0]: int(row[1]) for row in result.fetchall()}

        raw_hours = retention.get('retention_raw_hours', 24)
        min5_days = retention.get('retention_5min_days', 30)
        hourly_days = retention.get('retention_hourly_days', 365)
        log_days = retention.get('retention_log_days', 7)
        alert_days = retention.get('retention_alert_days', 90)

        await session.execute(
            text(f"DELETE FROM metrics_raw WHERE collected_at < datetime('now', '-{raw_hours} hours', 'localtime')")
        )
        await session.execute(
            text(f"DELETE FROM metrics_5min WHERE bucket_time < datetime('now', '-{min5_days} days', 'localtime')")
        )
        await session.execute(
            text(f"DELETE FROM metrics_hourly WHERE bucket_time < datetime('now', '-{hourly_days} days', 'localtime')")
        )
        await session.execute(
            text(f"DELETE FROM server_logs WHERE collected_at < datetime('now', '-{log_days} days', 'localtime')")
        )
        await session.execute(
            text(f"DELETE FROM alert_history WHERE created_at < datetime('now', '-{alert_days} days', 'localtime')")
        )
        await session.execute(
            text("DELETE FROM health_check_results WHERE checked_at < datetime('now', '-30 days', 'localtime')")
        )
        await session.commit()
        logger.info("Old data cleanup completed")
