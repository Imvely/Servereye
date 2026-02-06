// ── 서버 ──
export interface Server {
  server_id: number;
  hostname: string;
  display_name: string;
  ip_address: string;
  domain?: string;
  os_type: 'windows' | 'linux';
  os_version?: string;
  credential_user: string;
  ssh_port: number;
  winrm_port: number;
  use_ssl: boolean;
  group_name: string;
  location?: string;
  description?: string;
  tags: string[];
  cpu_model?: string;
  cpu_cores?: number;
  total_memory_mb?: number;
  disk_info?: string;
  status: ServerStatus;
  last_collected_at?: string;
  collect_error?: string;
  is_maintenance: boolean;
  maintenance_until?: string;
  is_active: boolean;
  collect_interval: number;
  created_at?: string;
  updated_at?: string;
}

export type ServerStatus = 'online' | 'warning' | 'critical' | 'offline' | 'maintenance' | 'unknown';

export interface ServerSummary {
  server_id: number;
  display_name: string;
  ip_address: string;
  os_type: string;
  group_name: string;
  status: ServerStatus;
  cpu_usage_pct: number | null;
  mem_usage_pct: number | null;
  disk_max_pct: number | null;
  last_collected_at: string | null;
  active_alerts: number;
}

export interface ServerListResponse {
  items: ServerSummary[];
  total: number;
  page: number;
  size: number;
}

export interface CreateServerRequest {
  hostname: string;
  display_name: string;
  ip_address: string;
  domain?: string;
  os_type: 'windows' | 'linux';
  credential_user: string;
  credential_pass: string;
  ssh_port?: number;
  winrm_port?: number;
  use_ssl?: boolean;
  group_name?: string;
  location?: string;
  description?: string;
  tags?: string[];
}

// ── 대시보드 ──
export interface DashboardSummary {
  total_servers: number;
  status_counts: {
    online: number;
    warning: number;
    critical: number;
    offline: number;
    maintenance: number;
  };
  avg_cpu: number;
  avg_mem: number;
  active_alerts: number;
  unacknowledged_alerts: number;
  today_alert_count: number;
  uptime_pct: number;
}

// ── 메트릭 ──
export interface MetricLatest {
  server_id: number;
  collected_at?: string;
  cpu_usage_pct?: number;
  cpu_load_1m?: number;
  cpu_load_5m?: number;
  cpu_load_15m?: number;
  mem_total_mb?: number;
  mem_used_mb?: number;
  mem_usage_pct?: number;
  swap_total_mb?: number;
  swap_used_mb?: number;
  disk_json?: string;
  disk_read_mbps?: number;
  disk_write_mbps?: number;
  net_json?: string;
  net_connections?: number;
  process_count?: number;
  uptime_seconds?: number;
}

export interface MetricHistory {
  time: string;
  cpu?: number;
  mem?: number;
  disk_read?: number;
  disk_write?: number;
  net_in?: number;
  net_out?: number;
}

// ── 알림 ──
export interface ActiveAlert {
  alert_id: number;
  server_id: number;
  server_name: string;
  severity: 'warning' | 'critical';
  metric_name?: string;
  metric_value?: number;
  threshold_value?: number;
  message: string;
  acknowledged: boolean;
  created_at: string;
  duration_seconds: number;
}

export interface AlertRule {
  rule_id: number;
  rule_name: string;
  description?: string;
  server_id?: number;
  group_name?: string;
  metric_name: string;
  condition_op: string;
  warning_value?: number;
  critical_value?: number;
  duration_sec: number;
  cooldown_sec: number;
  is_enabled: boolean;
  sort_order: number;
}

// ── 프로세스 & 서비스 ──
export interface ProcessInfo {
  pid: number;
  name: string;
  username: string;
  cpu_pct: number;
  mem_mb: number;
  mem_pct: number;
  thread_count: number;
  status: string;
  command_line: string;
}

export interface ServiceInfo {
  service_name: string;
  display_name: string;
  status: string;
  start_type: string;
  pid?: number;
  mem_mb?: number;
}

// ── 로그 ──
export interface ServerLogEntry {
  id: number;
  server_id: number;
  log_source: string;
  log_level: string;
  message: string;
  event_id?: number;
  occurred_at: string;
}

// ── 헬스체크 ──
export interface HealthCheck {
  check_id: number;
  server_id: number;
  check_type: string;
  check_name?: string;
  target: string;
  interval_sec: number;
  timeout_sec: number;
  expected_status?: number;
  is_enabled: boolean;
  latest_result?: HealthCheckResult;
}

export interface HealthCheckResult {
  is_healthy: boolean;
  response_ms: number;
  status_code?: number;
  error_message?: string;
  checked_at: string;
}

// ── 리포트 ──
export interface ReportHistory {
  report_id: number;
  report_name: string;
  report_type: string;
  date_from: string;
  date_to: string;
  file_size_kb: number;
  created_by: string;
  created_at: string;
}

// ── 사용자 ──
export interface User {
  user_id: number;
  username: string;
  display_name?: string;
  role: string;
  is_active: boolean;
  last_login?: string;
  created_at: string;
}

// ── 설정 ──
export interface AppSetting {
  key: string;
  value: string;
  label: string;
  category: string;
  value_type: string;
  description: string;
}

// ── WebSocket ──
export interface WSMetricsMessage {
  type: 'metrics';
  server_id: number;
  server_name: string;
  status: ServerStatus;
  data: {
    cpu_usage_pct?: number;
    mem_usage_pct?: number;
    disk_max_pct?: number;
    net_connections?: number;
    process_count?: number;
  };
  timestamp: string;
}

export interface WSAlertMessage {
  type: 'alert_fired' | 'alert_resolved';
  alert_id: number;
  server_id: number;
  server_name: string;
  severity?: string;
  message: string;
  timestamp: string;
}

export interface WSStatusMessage {
  type: 'status_change';
  server_id: number;
  server_name: string;
  old_status: ServerStatus;
  new_status: ServerStatus;
  timestamp: string;
}

export type WSMessage = WSMetricsMessage | WSAlertMessage | WSStatusMessage;

// ── 디스크 ──
export interface DiskInfo {
  mount?: string;
  DeviceID?: string;
  total_gb: number;
  used_gb: number;
  free_gb: number;
  usage_pct: number;
}

// ── 페이지네이션 ──
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
}
