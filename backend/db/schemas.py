"""Pydantic 스키마 (요청/응답)"""
from pydantic import BaseModel, Field, field_validator
from typing import Optional
import re


# ── 인증 ──
class LoginRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserInfo(BaseModel):
    user_id: int
    username: str
    display_name: Optional[str] = None
    role: str


# ── 서버 ──
class CreateServerRequest(BaseModel):
    hostname: str = Field(..., min_length=1)
    display_name: str = Field(..., min_length=1)
    ip_address: str = Field(..., min_length=1)
    domain: Optional[str] = None
    os_type: str = Field(default='windows')
    credential_user: str = Field(..., min_length=1)
    credential_pass: str = Field(..., min_length=1)
    ssh_port: int = Field(default=22, ge=1, le=65535)
    winrm_port: int = Field(default=5985, ge=1, le=65535)
    use_ssl: bool = False
    group_name: str = Field(default='미분류')
    location: Optional[str] = None
    description: Optional[str] = None
    tags: list[str] = Field(default_factory=list)

    @field_validator('os_type')
    @classmethod
    def validate_os_type(cls, v):
        if v not in ('windows', 'linux'):
            raise ValueError("os_type must be 'windows' or 'linux'")
        return v

    @field_validator('ip_address')
    @classmethod
    def validate_ip(cls, v):
        pattern = r'^(\d{1,3}\.){3}\d{1,3}$'
        if not re.match(pattern, v):
            raise ValueError("Invalid IP address format")
        return v


class UpdateServerRequest(BaseModel):
    hostname: Optional[str] = None
    display_name: Optional[str] = None
    ip_address: Optional[str] = None
    domain: Optional[str] = None
    os_type: Optional[str] = None
    credential_user: Optional[str] = None
    credential_pass: Optional[str] = None
    ssh_port: Optional[int] = None
    winrm_port: Optional[int] = None
    use_ssl: Optional[bool] = None
    group_name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    tags: Optional[list[str]] = None


class ServerSummary(BaseModel):
    server_id: int
    display_name: str
    ip_address: str
    os_type: str
    group_name: str
    status: str
    cpu_usage_pct: Optional[float] = None
    mem_usage_pct: Optional[float] = None
    disk_max_pct: Optional[float] = None
    last_collected_at: Optional[str] = None
    active_alerts: int = 0


class ServerListResponse(BaseModel):
    items: list[ServerSummary]
    total: int
    page: int
    size: int


class ServerDetail(BaseModel):
    server_id: int
    hostname: str
    display_name: str
    ip_address: str
    domain: Optional[str] = None
    os_type: str
    os_version: Optional[str] = None
    credential_user: str
    ssh_port: int
    winrm_port: int
    use_ssl: bool
    group_name: str
    location: Optional[str] = None
    description: Optional[str] = None
    tags: list[str] = []
    cpu_model: Optional[str] = None
    cpu_cores: Optional[int] = None
    total_memory_mb: Optional[int] = None
    disk_info: Optional[str] = None
    status: str
    last_collected_at: Optional[str] = None
    collect_error: Optional[str] = None
    is_maintenance: bool = False
    maintenance_until: Optional[str] = None
    is_active: bool = True
    collect_interval: int = 3
    created_at: Optional[str] = None
    updated_at: Optional[str] = None


class TestConnectionRequest(BaseModel):
    ip_address: str
    os_type: str = 'windows'
    credential_user: str
    credential_pass: str
    ssh_port: int = 22
    winrm_port: int = 5985
    use_ssl: bool = False


# ── 대시보드 ──
class DashboardSummary(BaseModel):
    total_servers: int
    status_counts: dict
    avg_cpu: float
    avg_mem: float
    active_alerts: int
    unacknowledged_alerts: int
    today_alert_count: int
    uptime_pct: float


