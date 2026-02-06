"""SQLAlchemy ORM 모델"""
from sqlalchemy import (
    Column, Integer, Text, Real, ForeignKey, Index, text
)
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Server(Base):
    __tablename__ = 'servers'

    server_id = Column(Integer, primary_key=True, autoincrement=True)
    hostname = Column(Text, nullable=False)
    display_name = Column(Text, nullable=False)
    ip_address = Column(Text, nullable=False, unique=True)
    domain = Column(Text)
    os_type = Column(Text, nullable=False, default='windows')
    os_version = Column(Text)

    credential_user = Column(Text, nullable=False)
    credential_pass = Column(Text, nullable=False)
    ssh_port = Column(Integer, default=22)
    ssh_key_path = Column(Text)
    winrm_port = Column(Integer, default=5985)
    use_ssl = Column(Integer, default=0)

    group_name = Column(Text, default='미분류')
    location = Column(Text)
    description = Column(Text)
    tags = Column(Text, default='[]')

    cpu_model = Column(Text)
    cpu_cores = Column(Integer)
    total_memory_mb = Column(Integer)
    disk_info = Column(Text)

    status = Column(Text, default='unknown')
    last_collected_at = Column(Text)
    collect_error = Column(Text)
    is_maintenance = Column(Integer, default=0)
    maintenance_until = Column(Text)
    is_active = Column(Integer, default=1)

    collect_interval = Column(Integer, default=3)
    collect_processes = Column(Integer, default=1)
    collect_services = Column(Integer, default=1)
    collect_logs = Column(Integer, default=1)

    created_at = Column(Text, server_default=text("datetime('now','localtime')"))
    updated_at = Column(Text, server_default=text("datetime('now','localtime')"))


class MetricsRaw(Base):
    __tablename__ = 'metrics_raw'

    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(Integer, ForeignKey('servers.server_id'), nullable=False)
    collected_at = Column(Text, nullable=False, server_default=text("datetime('now','localtime')"))
    cpu_usage_pct = Column(Real)
    cpu_load_1m = Column(Real)
    cpu_load_5m = Column(Real)
    cpu_load_15m = Column(Real)
    mem_total_mb = Column(Integer)
    mem_used_mb = Column(Integer)
    mem_usage_pct = Column(Real)
    swap_total_mb = Column(Integer)
    swap_used_mb = Column(Integer)
    disk_json = Column(Text)
    disk_read_mbps = Column(Real)
    disk_write_mbps = Column(Real)
    net_json = Column(Text)
    net_connections = Column(Integer)
    process_count = Column(Integer)
    uptime_seconds = Column(Integer)

    __table_args__ = (
        Index('idx_raw_lookup', 'server_id', collected_at.desc()),
    )


class Metrics5Min(Base):
    __tablename__ = 'metrics_5min'

    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(Integer, nullable=False)
    bucket_time = Column(Text, nullable=False)
    cpu_avg = Column(Real)
    cpu_max = Column(Real)
    cpu_min = Column(Real)
    mem_avg_pct = Column(Real)
    mem_max_pct = Column(Real)
    disk_read_avg = Column(Real)
    disk_write_avg = Column(Real)
    net_in_avg = Column(Real)
    net_out_avg = Column(Real)
    sample_count = Column(Integer)

    __table_args__ = (
        Index('idx_5min_uk', 'server_id', 'bucket_time', unique=True),
    )


class MetricsHourly(Base):
    __tablename__ = 'metrics_hourly'

    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(Integer, nullable=False)
    bucket_time = Column(Text, nullable=False)
    cpu_avg = Column(Real)
    cpu_max = Column(Real)
    cpu_p95 = Column(Real)
    mem_avg_pct = Column(Real)
    mem_max_pct = Column(Real)
    disk_read_avg = Column(Real)
    disk_write_avg = Column(Real)
    net_in_avg = Column(Real)
    net_out_avg = Column(Real)
    alert_count = Column(Integer, default=0)
    downtime_sec = Column(Integer, default=0)
    sample_count = Column(Integer)

    __table_args__ = (
        Index('idx_hourly_uk', 'server_id', 'bucket_time', unique=True),
    )


class ServiceStatus(Base):
    __tablename__ = 'service_status'

    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(Integer, nullable=False)
    service_name = Column(Text, nullable=False)
    display_name = Column(Text)
    status = Column(Text)
    start_type = Column(Text)
    pid = Column(Integer)
    mem_mb = Column(Real)
    updated_at = Column(Text, server_default=text("datetime('now','localtime')"))

    __table_args__ = (
        Index('idx_svc', 'server_id'),
    )


class ProcessSnapshot(Base):
    __tablename__ = 'process_snapshot'

    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(Integer, nullable=False)
    pid = Column(Integer)
    name = Column(Text)
    username = Column(Text)
    cpu_pct = Column(Real)
    mem_mb = Column(Real)
    mem_pct = Column(Real)
    thread_count = Column(Integer)
    status = Column(Text)
    command_line = Column(Text)
    updated_at = Column(Text, server_default=text("datetime('now','localtime')"))

    __table_args__ = (
        Index('idx_proc', 'server_id'),
    )


