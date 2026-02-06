"""ServerEye 진입점: FastAPI + 수집 엔진 + 스케줄러"""
import asyncio
import logging
import os
import sys
import threading
import webbrowser
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import uvicorn

from backend.config import HOST, DEFAULT_PORT, FRONTEND_DIR, LOG_PATH, DATA_DIR
from backend.db.init_db import init_database
from backend.core.collector import collector_engine
from backend.core.alert_engine import alert_engine
from backend.core.notifier import notifier
from backend.scheduler.jobs import setup_scheduler

# 로깅 설정
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(str(LOG_PATH), encoding='utf-8')
    ]
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 생명주기 관리"""
    logger.info("ServerEye starting...")

    # DB 초기화
    await init_database()
    logger.info("Database initialized")

    # 알림 엔진-수집 엔진 연결
    alert_engine.notifier = notifier
    collector_engine.alert_engine = alert_engine

    # 스케줄러 시작
    setup_scheduler()

    # 수집 엔진 시작
    await collector_engine.start()
    logger.info("Collector engine started")

    yield

    # 종료
    await collector_engine.stop()
    logger.info("ServerEye stopped")


# FastAPI 앱 생성
app = FastAPI(
    title="ServerEye",
    description="서버 모니터링 시스템",
    version="1.0.0",
    lifespan=lifespan
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# API 라우터 등록
from backend.api.auth import router as auth_router
from backend.api.servers import router as servers_router
from backend.api.dashboard import router as dashboard_router
from backend.api.metrics import router as metrics_router
from backend.api.alerts import router as alerts_router
from backend.api.alert_rules import router as alert_rules_router
from backend.api.health_checks import router as health_checks_router
from backend.api.reports import router as reports_router
from backend.api.settings import router as settings_router
from backend.api.users import router as users_router
from backend.api.websocket import router as ws_router

app.include_router(auth_router)
app.include_router(servers_router)
app.include_router(dashboard_router)
app.include_router(metrics_router)
app.include_router(alerts_router)
app.include_router(alert_rules_router)
app.include_router(health_checks_router)
app.include_router(reports_router)
app.include_router(settings_router)
app.include_router(users_router)
app.include_router(ws_router)

# 프론트엔드 정적 파일 서빙
frontend_dist = FRONTEND_DIR
if frontend_dist.exists():
    app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        """SPA 라우팅 — 모든 경로를 index.html로"""
        file_path = frontend_dist / full_path
        if file_path.exists() and file_path.is_file():
            return FileResponse(str(file_path))
        return FileResponse(str(frontend_dist / "index.html"))


def run_server(port: int = DEFAULT_PORT, minimized: bool = False):
    """서버 실행"""
    logger.info(f"Starting server on {HOST}:{port}")

    if not minimized:
        threading.Timer(2.0, lambda: webbrowser.open(f"http://localhost:{port}")).start()

    uvicorn.run(
        app,
        host=HOST,
        port=port,
        log_level="info",
        access_log=False
    )


if __name__ == "__main__":
    port = DEFAULT_PORT
    minimized = "--minimized" in sys.argv

    for arg in sys.argv[1:]:
        if arg.startswith("--port="):
            port = int(arg.split("=")[1])

    run_server(port=port, minimized=minimized)
