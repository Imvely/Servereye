"""WebSocket 연결 관리"""
import json
import logging
from fastapi import WebSocket
from typing import Optional

logger = logging.getLogger(__name__)


class ConnectionManager:
    """WebSocket 연결 매니저"""

    def __init__(self):
        self.dashboard_connections: list[WebSocket] = []
        self.server_connections: dict[int, list[WebSocket]] = {}

    async def connect_dashboard(self, websocket: WebSocket):
        await websocket.accept()
        self.dashboard_connections.append(websocket)
        logger.info(f"Dashboard WS connected. Total: {len(self.dashboard_connections)}")

    async def connect_server(self, websocket: WebSocket, server_id: int):
        await websocket.accept()
        if server_id not in self.server_connections:
            self.server_connections[server_id] = []
        self.server_connections[server_id].append(websocket)
        logger.info(f"Server {server_id} WS connected.")

    def disconnect_dashboard(self, websocket: WebSocket):
        if websocket in self.dashboard_connections:
            self.dashboard_connections.remove(websocket)
            logger.info(f"Dashboard WS disconnected. Total: {len(self.dashboard_connections)}")

    def disconnect_server(self, websocket: WebSocket, server_id: int):
        if server_id in self.server_connections:
            if websocket in self.server_connections[server_id]:
                self.server_connections[server_id].remove(websocket)

    async def broadcast_dashboard(self, data: dict):
        """대시보드 연결된 모든 클라이언트에 메시지 브로드캐스트"""
        disconnected = []
        for ws in self.dashboard_connections:
            try:
                await ws.send_json(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect_dashboard(ws)

    async def broadcast_server(self, server_id: int, data: dict):
        """특정 서버 상세 연결에 메시지 브로드캐스트"""
        if server_id not in self.server_connections:
            return
        disconnected = []
        for ws in self.server_connections[server_id]:
            try:
                await ws.send_json(data)
            except Exception:
                disconnected.append(ws)
        for ws in disconnected:
            self.disconnect_server(ws, server_id)

    async def broadcast_alert(self, data: dict):
        """알림 메시지를 대시보드 + 관련 서버 상세에 브로드캐스트"""
        await self.broadcast_dashboard(data)
        server_id = data.get('server_id')
        if server_id:
            await self.broadcast_server(server_id, data)


ws_manager = ConnectionManager()
