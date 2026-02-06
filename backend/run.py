"""ServerEye 통합 런처 — FastAPI 서버 + 시스템 트레이 + 브라우저 자동 열기"""
import argparse
import asyncio
import logging
import os
import signal
import sys
import threading
import time
import webbrowser

import uvicorn

from backend.config import HOST, DEFAULT_PORT, LOG_PATH, DATA_DIR, FRONTEND_DIR

# ------------------------------------------------------------------
# 로깅 설정
# ------------------------------------------------------------------
DATA_DIR.mkdir(parents=True, exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(str(LOG_PATH), encoding="utf-8"),
    ],
)
logger = logging.getLogger("servereye.launcher")


# ------------------------------------------------------------------
# 글로벌 상태
# ------------------------------------------------------------------
_shutdown_event = threading.Event()
_tray_instance = None  # ServerEyeTray | None
_uvicorn_server = None  # uvicorn.Server | None


# ------------------------------------------------------------------
# DB 초기화 (동기 래퍼)
# ------------------------------------------------------------------
def _init_database_sync():
    """비동기 init_database()를 동기적으로 실행"""
    from backend.db.init_db import init_database

    logger.info("Initializing database...")
    loop = asyncio.new_event_loop()
    try:
        loop.run_until_complete(init_database())
        logger.info("Database initialized successfully.")
    finally:
        loop.close()


# ------------------------------------------------------------------
# FastAPI / Uvicorn
# ------------------------------------------------------------------
def _run_uvicorn(port: int):
    """uvicorn 서버를 실행 (현재 스레드를 블로킹)"""
    global _uvicorn_server

    config = uvicorn.Config(
        app="backend.main:app",
        host=HOST,
        port=port,
        log_level="info",
        access_log=False,
    )
    _uvicorn_server = uvicorn.Server(config)

    logger.info(f"Starting uvicorn on {HOST}:{port}")
    _uvicorn_server.run()
    logger.info("Uvicorn server stopped.")
    # 서버가 종료되면 전체 앱도 종료
    _shutdown_event.set()


# ------------------------------------------------------------------
# 시스템 트레이
# ------------------------------------------------------------------
def _run_tray(port: int):
    """시스템 트레이 아이콘을 실행 (현재 스레드를 블로킹)"""
    global _tray_instance

    try:
        from backend.tray import ServerEyeTray
    except ImportError as e:
        logger.warning(f"pystray를 불러올 수 없습니다. 트레이 아이콘 비활성화: {e}")
        return

    _tray_instance = ServerEyeTray(port=port)

    # 콜백 연결
    _tray_instance.on_restart_collection = _handle_restart_collection
    _tray_instance.on_toggle_pause = _handle_toggle_pause
    _tray_instance.on_exit = _handle_tray_exit

    logger.info("Starting system tray icon...")
    _tray_instance.start()  # blocking — pystray 메시지 루프


def _handle_restart_collection():
    """트레이 메뉴: 수집 재시작"""
    logger.info("Restarting collection engine via tray...")
    try:
        from backend.core.collector import collector_engine

        loop = asyncio.new_event_loop()
        loop.run_until_complete(collector_engine.stop())
        loop.run_until_complete(collector_engine.start())
        loop.close()
        logger.info("Collection engine restarted.")
    except Exception as e:
        logger.error(f"Failed to restart collection: {e}")


_collection_paused = False


def _handle_toggle_pause() -> bool:
    """트레이 메뉴: 수집 일시 중지/재개. 새 paused 상태를 반환."""
    global _collection_paused

    try:
        from backend.core.collector import collector_engine

        loop = asyncio.new_event_loop()
        if not _collection_paused:
            loop.run_until_complete(collector_engine.stop())
            _collection_paused = True
            logger.info("Collection paused.")
        else:
            loop.run_until_complete(collector_engine.start())
            _collection_paused = False
            logger.info("Collection resumed.")
        loop.close()
    except Exception as e:
        logger.error(f"Failed to toggle pause: {e}")

    return _collection_paused


def _handle_tray_exit():
    """트레이 메뉴: 종료"""
    logger.info("Exit requested from tray.")
    _graceful_shutdown()


# ------------------------------------------------------------------
# 브라우저 자동 열기
# ------------------------------------------------------------------
def _open_browser_delayed(port: int, delay: float = 2.5):
    """서버 시작 후 잠시 대기한 뒤 브라우저를 자동으로 엶"""
    def _open():
        time.sleep(delay)
        if not _shutdown_event.is_set():
            url = f"http://localhost:{port}"
            logger.info(f"Opening browser: {url}")
            webbrowser.open(url)

    t = threading.Thread(target=_open, daemon=True)
    t.start()


# ------------------------------------------------------------------
# 그레이스풀 셧다운
# ------------------------------------------------------------------
def _graceful_shutdown(*args):
    """모든 구성 요소를 순차적으로 종료"""
    if _shutdown_event.is_set():
        return  # 이미 종료 중
    _shutdown_event.set()
    logger.info("Graceful shutdown initiated...")

    # 1) 트레이 아이콘 종료
    if _tray_instance:
        try:
            _tray_instance.stop()
        except Exception:
            pass

    # 2) Uvicorn 서버 종료
    if _uvicorn_server:
        _uvicorn_server.should_exit = True

    logger.info("Shutdown signal sent to all components.")


# ------------------------------------------------------------------
# 메인 진입점
# ------------------------------------------------------------------
def main():
    parser = argparse.ArgumentParser(description="ServerEye 통합 런처")
    parser.add_argument(
        "--port", type=int, default=DEFAULT_PORT,
        help=f"서버 포트 (기본값: {DEFAULT_PORT})",
    )
    parser.add_argument(
        "--minimized", action="store_true",
        help="브라우저 자동 열기를 건너뜁니다",
    )
    parser.add_argument(
        "--no-tray", action="store_true",
        help="시스템 트레이 아이콘을 사용하지 않습니다",
    )
    args = parser.parse_args()

    port = args.port

    logger.info("=" * 50)
    logger.info("ServerEye Launcher starting")
    logger.info(f"  Port      : {port}")
    logger.info(f"  Minimized : {args.minimized}")
    logger.info(f"  Tray      : {not args.no_tray}")
    logger.info(f"  Data dir  : {DATA_DIR}")
    logger.info(f"  Frontend  : {FRONTEND_DIR} (exists={FRONTEND_DIR.exists()})")
    logger.info("=" * 50)

    # Ctrl+C / SIGTERM 시그널 핸들러
    signal.signal(signal.SIGINT, _graceful_shutdown)
    signal.signal(signal.SIGTERM, _graceful_shutdown)

    # DB 초기화
    _init_database_sync()

    # 브라우저 자동 열기
    if not args.minimized:
        _open_browser_delayed(port)

    # 시스템 트레이 (별도 스레드)
    if not args.no_tray:
        tray_thread = threading.Thread(target=_run_tray, args=(port,), daemon=True)
        tray_thread.start()

    # Uvicorn 서버 (메인 스레드에서 실행 — blocking)
    try:
        _run_uvicorn(port)
    except KeyboardInterrupt:
        logger.info("KeyboardInterrupt received.")
    finally:
        _graceful_shutdown()

    logger.info("ServerEye Launcher stopped.")


if __name__ == "__main__":
    main()