# ── 메트릭 ──
class MetricLatest(BaseModel):
    server_id: int
    collected_at: Optional[str] = None
    cpu_usage_pct: Optional[float] = None
    cpu_load_1m: Optional[float] = None
    cpu_load_5m: Optional[float] = None
    cpu_load_15m: Optional[float] = None
    mem_total_mb: Optional[int] = None
    mem_used_mb: Optional[int] = None
    mem_usage_pct: Optional[float] = None
    swap_total_mb: Optional[int] = None
    swap_used_mb: Optional[int] = None
    disk_json: Optional[str] = None
    disk_read_mbps: Optional[float] = None
    disk_write_mbps: Optional[float] = None
    net_json: Optional[str] = None
    net_connections: Optional[int] = None
    process_count: Optional[int] = None
    uptime_seconds: Optional[int] = None


# ── 로그 ──
class ServerLogEntry(BaseModel):
    id: int
    server_id: int
    log_source: str = ''
    log_level: str = ''
    message: str = ''
    event_id: Optional[int] = None
    occurred_at: str


# ── 알림 ──
class ActiveAlert(BaseModel):
    alert_id: int
    server_id: int
    server_name: str
    severity: str
    metric_name: Optional[str] = None
    metric_value: Optional[float] = None
    threshold_value: Optional[float] = None
    message: str
    acknowledged: bool
    created_at: str
    duration_seconds: int = 0


class AlertRuleCreate(BaseModel):
    rule_name: str = Field(..., min_length=1)
    description: Optional[str] = None
    server_id: Optional[int] = None
    group_name: Optional[str] = None
    metric_name: str
    condition_op: str = '>='
    warning_value: Optional[float] = None
    critical_value: Optional[float] = None
    duration_sec: int = 30
    cooldown_sec: int = 300
    is_enabled: bool = True
    sort_order: int = 0


class AlertRuleUpdate(BaseModel):
    rule_name: Optional[str] = None
    description: Optional[str] = None
    server_id: Optional[int] = None
    group_name: Optional[str] = None
    metric_name: Optional[str] = None
    condition_op: Optional[str] = None
    warning_value: Optional[float] = None
    critical_value: Optional[float] = None
    duration_sec: Optional[int] = None
    cooldown_sec: Optional[int] = None
    is_enabled: Optional[bool] = None
    sort_order: Optional[int] = None


# ── 헬스체크 ──
class HealthCheckCreate(BaseModel):
    check_type: str
    check_name: Optional[str] = None
    target: str
    interval_sec: int = 60
    timeout_sec: int = 10
    expected_status: Optional[int] = None
    is_enabled: bool = True


class HealthCheckUpdate(BaseModel):
    check_type: Optional[str] = None
    check_name: Optional[str] = None
    target: Optional[str] = None
    interval_sec: Optional[int] = None
    timeout_sec: Optional[int] = None
    expected_status: Optional[int] = None
    is_enabled: Optional[bool] = None


# ── 리포트 ──
class GenerateReportRequest(BaseModel):
    date_from: str
    date_to: str
    server_ids: Optional[list[int]] = None
    report_type: str = 'summary'
    report_name: Optional[str] = None


# ── 설정 ──
class SettingsUpdateRequest(BaseModel):
    settings: dict[str, str]


class WebhookTestRequest(BaseModel):
    webhook_type: str  # slack|teams|webex
    url: str


# ── 사용자 ──
class CreateUserRequest(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=4)
    display_name: Optional[str] = None
    role: str = 'viewer'


class UpdateUserRequest(BaseModel):
    display_name: Optional[str] = None
    password: Optional[str] = None
    role: Optional[str] = None
    is_active: Optional[bool] = None


# ── 서버 유지보수 ──
class MaintenanceRequest(BaseModel):
    is_maintenance: bool
    maintenance_until: Optional[str] = None


# ── 공통 ──
class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    size: int


class MessageResponse(BaseModel):
    message: str
    success: bool = True
