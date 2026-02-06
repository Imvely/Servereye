"""데이터베이스 초기화 및 시드 데이터"""
from sqlalchemy import text
from backend.db.database import engine, execute_pragmas
from backend.db.models import Base


async def init_database():
    """테이블 생성 및 초기 데이터 삽입"""
    await execute_pragmas()

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    await seed_app_settings()
    await seed_default_alert_rules()
    await seed_default_admin()


async def seed_app_settings():
    """기본 앱 설정 삽입"""
    settings = [
        ('app_port', '52800', '대시보드 포트', 'general', 'number', '브라우저 접속 포트'),
        ('auto_start', 'true', '윈도우 시작 시 자동실행', 'general', 'boolean', ''),
        ('collect_interval_metrics', '3', '메트릭 수집 주기(초)', 'collection', 'number', ''),
        ('collect_interval_process', '10', '프로세스 수집 주기(초)', 'collection', 'number', ''),
        ('collect_interval_service', '30', '서비스 수집 주기(초)', 'collection', 'number', ''),
        ('collect_interval_log', '30', '로그 수집 주기(초)', 'collection', 'number', ''),
        ('collect_process_top_n', '30', '프로세스 수집 개수', 'collection', 'number', ''),
        ('retention_raw_hours', '24', 'Raw 보존(시간)', 'retention', 'number', ''),
        ('retention_5min_days', '30', '5분 집계 보존(일)', 'retention', 'number', ''),
        ('retention_hourly_days', '365', '1시간 집계 보존(일)', 'retention', 'number', ''),
        ('retention_log_days', '7', '로그 보존(일)', 'retention', 'number', ''),
        ('retention_alert_days', '90', '알림 보존(일)', 'retention', 'number', ''),
        ('default_cpu_warn', '70', 'CPU 경고(%)', 'threshold', 'number', ''),
        ('default_cpu_crit', '90', 'CPU 위험(%)', 'threshold', 'number', ''),
        ('default_mem_warn', '80', '메모리 경고(%)', 'threshold', 'number', ''),
        ('default_mem_crit', '95', '메모리 위험(%)', 'threshold', 'number', ''),
        ('default_disk_warn', '80', '디스크 경고(%)', 'threshold', 'number', ''),
        ('default_disk_crit', '95', '디스크 위험(%)', 'threshold', 'number', ''),
        ('default_duration_sec', '30', '지속시간(초)', 'threshold', 'number', ''),
        ('timeout_warn_sec', '15', '수집실패 경고(초)', 'threshold', 'number', ''),
        ('timeout_crit_sec', '60', '수집실패 위험(초)', 'threshold', 'number', ''),
        ('webhook_slack_url', '', 'Slack Webhook URL', 'webhook', 'string', ''),
        ('webhook_slack_enabled', 'false', 'Slack 활성화', 'webhook', 'boolean', ''),
        ('webhook_teams_url', '', 'Teams Webhook URL', 'webhook', 'string', ''),
        ('webhook_teams_enabled', 'false', 'Teams 활성화', 'webhook', 'boolean', ''),
        ('webhook_webex_url', '', 'Webex Webhook URL', 'webhook', 'string', ''),
        ('webhook_webex_enabled', 'false', 'Webex 활성화', 'webhook', 'boolean', ''),
        ('webhook_severity', 'critical', 'Webhook 알림 수준', 'webhook', 'string', 'all|warning|critical'),
        ('dark_mode', 'false', '다크 모드', 'general', 'boolean', ''),
        ('kiosk_interval', '30', '키오스크 전환 간격(초)', 'general', 'number', ''),
    ]

    async with engine.begin() as conn:
        for s in settings:
            await conn.execute(
                text("""INSERT OR IGNORE INTO app_settings
                    (key, value, label, category, value_type, description)
                    VALUES (:key, :value, :label, :category, :value_type, :description)"""),
                {"key": s[0], "value": s[1], "label": s[2],
                 "category": s[3], "value_type": s[4], "description": s[5]}
            )


async def seed_default_alert_rules():
    """기본 알림 규칙 생성"""
    rules = [
        ('CPU 과부하', None, None, 'cpu_usage_pct', '>=', 70, 90, 30, 300),
        ('메모리 부족', None, None, 'mem_usage_pct', '>=', 80, 95, 60, 300),
        ('디스크 부족', None, None, 'disk_usage_pct', '>=', 80, 95, 0, 300),
        ('수집 실패', None, None, 'collect_timeout', '>=', 15, 60, 0, 300),
    ]

    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT COUNT(*) FROM alert_rules"))
        count = result.scalar()
        if count == 0:
            for r in rules:
                await conn.execute(
                    text("""INSERT INTO alert_rules
                        (rule_name, server_id, group_name, metric_name, condition_op,
                         warning_value, critical_value, duration_sec, cooldown_sec)
                        VALUES (:rn, :sid, :gn, :mn, :co, :wv, :cv, :ds, :cs)"""),
                    {"rn": r[0], "sid": r[1], "gn": r[2], "mn": r[3], "co": r[4],
                     "wv": r[5], "cv": r[6], "ds": r[7], "cs": r[8]}
                )


async def seed_default_admin():
    """기본 관리자 계정 생성"""
    from passlib.hash import bcrypt

    async with engine.begin() as conn:
        result = await conn.execute(text("SELECT COUNT(*) FROM users"))
        count = result.scalar()
        if count == 0:
            password_hash = bcrypt.hash("admin")
            await conn.execute(
                text("""INSERT INTO users (username, password_hash, display_name, role)
                    VALUES (:username, :password_hash, :display_name, :role)"""),
                {"username": "admin", "password_hash": password_hash,
                 "display_name": "관리자", "role": "admin"}
            )
