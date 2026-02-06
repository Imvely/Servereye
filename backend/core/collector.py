"""수집 오케스트레이터 — 서버별 asyncio 태스크 관리"""
import asyncio
import json
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy import text
from backend.db.database import async_session
from backend.core.collector_winrm import (
    collect_winrm_metrics, collect_winrm_processes,
    collect_winrm_services, collect_winrm_logs, collect_winrm_sysinfo
)
from backend.core.collector_ssh import (
    collect_ssh_metrics, collect_ssh_processes,
    collect_ssh_services, collect_ssh_logs, collect_ssh_sysinfo
)
from backend.core.ws_manager import ws_manager
from backend.core.connection_pool import ssh_pool, winrm_pool

logger = logging.getLogger(__name__)


class CollectorEngine:
    """수집 엔진: 서버별 asyncio 태스크 관리"""

    def __init__(self):
        self.tasks: dict[int, asyncio.Task] = {}
        self.running = False
        self._fail_counts: dict[int, int] = {}
        self.alert_engine = None

    async def start(self):
        """수집 엔진 시작"""
        self.running = True
        logger.info("Collector engine starting...")
        await self._load_and_start_all()

    async def stop(self):
        """수집 엔진 중지"""
        self.running = False
        for sid, task in self.tasks.items():
            task.cancel()
        self.tasks.clear()
        ssh_pool.close_all()
        winrm_pool.close_all()
        logger.info("Collector engine stopped.")

    async def _load_and_start_all(self):
        """활성 서버 목록 로드 후 수집 태스크 시작"""
        async with async_session() as session:
            result = await session.execute(
                text("SELECT server_id FROM servers WHERE is_active=1 AND is_maintenance=0")
            )
            server_ids = [row[0] for row in result.fetchall()]

        for sid in server_ids:
            if sid not in self.tasks:
                self.tasks[sid] = asyncio.create_task(self._collect_loop(sid))
                logger.info(f"Started collector for server {sid}")

    async def start_server(self, server_id: int):
        """특정 서버 수집 시작"""
        if server_id in self.tasks:
            self.tasks[server_id].cancel()
        self.tasks[server_id] = asyncio.create_task(self._collect_loop(server_id))

    async def stop_server(self, server_id: int):
        """특정 서버 수집 중지"""
        task = self.tasks.pop(server_id, None)
        if task:
            task.cancel()
        ssh_pool.remove(server_id)
        winrm_pool.remove(server_id)

    async def restart_server(self, server_id: int):
        """특정 서버 수집 재시작"""
        await self.stop_server(server_id)
        await self.start_server(server_id)

    async def _collect_loop(self, server_id: int):
        """서버 수집 루프"""
        metrics_counter = 0
        try:
            while self.running:
                metrics_counter += 1

                # 메트릭 수집 (매 루프, 기본 3초)
                await self._collect_metrics(server_id)

                # 프로세스 수집 (10초마다)
                if metrics_counter % 3 == 0:
                    await self._collect_processes(server_id)

                # 서비스 & 로그 수집 (30초마다)
                if metrics_counter % 10 == 0:
                    await self._collect_services(server_id)
                    await self._collect_logs(server_id)

                # 첫 수집 시 시스템 정보 수집
                if metrics_counter == 1:
                    await self._collect_sysinfo(server_id)

                await asyncio.sleep(3)
        except asyncio.CancelledError:
            logger.info(f"Collector for server {server_id} cancelled.")
        except Exception as e:
            logger.error(f"Collector error for server {server_id}: {e}")

    async def _get_server(self, server_id: int):
        """서버 정보 조회"""
        async with async_session() as session:
            result = await session.execute(
                text("SELECT * FROM servers WHERE server_id=:sid"),
                {"sid": server_id}
            )
            row = result.fetchone()
            if row:
                return row._mapping
            return None

    async def _collect_metrics(self, server_id: int):
        """메트릭 수집 및 저장"""
        server = await self._get_server(server_id)
        if not server:
            return

        try:
            loop = asyncio.get_event_loop()
            if server['os_type'] == 'windows':
                metrics = await loop.run_in_executor(
                    None, collect_winrm_metrics,
                    type('S', (), dict(server))()
                )
            else:
                metrics = await loop.run_in_executor(
                    None, collect_ssh_metrics,
                    type('S', (), dict(server))()
                )

            if metrics:
                self._fail_counts[server_id] = 0
                now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

                async with async_session() as session:
                    await session.execute(
                        text("""INSERT INTO metrics_raw
                            (server_id, collected_at, cpu_usage_pct, cpu_load_1m, cpu_load_5m, cpu_load_15m,
                             mem_total_mb, mem_used_mb, mem_usage_pct, swap_total_mb, swap_used_mb,
                             disk_json, disk_read_mbps, disk_write_mbps, net_json, net_connections,
                             process_count, uptime_seconds)
                            VALUES (:sid, :ca, :cpu, :l1, :l5, :l15, :mt, :mu, :mp,
                                    :st, :su, :dj, :dr, :dw, :nj, :nc, :pc, :us)"""),
                        {
                            "sid": server_id, "ca": now,
                            "cpu": metrics.get('cpu_usage_pct'),
                            "l1": metrics.get('cpu_load_1m'),
                            "l5": metrics.get('cpu_load_5m'),
                            "l15": metrics.get('cpu_load_15m'),
                            "mt": metrics.get('mem_total_mb'),
                            "mu": metrics.get('mem_used_mb'),
                            "mp": metrics.get('mem_usage_pct'),
                            "st": metrics.get('swap_total_mb'),
                            "su": metrics.get('swap_used_mb'),
                            "dj": metrics.get('disk_json'),
                            "dr": metrics.get('disk_read_mbps'),
                            "dw": metrics.get('disk_write_mbps'),
                            "nj": metrics.get('net_json'),
                            "nc": metrics.get('net_connections'),
                            "pc": metrics.get('process_count'),
                            "us": metrics.get('uptime_seconds'),
                        }
                    )
                    # 서버 상태 업데이트
                    new_status = self._determine_status(metrics, server_id)
                    old_status = server['status']
                    await session.execute(
                        text("""UPDATE servers SET status=:status,
                             last_collected_at=:lca, collect_error=NULL
                             WHERE server_id=:sid"""),
                        {"status": new_status, "lca": now, "sid": server_id}
                    )
                    await session.commit()

                # 상태 변경 WebSocket 알림
                if old_status != new_status:
                    await ws_manager.broadcast_dashboard({
                        "type": "status_change",
                        "server_id": server_id,
                        "server_name": server['display_name'],
                        "old_status": old_status,
                        "new_status": new_status,
                        "timestamp": now
                    })

                # 메트릭 WebSocket 브로드캐스트
                disk_max = self._get_disk_max_pct(metrics.get('disk_json'))
                await ws_manager.broadcast_dashboard({
                    "type": "metrics",
                    "server_id": server_id,
                    "server_name": server['display_name'],
                    "status": new_status,
                    "data": {
                        "cpu_usage_pct": metrics.get('cpu_usage_pct'),
                        "mem_usage_pct": metrics.get('mem_usage_pct'),
                        "disk_max_pct": disk_max,
                        "net_connections": metrics.get('net_connections'),
                        "process_count": metrics.get('process_count')
                    },
                    "timestamp": now
                })

                await ws_manager.broadcast_server(server_id, {
                    "type": "metrics",
                    "server_id": server_id,
                    "data": metrics,
                    "timestamp": now
                })

                # 알림 엔진 평가
                if self.alert_engine:
                    await self.alert_engine.evaluate(server_id, server['display_name'], metrics)

            else:
                await self._handle_collect_failure(server_id, server, "수집 결과 없음")

        except Exception as e:
            logger.error(f"Metric collection error for server {server_id}: {e}")
            await self._handle_collect_failure(server_id, server, str(e))

    async def _handle_collect_failure(self, server_id: int, server, error_msg: str):
        """수집 실패 처리"""
        self._fail_counts[server_id] = self._fail_counts.get(server_id, 0) + 1
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        async with async_session() as session:
            new_status = 'offline' if self._fail_counts[server_id] >= 3 else server['status']
            await session.execute(
                text("""UPDATE servers SET status=:status,
                     collect_error=:error WHERE server_id=:sid"""),
                {"status": new_status, "error": error_msg, "sid": server_id}
            )
            await session.commit()

        if self._fail_counts[server_id] == 3:
            await ws_manager.broadcast_dashboard({
                "type": "status_change",
                "server_id": server_id,
                "server_name": server['display_name'],
                "old_status": server['status'],
                "new_status": "offline",
                "timestamp": now
            })

    def _determine_status(self, metrics: dict, server_id: int) -> str:
        """메트릭 기반 서버 상태 결정"""
        cpu = metrics.get('cpu_usage_pct', 0) or 0
        mem = metrics.get('mem_usage_pct', 0) or 0

        if cpu >= 90 or mem >= 95:
            return 'critical'
        if cpu >= 70 or mem >= 80:
            return 'warning'
        return 'online'

    def _get_disk_max_pct(self, disk_json: Optional[str]) -> Optional[float]:
        """디스크 JSON에서 최대 사용률 추출"""
        if not disk_json:
            return None
        try:
            disks = json.loads(disk_json)
            if isinstance(disks, dict):
                disks = [disks]
            if disks:
                return max(d.get('usage_pct', 0) for d in disks)
        except (json.JSONDecodeError, TypeError):
            pass
        return None

    async def _collect_processes(self, server_id: int):
        """프로세스 수집"""
        server = await self._get_server(server_id)
        if not server:
            return

        try:
            loop = asyncio.get_event_loop()
            server_obj = type('S', (), dict(server))()
            if server['os_type'] == 'windows':
                processes = await loop.run_in_executor(None, collect_winrm_processes, server_obj)
            else:
                processes = await loop.run_in_executor(None, collect_ssh_processes, server_obj)

            if processes:
                async with async_session() as session:
                    await session.execute(
                        text("DELETE FROM process_snapshot WHERE server_id=:sid"),
                        {"sid": server_id}
                    )
                    for p in processes:
                        await session.execute(
                            text("""INSERT INTO process_snapshot
                                (server_id, pid, name, username, cpu_pct, mem_mb, mem_pct,
                                 thread_count, status, command_line)
                                VALUES (:sid, :pid, :name, :user, :cpu, :mem, :memp,
                                        :threads, :status, :cmd)"""),
                            {
                                "sid": server_id,
                                "pid": p.get('pid') or p.get('Id'),
                                "name": p.get('name') or p.get('ProcessName', ''),
                                "user": p.get('username', ''),
                                "cpu": p.get('cpu_pct') or p.get('CPU', 0),
                                "mem": p.get('mem_mb', 0),
                                "memp": p.get('mem_pct', 0),
                                "threads": p.get('thread_count') or p.get('threads', 0),
                                "status": p.get('status', 'running'),
                                "cmd": p.get('command_line', '')
                            }
                        )
                    await session.commit()

                await ws_manager.broadcast_server(server_id, {
                    "type": "processes_update",
                    "server_id": server_id,
                    "data": processes,
                    "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                })
        except Exception as e:
            logger.error(f"Process collect error for server {server_id}: {e}")

    async def _collect_services(self, server_id: int):
        """서비스 수집"""
        server = await self._get_server(server_id)
        if not server:
            return

        try:
            loop = asyncio.get_event_loop()
            server_obj = type('S', (), dict(server))()
            if server['os_type'] == 'windows':
                services = await loop.run_in_executor(None, collect_winrm_services, server_obj)
            else:
                services = await loop.run_in_executor(None, collect_ssh_services, server_obj)

            if services:
                async with async_session() as session:
                    await session.execute(
                        text("DELETE FROM service_status WHERE server_id=:sid"),
                        {"sid": server_id}
                    )
                    for s in services:
                        svc_name = s.get('service_name') or s.get('ServiceName', '')
                        await session.execute(
                            text("""INSERT INTO service_status
                                (server_id, service_name, display_name, status, start_type)
                                VALUES (:sid, :sn, :dn, :st, :stype)"""),
                            {
                                "sid": server_id,
                                "sn": svc_name,
                                "dn": s.get('display_name') or s.get('DisplayName', svc_name),
                                "st": str(s.get('status') or s.get('Status', 'unknown')).lower(),
                                "stype": str(s.get('start_type') or s.get('StartType', 'auto')).lower()
                            }
                        )
                    await session.commit()
        except Exception as e:
            logger.error(f"Service collect error for server {server_id}: {e}")

    async def _collect_logs(self, server_id: int):
        """로그 수집"""
        server = await self._get_server(server_id)
        if not server:
            return

        try:
            loop = asyncio.get_event_loop()
            server_obj = type('S', (), dict(server))()
            if server['os_type'] == 'windows':
                logs = await loop.run_in_executor(None, collect_winrm_logs, server_obj)
            else:
                logs = await loop.run_in_executor(None, collect_ssh_logs, server_obj)

            if logs:
                async with async_session() as session:
                    for log in logs:
                        occurred_at = log.get('occurred_at') or log.get('TimeGenerated', '')
                        if not occurred_at:
                            occurred_at = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
                        await session.execute(
                            text("""INSERT INTO server_logs
                                (server_id, log_source, log_level, message, event_id, occurred_at)
                                VALUES (:sid, :src, :level, :msg, :eid, :oat)"""),
                            {
                                "sid": server_id,
                                "src": log.get('log_source') or log.get('Source', 'system'),
                                "level": log.get('log_level') or log.get('EntryType', 'INFO'),
                                "msg": log.get('message') or log.get('Message', ''),
                                "eid": log.get('event_id') or log.get('EventID'),
                                "oat": occurred_at
                            }
                        )
                    await session.commit()
        except Exception as e:
            logger.error(f"Log collect error for server {server_id}: {e}")

    async def _collect_sysinfo(self, server_id: int):
        """시스템 정보 수집 (첫 수집 시)"""
        server = await self._get_server(server_id)
        if not server or server.get('cpu_model'):
            return

        try:
            loop = asyncio.get_event_loop()
            server_obj = type('S', (), dict(server))()
            if server['os_type'] == 'windows':
                info = await loop.run_in_executor(None, collect_winrm_sysinfo, server_obj)
            else:
                info = await loop.run_in_executor(None, collect_ssh_sysinfo, server_obj)

            if info:
                async with async_session() as session:
                    await session.execute(
                        text("""UPDATE servers SET
                            os_version=:ov, cpu_model=:cm, cpu_cores=:cc, total_memory_mb=:tm
                            WHERE server_id=:sid"""),
                        {
                            "ov": info.get('os_version'),
                            "cm": info.get('cpu_model'),
                            "cc": info.get('cpu_cores'),
                            "tm": info.get('total_memory_mb'),
                            "sid": server_id
                        }
                    )
                    await session.commit()
        except Exception as e:
            logger.error(f"Sysinfo collect error for server {server_id}: {e}")


collector_engine = CollectorEngine()
