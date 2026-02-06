"""APScheduler 작업 정의"""
import asyncio
import logging
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from backend.core.aggregator import aggregate_5min, aggregate_hourly, cleanup_old_data

logger = logging.getLogger(__name__)

scheduler = AsyncIOScheduler()


def setup_scheduler():
    """스케줄러 작업 등록"""
    # 5분 집계 (5분마다)
    scheduler.add_job(
        _run_aggregate_5min,
        'interval', minutes=5,
        id='aggregate_5min',
        name='5분 메트릭 집계'
    )

    # 1시간 집계 (1시간마다)
    scheduler.add_job(
        _run_aggregate_hourly,
        'interval', hours=1,
        id='aggregate_hourly',
        name='1시간 메트릭 집계'
    )

    # 데이터 정리 (1시간마다)
    scheduler.add_job(
        _run_cleanup,
        'interval', hours=1,
        id='cleanup',
        name='오래된 데이터 정리'
    )

    scheduler.start()
    logger.info("Scheduler started with 3 jobs")


async def _run_aggregate_5min():
    try:
        await aggregate_5min()
    except Exception as e:
        logger.error(f"5min aggregation failed: {e}")


async def _run_aggregate_hourly():
    try:
        await aggregate_hourly()
    except Exception as e:
        logger.error(f"Hourly aggregation failed: {e}")


async def _run_cleanup():
    try:
        await cleanup_old_data()
    except Exception as e:
        logger.error(f"Data cleanup failed: {e}")
