"""WinRM/SSH 연결 풀 관리"""
import logging
import paramiko
from typing import Optional
from backend.core.crypto import decrypt

logger = logging.getLogger(__name__)


class SSHPool:
    """서버당 paramiko SSHClient 1개를 유지하고 재사용"""

    def __init__(self):
        self.clients: dict[int, paramiko.SSHClient] = {}

    def _is_alive(self, server_id: int) -> bool:
        client = self.clients.get(server_id)
        if client is None:
            return False
        transport = client.get_transport()
        return transport is not None and transport.is_active()

    def get_client(self, server) -> paramiko.SSHClient:
        if server.server_id not in self.clients or not self._is_alive(server.server_id):
            client = paramiko.SSHClient()
            client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            connect_kwargs = {
                "hostname": server.ip_address,
                "port": server.ssh_port,
                "username": server.credential_user,
                "password": decrypt(server.credential_pass),
                "timeout": 10,
                "allow_agent": False,
                "look_for_keys": False,
            }
            if server.ssh_key_path:
                connect_kwargs["key_filename"] = server.ssh_key_path
            client.connect(**connect_kwargs)
            self.clients[server.server_id] = client
        return self.clients[server.server_id]

    def remove(self, server_id: int):
        client = self.clients.pop(server_id, None)
        if client:
            try:
                client.close()
            except Exception:
                pass

    def close_all(self):
        for sid in list(self.clients.keys()):
            self.remove(sid)


class WinRMPool:
    """서버당 WinRM 세션 1개를 유지하고 재사용"""

    def __init__(self):
        self.sessions: dict[int, object] = {}

    def get_session(self, server):
        import winrm
        if server.server_id not in self.sessions:
            protocol = "https" if server.use_ssl else "http"
            self.sessions[server.server_id] = winrm.Session(
                f"{protocol}://{server.ip_address}:{server.winrm_port}/wsman",
                auth=(server.credential_user, decrypt(server.credential_pass)),
                transport='ntlm',
                read_timeout_sec=30,
                operation_timeout_sec=20
            )
        return self.sessions[server.server_id]

    def remove(self, server_id: int):
        self.sessions.pop(server_id, None)

    def close_all(self):
        self.sessions.clear()


ssh_pool = SSHPool()
winrm_pool = WinRMPool()