class ServerLog(Base):
    __tablename__ = 'server_logs'

    id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(Integer, nullable=False)
    log_source = Column(Text)
    log_level = Column(Text)
    message = Column(Text)
    event_id = Column(Integer)
    occurred_at = Column(Text, nullable=False)
    collected_at = Column(Text, server_default=text("datetime('now','localtime')"))

    __table_args__ = (
        Index('idx_log_lookup', 'server_id', occurred_at.desc()),
        Index('idx_log_level', 'log_level', occurred_at.desc()),
    )


class AlertRule(Base):
    __tablename__ = 'alert_rules'

    rule_id = Column(Integer, primary_key=True, autoincrement=True)
    rule_name = Column(Text, nullable=False)
    description = Column(Text)
    server_id = Column(Integer)
    group_name = Column(Text)
    metric_name = Column(Text, nullable=False)
    condition_op = Column(Text, default='>=')
    warning_value = Column(Real)
    critical_value = Column(Real)
    duration_sec = Column(Integer, default=30)
    cooldown_sec = Column(Integer, default=300)
    is_enabled = Column(Integer, default=1)
    sort_order = Column(Integer, default=0)
    created_at = Column(Text, server_default=text("datetime('now','localtime')"))
    updated_at = Column(Text, server_default=text("datetime('now','localtime')"))


class AlertHistory(Base):
    __tablename__ = 'alert_history'

    alert_id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(Integer, nullable=False)
    rule_id = Column(Integer, ForeignKey('alert_rules.rule_id'))
    severity = Column(Text, nullable=False)
    metric_name = Column(Text)
    metric_value = Column(Real)
    threshold_value = Column(Real)
    message = Column(Text, nullable=False)
    acknowledged = Column(Integer, default=0)
    acknowledged_by = Column(Text)
    acknowledged_at = Column(Text)
    resolved_at = Column(Text)
    webhook_sent = Column(Integer, default=0)
    created_at = Column(Text, server_default=text("datetime('now','localtime')"))

    __table_args__ = (
        Index('idx_alert_active', 'severity'),
        Index('idx_alert_time', 'server_id', created_at.desc()),
    )


class HealthCheck(Base):
    __tablename__ = 'health_checks'

    check_id = Column(Integer, primary_key=True, autoincrement=True)
    server_id = Column(Integer, ForeignKey('servers.server_id'), nullable=False)
    check_type = Column(Text, nullable=False)
    check_name = Column(Text)
    target = Column(Text, nullable=False)
    interval_sec = Column(Integer, default=60)
    timeout_sec = Column(Integer, default=10)
    expected_status = Column(Integer)
    is_enabled = Column(Integer, default=1)
    created_at = Column(Text, server_default=text("datetime('now','localtime')"))


class HealthCheckResult(Base):
    __tablename__ = 'health_check_results'

    id = Column(Integer, primary_key=True, autoincrement=True)
    check_id = Column(Integer, ForeignKey('health_checks.check_id'), nullable=False)
    server_id = Column(Integer, nullable=False)
    is_healthy = Column(Integer, nullable=False)
    response_ms = Column(Integer)
    status_code = Column(Integer)
    error_message = Column(Text)
    checked_at = Column(Text, server_default=text("datetime('now','localtime')"))

    __table_args__ = (
        Index('idx_hcr', 'check_id', checked_at.desc()),
    )


class User(Base):
    __tablename__ = 'users'

    user_id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(Text, nullable=False, unique=True)
    password_hash = Column(Text, nullable=False)
    display_name = Column(Text)
    role = Column(Text, default='viewer')
    is_active = Column(Integer, default=1)
    preferences = Column(Text, default='{}')
    last_login = Column(Text)
    created_at = Column(Text, server_default=text("datetime('now','localtime')"))


class AppSetting(Base):
    __tablename__ = 'app_settings'

    key = Column(Text, primary_key=True)
    value = Column(Text, nullable=False)
    label = Column(Text)
    category = Column(Text)
    value_type = Column(Text, default='string')
    description = Column(Text)
    updated_at = Column(Text, server_default=text("datetime('now','localtime')"))


class ReportHistory(Base):
    __tablename__ = 'report_history'

    report_id = Column(Integer, primary_key=True, autoincrement=True)
    report_name = Column(Text, nullable=False)
    report_type = Column(Text)
    server_ids = Column(Text)
    date_from = Column(Text, nullable=False)
    date_to = Column(Text, nullable=False)
    file_path = Column(Text)
    file_size_kb = Column(Integer)
    created_by = Column(Text)
    created_at = Column(Text, server_default=text("datetime('now','localtime')"))


class AuditLog(Base):
    __tablename__ = 'audit_log'

    id = Column(Integer, primary_key=True, autoincrement=True)
    username = Column(Text)
    action = Column(Text, nullable=False)
    target_type = Column(Text)
    target_id = Column(Integer)
    detail = Column(Text)
    created_at = Column(Text, server_default=text("datetime('now','localtime')"))

    __table_args__ = (
        Index('idx_audit', created_at.desc()),
    )
