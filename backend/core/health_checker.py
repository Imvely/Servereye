"""헬스체크 엔진 (ping/tcp/http)"""
import asyncio
import logging
import socket
import time
from typing import Optional
import httpx
from sqlalchemy import text
from backend.db.database import async_session

logger = logging.getLogger(__name__)


async def run_health_check(check: dict) -> dict:
    """헬스체크 실행"""
    check_type = check['check_type']
    target = check['target']
    timeout = check.get('timeout_sec', 10)

    start = time.time()
    try:
        if check_type == 'ping':
            result = await _check_ping(target, timeout)
        elif check_type == 'tcp':
            result = await _check_tcp(target, timeout)
        elif check_type == 'http':
            result = await _check_http(target, timeout, check.get('expected_status'))
        else:
            result = {"is_healthy": False, "error_message": f"Unknown check type: {check_type}"}

        elapsed_ms = int((time.time() - start) * 1000)
        result['response_ms'] = elapsed_ms
        return result

    except Exception as e:
        elapsed_ms = int((time.time() - start) * 1000)
        return {
            "is_healthy": False,
            "response_ms": elapsed_ms,
            "error_message": str(e)
        }


async def _check_ping(target: str, timeout: int) -> dict:
    """ICMP ping 체크"""
    try:
        proc = await asyncio.create_subprocess_exec(
            'ping', '-n', '1', '-w', str(timeout * 1000), target,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE
        )
        stdout, stderr = await asyncio.wait_for(proc.communicate(), timeout=timeout + 5)
        is_healthy = proc.returncode == 0
        return {"is_healthy": is_healthy}
    except asyncio.TimeoutError:
        return {"is_healthy": False, "error_message": "Ping timeout"}


async def _check_tcp(target: str, timeout: int) -> dict:
    """TCP 포트 체크"""
    parts = target.split(':')
    if len(parts) != 2:
        return {"is_healthy": False, "error_message": "Invalid target format (host:port)"}

    host, port = parts[0], int(parts[1])
    loop = asyncio.get_event_loop()

    try:
        await asyncio.wait_for(
            loop.run_in_executor(None, _tcp_connect, host, port, timeout),
            timeout=timeout + 2
        )
        return {"is_healthy": True}
    except (asyncio.TimeoutError, Exception) as e:
        return {"is_healthy": False, "error_message": str(e)}


def _tcp_connect(host: str, port: int, timeout: int):
    """TCP 연결 시도"""
    sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    sock.settimeout(timeout)
    try:
        sock.connect((host, port))
    finally:
        sock.close()


async def _check_http(target: str, timeout: int, expected_status: Optional[int] = None) -> dict:
    """HTTP 헬스체크"""
    try:
        async with httpx.AsyncClient(timeout=timeout, verify=False) as client:
            resp = await client.get(target)
            is_healthy = True
            if expected_status:
                is_healthy = resp.status_code == expected_status
            else:
                is_healthy = 200 <= resp.status_code < 400
            return {"is_healthy": is_healthy, "status_code": resp.status_code}
    except Exception as e:
        return {"is_healthy": False, "error_message": str(e)}


async def execute_health_check(check_id: int) -> dict:
    """헬스체크 실행 후 결과 저장"""
    async with async_session() as session:
        result = await session.execute(
            text("SELECT * FROM health_checks WHERE check_id=:cid"),
            {"cid": check_id}
        )
        check = result.fetchone()
        if not check:
            return {"error": "Check not found"}

        check_dict = dict(check._mapping)

    hc_result = await run_health_check(check_dict)

    async with async_session() as session:
        await session.execute(
            text("""INSERT INTO health_check_results
                (check_id, server_id, is_healthy, response_ms, status_code, error_message)
                VALUES (:cid, :sid, :ih, :rm, :sc, :em)"""),
            {
                "cid": check_id,
                "sid": check_dict['server_id'],
                "ih": 1 if hc_result.get('is_healthy') else 0,
                "rm": hc_result.get('response_ms'),
                "sc": hc_result.get('status_code'),
                "em": hc_result.get('error_message')
            }
        )
        await session.commit()

    return hc_result
