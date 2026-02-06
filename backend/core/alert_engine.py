"""알림 엔진 — 임계치 판단 + 알림 생성 + 자동 해제"""
import json
import logging
from datetime import datetime
from typing import Optional
from sqlalchemy import text
from backend.db.database import async_session
from backend.core.ws_manager import ws_manager

logger = logging.getLogger(__name__)


class AlertEngine:
    """임계치 판단 및 알림 생성 엔진"""

    def __init__(self):
        # server_id -> {metric_name: {"exceed_since": datetime, "alerted": bool, "last_alert_at": datetime}}
        self._state: dict[int, dict] = {}
        self.notifier = None

    async def evaluate(self, server_id: int, server_name: str, metrics: dict):
        """메트릭 수신 시 알림 규칙 평가"""
        async with async_session() as session:
            result = await session.execute(
                text("""SELECT * FROM alert_rules WHERE is_enabled=1
                     AND (server_id IS NULL OR server_id=:sid)
                     ORDER BY sort_order"""),
                {"sid": server_id}
            )
            rules = [dict(r._mapping) for r in result.fetchall()]

            # 서버의 그룹명 조회
            srv_result = await session.execute(
                text("SELECT group_name FROM servers WHERE server_id=:sid"),
                {"sid": server_id}
            )
            srv_row = srv_result.fetchone()
            server_group = srv_row[0] if srv_row else None

        for rule in rules:
            # 그룹 필터 체크
            if rule['group_name'] and rule['group_name'] != server_group:
                continue
            if rule['server_id'] and rule['server_id'] != server_id:
                continue

            metric_name = rule['metric_name']
            metric_value = self._get_metric_value(metrics, metric_name)

            if metric_value is None:
                continue

            await self._check_rule(
                server_id, server_name, rule, metric_name, metric_value
            )

    def _get_metric_value(self, metrics: dict, metric_name: str) -> Optional[float]:
        """메트릭에서 특정 값 추출"""
        if metric_name == 'cpu_usage_pct':
            return metrics.get('cpu_usage_pct')
        elif metric_name == 'mem_usage_pct':
            return metrics.get('mem_usage_pct')
        elif metric_name == 'disk_usage_pct':
            disk_json = metrics.get('disk_json')
            if disk_json:
                try:
                    disks = json.loads(disk_json) if isinstance(disk_json, str) else disk_json
                    if isinstance(disks, dict):
                        disks = [disks]
                    if disks:
                        return max(d.get('usage_pct', 0) for d in disks)
                except (json.JSONDecodeError, TypeError):
                    pass
            return None
        elif metric_name == 'collect_timeout':
            return None  # 수집 타임아웃은 collector에서 별도 처리
        return None

    async def _check_rule(self, server_id: int, server_name: str,
                          rule: dict, metric_name: str, metric_value: float):
        """규칙 조건 판단"""
        now = datetime.now()
        state_key = f"{rule['rule_id']}_{metric_name}"

        if server_id not in self._state:
            self._state[server_id] = {}

        state = self._state[server_id].get(state_key, {
            "exceed_since": None,
            "alerted_warning": False,
            "alerted_critical": False,
            "last_alert_at": None
        })

        op = rule['condition_op']
        critical_val = rule.get('critical_value')
        warning_val = rule.get('warning_value')
        duration_sec = rule.get('duration_sec', 0)
        cooldown_sec = rule.get('cooldown_sec', 300)

        # 임계치 초과 여부 확인
        is_critical = critical_val is not None and self._compare(metric_value, op, critical_val)
        is_warning = warning_val is not None and self._compare(metric_value, op, warning_val)

        if is_critical or is_warning:
            if state["exceed_since"] is None:
                state["exceed_since"] = now

            elapsed = (now - state["exceed_since"]).total_seconds()

            if elapsed >= duration_sec:
                # 쿨다운 체크
                can_alert = True
                if state["last_alert_at"]:
                    cooldown_elapsed = (now - state["last_alert_at"]).total_seconds()
                    if cooldown_elapsed < cooldown_sec:
                        can_alert = False

                severity = 'critical' if is_critical else 'warning'

                if can_alert:
                    already_alerted = (
                        (severity == 'critical' and state["alerted_critical"]) or
                        (severity == 'warning' and state["alerted_warning"] and not is_critical)
                    )
                    if not already_alerted:
                        await self._fire_alert(
                            server_id, server_name, rule, severity,
                            metric_name, metric_value
                        )
                        state["last_alert_at"] = now
                        if severity == 'critical':
                            state["alerted_critical"] = True
                        else:
                            state["alerted_warning"] = True
        else:
            # 정상 복귀
            if state.get("alerted_warning") or state.get("alerted_critical"):
                await self._resolve_alerts(server_id, server_name, metric_name, metric_value)

            state = {
                "exceed_since": None,
                "alerted_warning": False,
                "alerted_critical": False,
                "last_alert_at": state.get("last_alert_at")
            }

        self._state[server_id][state_key] = state

    def _compare(self, value: float, op: str, threshold: float) -> bool:
        """비교 연산"""
        if op == '>=':
            return value >= threshold
        elif op == '>':
            return value > threshold
        elif op == '<=':
            return value <= threshold
        elif op == '<':
            return value < threshold
        elif op == '==':
            return value == threshold
        return False

    async def _fire_alert(self, server_id: int, server_name: str,
                          rule: dict, severity: str,
                          metric_name: str, metric_value: float):
        """알림 발생"""
        threshold = rule['critical_value'] if severity == 'critical' else rule['warning_value']
        message = (f"{self._metric_label(metric_name)} {metric_value:.1f}% "
                   f"— 임계치 {threshold}% 초과"
                   f" ({rule.get('duration_sec', 0)}초 지속)")

        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        async with async_session() as session:
            await session.execute(
                text("""INSERT INTO alert_history
                    (server_id, rule_id, severity, metric_name, metric_value,
                     threshold_value, message)
                    VALUES (:sid, :rid, :sev, :mn, :mv, :tv, :msg)"""),
                {
                    "sid": server_id, "rid": rule['rule_id'],
                    "sev": severity, "mn": metric_name,
                    "mv": metric_value, "tv": threshold, "msg": message
                }
            )
            result = await session.execute(text("SELECT last_insert_rowid()"))
            alert_id = result.scalar()
            await session.commit()

        # WebSocket 알림 브로드캐스트
        alert_data = {
            "type": "alert_fired",
            "alert_id": alert_id,
            "server_id": server_id,
            "server_name": server_name,
            "severity": severity,
            "message": message,
            "metric_name": metric_name,
            "metric_value": metric_value,
            "threshold_value": threshold,
            "timestamp": now
        }
        await ws_manager.broadcast_alert(alert_data)
        logger.warning(f"Alert fired: [{severity.upper()}] {server_name} — {message}")

        # Webhook 발송
        if self.notifier:
            await self.notifier.send_alert(alert_data)

    async def _resolve_alerts(self, server_id: int, server_name: str,
                              metric_name: str, metric_value: float):
        """알림 자동 해제"""
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        async with async_session() as session:
            result = await session.execute(
                text("""SELECT alert_id FROM alert_history
                     WHERE server_id=:sid AND metric_name=:mn
                     AND resolved_at IS NULL"""),
                {"sid": server_id, "mn": metric_name}
            )
            alert_ids = [row[0] for row in result.fetchall()]

            if alert_ids:
                await session.execute(
                    text("""UPDATE alert_history SET resolved_at=:ra
                         WHERE server_id=:sid AND metric_name=:mn
                         AND resolved_at IS NULL"""),
                    {"ra": now, "sid": server_id, "mn": metric_name}
                )
                await session.commit()

                message = f"{self._metric_label(metric_name)} 정상 복귀 (현재 {metric_value:.1f}%)"

                for aid in alert_ids:
                    await ws_manager.broadcast_alert({
                        "type": "alert_resolved",
                        "alert_id": aid,
                        "server_id": server_id,
                        "server_name": server_name,
                        "message": message,
                        "timestamp": now
                    })

                logger.info(f"Alert resolved: {server_name} — {message}")

    def _metric_label(self, metric_name: str) -> str:
        """메트릭 한글 라벨"""
        labels = {
            'cpu_usage_pct': 'CPU 사용률',
            'mem_usage_pct': '메모리 사용률',
            'disk_usage_pct': '디스크 사용률',
            'collect_timeout': '수집 타임아웃'
        }
        return labels.get(metric_name, metric_name)


alert_engine = AlertEngine()
