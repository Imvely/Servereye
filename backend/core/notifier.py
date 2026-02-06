"""Webhook 발송 모듈 (Slack/Teams/Webex)"""
import logging
import httpx
from datetime import datetime
from sqlalchemy import text
from backend.db.database import async_session

logger = logging.getLogger(__name__)

SEVERITY_COLORS = {
    "critical": "#EF4444",
    "warning": "#F59E0B",
    "resolved": "#10B981",
    "info": "#6366F1"
}

SEVERITY_EMOJI = {
    "critical": "🔴",
    "warning": "🟡",
    "resolved": "🟢",
    "info": "ℹ️"
}


class Notifier:
    """Webhook 알림 발송"""

    async def _get_webhook_settings(self) -> dict:
        """Webhook 설정 조회"""
        async with async_session() as session:
            result = await session.execute(
                text("SELECT key, value FROM app_settings WHERE category='webhook'")
            )
            return {row[0]: row[1] for row in result.fetchall()}

    async def send_alert(self, alert_data: dict):
        """알림 데이터를 설정된 Webhook으로 발송"""
        settings = await self._get_webhook_settings()
        severity = alert_data.get('severity', 'info')

        # 발송 수준 체크
        webhook_severity = settings.get('webhook_severity', 'critical')
        if webhook_severity == 'critical' and severity not in ('critical',):
            return
        if webhook_severity == 'warning' and severity not in ('critical', 'warning'):
            return

        # Slack
        if settings.get('webhook_slack_enabled') == 'true' and settings.get('webhook_slack_url'):
            await self._send_slack(settings['webhook_slack_url'], alert_data)

        # Teams
        if settings.get('webhook_teams_enabled') == 'true' and settings.get('webhook_teams_url'):
            await self._send_teams(settings['webhook_teams_url'], alert_data)

        # Webex
        if settings.get('webhook_webex_enabled') == 'true' and settings.get('webhook_webex_url'):
            await self._send_webex(settings['webhook_webex_url'], alert_data)

        # webhook_sent 업데이트
        alert_id = alert_data.get('alert_id')
        if alert_id:
            async with async_session() as session:
                await session.execute(
                    text("UPDATE alert_history SET webhook_sent=1 WHERE alert_id=:aid"),
                    {"aid": alert_id}
                )
                await session.commit()

    async def _send_slack(self, url: str, alert_data: dict):
        """Slack Webhook 발송"""
        severity = alert_data.get('severity', 'info')
        emoji = SEVERITY_EMOJI.get(severity, 'ℹ️')
        color = SEVERITY_COLORS.get(severity, '#6366F1')

        payload = {
            "text": f"{emoji} [{severity.upper()}] {alert_data.get('server_name', '')} — {alert_data.get('message', '')}",
            "attachments": [{
                "color": color,
                "fields": [
                    {"title": "서버", "value": alert_data.get('server_name', ''), "short": True},
                    {"title": "메트릭", "value": alert_data.get('message', ''), "short": True},
                    {"title": "발생시각", "value": alert_data.get('timestamp', ''), "short": True}
                ]
            }]
        }
        await self._post(url, payload)

    async def _send_teams(self, url: str, alert_data: dict):
        """Teams Webhook 발송"""
        severity = alert_data.get('severity', 'info')
        emoji = SEVERITY_EMOJI.get(severity, 'ℹ️')
        color = SEVERITY_COLORS.get(severity, '#6366F1').replace('#', '')

        payload = {
            "@type": "MessageCard",
            "themeColor": color,
            "summary": f"[{severity.upper()}] {alert_data.get('server_name', '')}",
            "sections": [{
                "activityTitle": f"{emoji} {severity.upper()} — {alert_data.get('server_name', '')}",
                "facts": [
                    {"name": "서버", "value": alert_data.get('server_name', '')},
                    {"name": "메시지", "value": alert_data.get('message', '')},
                    {"name": "발생시각", "value": alert_data.get('timestamp', '')}
                ]
            }]
        }
        await self._post(url, payload)

    async def _send_webex(self, url: str, alert_data: dict):
        """Webex Webhook 발송"""
        severity = alert_data.get('severity', 'info')
        emoji = SEVERITY_EMOJI.get(severity, 'ℹ️')

        payload = {
            "markdown": (
                f"{emoji} **[{severity.upper()}]** {alert_data.get('server_name', '')} "
                f"— {alert_data.get('message', '')}\n\n"
                f"- 발생시각: {alert_data.get('timestamp', '')}"
            )
        }
        await self._post(url, payload)

    async def _post(self, url: str, payload: dict):
        """HTTP POST 발송"""
        try:
            async with httpx.AsyncClient(timeout=10) as client:
                resp = await client.post(url, json=payload)
                if resp.status_code not in (200, 201, 204):
                    logger.warning(f"Webhook failed ({resp.status_code}): {resp.text[:200]}")
        except Exception as e:
            logger.error(f"Webhook error: {e}")

    async def send_test(self, webhook_type: str, url: str) -> dict:
        """테스트 메시지 발송"""
        test_data = {
            "severity": "info",
            "server_name": "ServerEye Test",
            "message": "테스트 알림입니다. Webhook 연동이 정상적으로 동작합니다.",
            "timestamp": datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        }

        try:
            if webhook_type == 'slack':
                await self._send_slack(url, test_data)
            elif webhook_type == 'teams':
                await self._send_teams(url, test_data)
            elif webhook_type == 'webex':
                await self._send_webex(url, test_data)
            else:
                return {"success": False, "message": f"알 수 없는 Webhook 유형: {webhook_type}"}
            return {"success": True, "message": "테스트 메시지 발송 완료"}
        except Exception as e:
            return {"success": False, "message": f"발송 실패: {str(e)}"}


notifier = Notifier()
