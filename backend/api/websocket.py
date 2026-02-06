"""WebSocket API 라우터"""
import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from backend.core.ws_manager import ws_manager

logger = logging.getLogger(__name__)
router = APIRouter(tags=["websocket"])


@router.websocket("/ws/dashboard")
async def websocket_dashboard(websocket: WebSocket):
    """대시보드 실시간 데이터 WebSocket"""
    await ws_manager.connect_dashboard(websocket)
    try:
        while True:
            # 클라이언트로부터 메시지 수신 대기 (keepalive)
            data = await websocket.receive_text()
            # ping/pong 처리
            if data == "ping":
                try:
                    await websocket.send_text("pong")
                except Exception:
                    break
    except WebSocketDisconnect:
        logger.info("Dashboard WebSocket disconnected normally")
    except Exception as e:
        logger.warning(f"Dashboard WebSocket error: {e}")
    finally:
        ws_manager.disconnect_dashboard(websocket)


@router.websocket("/ws/server/{server_id}")
async def websocket_server(websocket: WebSocket, server_id: int):
    """서버 상세 실시간 데이터 WebSocket"""
    await ws_manager.connect_server(websocket, server_id)
    try:
        while True:
            # 클라이언트로부터 메시지 수신 대기 (keepalive)
            data = await websocket.receive_text()
            # ping/pong 처리
            if data == "ping":
                try:
                    await websocket.send_text("pong")
                except Exception:
                    break
    except WebSocketDisconnect:
        logger.info(f"Server {server_id} WebSocket disconnected normally")
    except Exception as e:
        logger.warning(f"Server {server_id} WebSocket error: {e}")
    finally:
        ws_manager.disconnect_server(websocket, server_id)
