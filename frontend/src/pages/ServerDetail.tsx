import { useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Cpu,
  HardDrive,
  Activity,
  Wifi,
  Settings,
  FileText,
  Heart,
  RefreshCw,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  MemoryStick,
  Search,
} from 'lucide-react';
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useServer } from '../api/hooks/useServers';
import { useLatestMetrics, useMetricHistory } from '../api/hooks/useMetrics';
import { useActiveAlerts } from '../api/hooks/useAlerts';
import { useHealthChecks } from '../api/hooks/useHealthChecks';
import { useWebSocket } from '../api/websocket';
import apiClient from '../api/client';
import type {
  MetricLatest,
  MetricHistory,
  DiskInfo,
  ProcessInfo,
  ServiceInfo,
  ServerLogEntry,
  WSMessage,
  ActiveAlert,
  HealthCheck,
} from '../types';
import { TIME_RANGES, CHART_COLORS, SEVERITY_COLORS } from '../utils/constants';
import {
  formatPercent,
  formatBytes,
  formatBytesGB,
  formatUptime,
  formatDateTime,
  formatTime,
  formatRelative,
  formatNumber,
  getGaugeColor,
} from '../utils/format';
import Card, { CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import StatusBadge from '../components/common/StatusBadge';

// Tab definitions
const TABS = [
  { key: 'overview', label: '개요', icon: <Activity size={15} /> },
  { key: 'cpu', label: 'CPU', icon: <Cpu size={15} /> },
  { key: 'memory', label: '메모리', icon: <MemoryStick size={15} /> },
  { key: 'disk', label: '디스크', icon: <HardDrive size={15} /> },
  { key: 'network', label: '네트워크', icon: <Wifi size={15} /> },
  { key: 'service', label: '서비스', icon: <Settings size={15} /> },
  { key: 'process', label: '프로세스', icon: <Activity size={15} /> },
  { key: 'log', label: '로그', icon: <FileText size={15} /> },
  { key: 'healthcheck', label: '헬스체크', icon: <Heart size={15} /> },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export default function ServerDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const serverId = id ? Number(id) : undefined;

  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [timeRange, setTimeRange] = useState('1h');

  // ── Data hooks ──
  const { data: server, isLoading: serverLoading } = useServer(serverId);
  const { data: latest, refetch: refetchMetrics } = useLatestMetrics(serverId);
  const { data: history } = useMetricHistory(serverId, { range: timeRange });
  const { data: activeAlerts } = useActiveAlerts();
  const { data: healthChecks } = useHealthChecks(serverId);

  // Server-specific alerts
  const serverAlerts = useMemo(
    () => (activeAlerts ?? []).filter((a) => a.server_id === serverId),
    [activeAlerts, serverId],
  );

  // ── Extra data loaded on-demand ──
  const [processes, setProcesses] = useState<ProcessInfo[]>([]);
  const [services, setServices] = useState<ServiceInfo[]>([]);
  const [logs, setLogs] = useState<ServerLogEntry[]>([]);
  const [processSort, setProcessSort] = useState<{ key: keyof ProcessInfo; dir: 'asc' | 'desc' }>({ key: 'cpu_pct', dir: 'desc' });
  const [logFilter, setLogFilter] = useState({ level: '', search: '' });
  const [loadingExtra, setLoadingExtra] = useState(false);

  // Load extra data when tab changes
  const loadTabData = useCallback(
    async (tab: TabKey) => {
      if (!serverId) return;
      setLoadingExtra(true);
      try {
        if (tab === 'process') {
          const { data } = await apiClient.get<{ processes: ProcessInfo[] }>(`/servers/${serverId}/processes`);
          setProcesses(data.processes);
        } else if (tab === 'service') {
          const { data } = await apiClient.get<{ services: ServiceInfo[] }>(`/servers/${serverId}/services`);
          setServices(data.services);
        } else if (tab === 'log') {
          const { data } = await apiClient.get<ServerLogEntry[]>(`/servers/${serverId}/logs`, {
            params: { limit: 200 },
          });
          setLogs(data);
        }
      } catch (err) {
        console.error('Failed to load tab data:', err);
      } finally {
        setLoadingExtra(false);
      }
    },
    [serverId],
  );

  const handleTabChange = (tab: TabKey) => {
    setActiveTab(tab);
    if (['process', 'service', 'log'].includes(tab)) {
      loadTabData(tab);
    }
  };

  // ── WebSocket ──
  const handleWsMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.type === 'metrics' && msg.server_id === serverId) {
        refetchMetrics();
      }
    },
    [serverId, refetchMetrics],
  );

  useWebSocket(`/ws/server/${serverId}`, handleWsMessage, !!serverId);

  // ── Parse disk_json ──
  const disks: DiskInfo[] = useMemo(() => {
    if (!latest?.disk_json) return [];
    try {
      return JSON.parse(latest.disk_json);
    } catch {
      return [];
    }
  }, [latest?.disk_json]);

  // ── Sorted processes ──
  const sortedProcesses = useMemo(() => {
    const sorted = [...processes].sort((a, b) => {
      const aVal = a[processSort.key];
      const bVal = b[processSort.key];
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return processSort.dir === 'asc' ? aVal - bVal : bVal - aVal;
      }
      return processSort.dir === 'asc'
        ? String(aVal).localeCompare(String(bVal))
        : String(bVal).localeCompare(String(aVal));
    });
    return sorted;
  }, [processes, processSort]);

  // ── Filtered logs ──
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (logFilter.level && log.log_level !== logFilter.level) return false;
      if (logFilter.search && !log.message.toLowerCase().includes(logFilter.search.toLowerCase())) return false;
      return true;
    });
  }, [logs, logFilter]);

  if (serverLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
      </div>
    );
  }

  if (!server) {
    return (
      <div className="text-center py-20 text-gray-500 dark:text-gray-400">
        <p>서버를 찾을 수 없습니다.</p>
        <Button variant="secondary" className="mt-4" onClick={() => navigate('/servers')}>
          목록으로 돌아가기
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="sm"
          iconOnly
          icon={<ChevronLeft size={18} />}
          onClick={() => navigate(-1)}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">{server.display_name}</h1>
            <StatusBadge status={server.status} />
          </div>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {server.ip_address}
            {server.os_version && ` / ${server.os_type} ${server.os_version}`}
            {server.cpu_model && ` / ${server.cpu_model} (${server.cpu_cores}C)`}
            {server.total_memory_mb != null && ` / ${formatBytes(server.total_memory_mb)} RAM`}
          </p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<RefreshCw size={14} />}
          onClick={() => refetchMetrics()}
        >
          새로고침
        </Button>
      </div>

      {/* ── Tab Navigation ── */}
      <div className="flex gap-1 border-b border-gray-200 dark:border-gray-700 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => handleTabChange(tab.key)}
            className={`inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors duration-150 whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-indigo-600 text-indigo-700 dark:text-indigo-400'
                : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Time Range Selector ── */}
      {['overview', 'cpu', 'memory', 'disk', 'network'].includes(activeTab) && (
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-gray-400 dark:text-gray-500" />
          <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-0.5">
            {TIME_RANGES.map((tr) => (
              <button
                key={tr.value}
                onClick={() => setTimeRange(tr.value)}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  timeRange === tr.value
                    ? 'bg-white dark:bg-gray-700 text-indigo-700 dark:text-indigo-400 shadow-sm'
                    : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
              >
                {tr.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── Tab Content ── */}
      {activeTab === 'overview' && (
        <OverviewTab latest={latest} history={history} alerts={serverAlerts} disks={disks} />
      )}
      {activeTab === 'cpu' && <CpuTab latest={latest} history={history} />}
      {activeTab === 'memory' && <MemoryTab latest={latest} history={history} />}
      {activeTab === 'disk' && <DiskTab latest={latest} disks={disks} history={history} />}
      {activeTab === 'network' && <NetworkTab latest={latest} history={history} />}
      {activeTab === 'service' && <ServiceTab services={services} loading={loadingExtra} />}
      {activeTab === 'process' && (
        <ProcessTab
          processes={sortedProcesses}
          loading={loadingExtra}
          sort={processSort}
          onSort={(key) =>
            setProcessSort((prev) => ({
              key,
              dir: prev.key === key && prev.dir === 'desc' ? 'asc' : 'desc',
            }))
          }
        />
      )}
      {activeTab === 'log' && (
        <LogTab logs={filteredLogs} loading={loadingExtra} filter={logFilter} onFilterChange={setLogFilter} />
      )}
      {activeTab === 'healthcheck' && <HealthCheckTab checks={healthChecks ?? []} />}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Overview Tab
// ─────────────────────────────────────────────────
function OverviewTab({
  latest,
  history,
  alerts,
  disks,
}: {
  latest?: MetricLatest;
  history?: MetricHistory[];
  alerts: ActiveAlert[];
  disks: DiskInfo[];
}) {
  const maxDisk = disks.length > 0 ? Math.max(...disks.map((d) => d.usage_pct)) : null;

  return (
    <div className="space-y-6">
      {/* Metric cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          label="CPU 사용률"
          value={formatPercent(latest?.cpu_usage_pct)}
          sub={latest?.cpu_load_1m != null ? `Load: ${latest.cpu_load_1m.toFixed(2)}` : undefined}
          color={getGaugeColor(latest?.cpu_usage_pct ?? 0)}
          pct={latest?.cpu_usage_pct}
          icon={<Cpu size={18} />}
        />
        <MetricCard
          label="메모리 사용률"
          value={formatPercent(latest?.mem_usage_pct)}
          sub={
            latest?.mem_total_mb != null && latest?.mem_used_mb != null
              ? `${formatBytes(latest.mem_used_mb)} / ${formatBytes(latest.mem_total_mb)}`
              : undefined
          }
          color={getGaugeColor(latest?.mem_usage_pct ?? 0)}
          pct={latest?.mem_usage_pct}
          icon={<MemoryStick size={18} />}
        />
        <MetricCard
          label="디스크 최대"
          value={formatPercent(maxDisk)}
          sub={disks.length > 0 ? `${disks.length}개 파티션` : undefined}
          color={getGaugeColor(maxDisk ?? 0)}
          pct={maxDisk}
          icon={<HardDrive size={18} />}
        />
        <MetricCard
          label="네트워크"
          value={latest?.net_connections != null ? `${formatNumber(latest.net_connections)}` : '-'}
          sub={latest?.uptime_seconds != null ? `Uptime: ${formatUptime(latest.uptime_seconds)}` : undefined}
          color="#6366F1"
          icon={<Wifi size={18} />}
        />
      </div>

      {/* Chart */}
      {history && history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>CPU / 메모리 추이</CardTitle></CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="time" tickFormatter={(v) => formatTime(v)} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    labelFormatter={(v) => formatDateTime(v as string)}
                    formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`]}
                  />
                  <Area type="monotone" dataKey="cpu" name="CPU" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primaryFill} />
                  <Area type="monotone" dataKey="mem" name="MEM" stroke={CHART_COLORS.warning} fill="rgba(245, 158, 11, 0.1)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent alerts */}
      {alerts.length > 0 && (
        <Card>
          <CardHeader><CardTitle>활성 알림 ({alerts.length})</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-2">
              {alerts.slice(0, 5).map((a) => {
                const style = SEVERITY_COLORS[a.severity as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.warning;
                return (
                  <div key={a.alert_id} className={`flex items-center gap-3 px-3 py-2 rounded-lg border-l-4 ${style.bg} ${style.border}`}>
                    <AlertTriangle size={14} className={style.text} />
                    <span className="text-sm text-gray-800 dark:text-gray-200 flex-1 truncate">{a.message}</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">{formatRelative(a.created_at)}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── Metric Card ──
function MetricCard({
  label,
  value,
  sub,
  color,
  pct,
  icon,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
  pct?: number | null;
  icon: React.ReactNode;
}) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-9 h-9 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${color}15` }}>
          <span style={{ color }}>{icon}</span>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">{label}</span>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{sub}</p>}
      {pct != null && (
        <div className="mt-3 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }}
          />
        </div>
      )}
    </Card>
  );
}

// ─────────────────────────────────────────────────
// CPU Tab
// ─────────────────────────────────────────────────
function CpuTab({ latest, history }: { latest?: MetricLatest; history?: MetricHistory[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoBox label="사용률" value={formatPercent(latest?.cpu_usage_pct)} />
        <InfoBox label="Load 1m" value={latest?.cpu_load_1m?.toFixed(2) ?? '-'} />
        <InfoBox label="Load 5m" value={latest?.cpu_load_5m?.toFixed(2) ?? '-'} />
        <InfoBox label="Load 15m" value={latest?.cpu_load_15m?.toFixed(2) ?? '-'} />
      </div>

      {history && history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>CPU 사용률 추이</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="time" tickFormatter={(v) => formatTime(v)} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip labelFormatter={(v) => formatDateTime(v as string)} formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`]} />
                  <Line type="monotone" dataKey="cpu" name="CPU" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Memory Tab
// ─────────────────────────────────────────────────
function MemoryTab({ latest, history }: { latest?: MetricLatest; history?: MetricHistory[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoBox label="사용률" value={formatPercent(latest?.mem_usage_pct)} />
        <InfoBox label="사용 중" value={formatBytes(latest?.mem_used_mb)} />
        <InfoBox label="전체" value={formatBytes(latest?.mem_total_mb)} />
        <InfoBox label="Swap" value={`${formatBytes(latest?.swap_used_mb)} / ${formatBytes(latest?.swap_total_mb)}`} />
      </div>

      {history && history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>메모리 사용률 추이</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="time" tickFormatter={(v) => formatTime(v)} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                  <Tooltip labelFormatter={(v) => formatDateTime(v as string)} formatter={(value: number | undefined) => [`${(value ?? 0).toFixed(1)}%`]} />
                  <Area type="monotone" dataKey="mem" name="메모리" stroke={CHART_COLORS.warning} fill="rgba(245, 158, 11, 0.1)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Disk Tab
// ─────────────────────────────────────────────────
function DiskTab({
  latest,
  disks,
  history,
}: {
  latest?: MetricLatest;
  disks: DiskInfo[];
  history?: MetricHistory[];
}) {
  return (
    <div className="space-y-6">
      {/* Partition usage bars */}
      {disks.length > 0 && (
        <Card>
          <CardHeader><CardTitle>파티션 사용률</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {disks.map((d, i) => (
                <div key={i}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      {d.mount || d.DeviceID || `Disk ${i + 1}`}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      {formatBytesGB(d.used_gb)} / {formatBytesGB(d.total_gb)} ({d.usage_pct.toFixed(1)}%)
                    </span>
                  </div>
                  <div className="h-3 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(d.usage_pct, 100)}%`,
                        backgroundColor: getGaugeColor(d.usage_pct),
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* I/O chart */}
      {history && history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>디스크 I/O</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <InfoBox label="Read" value={`${latest?.disk_read_mbps?.toFixed(2) ?? '-'} MB/s`} />
              <InfoBox label="Write" value={`${latest?.disk_write_mbps?.toFixed(2) ?? '-'} MB/s`} />
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="time" tickFormatter={(v) => formatTime(v)} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v} MB/s`} />
                  <Tooltip labelFormatter={(v) => formatDateTime(v as string)} />
                  <Line type="monotone" dataKey="disk_read" name="Read" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="disk_write" name="Write" stroke={CHART_COLORS.danger} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Network Tab
// ─────────────────────────────────────────────────
function NetworkTab({ latest, history }: { latest?: MetricLatest; history?: MetricHistory[] }) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <InfoBox label="연결 수" value={formatNumber(latest?.net_connections)} />
        <InfoBox label="프로세스 수" value={formatNumber(latest?.process_count)} />
        <InfoBox label="Uptime" value={formatUptime(latest?.uptime_seconds)} />
      </div>

      {history && history.length > 0 && (
        <Card>
          <CardHeader><CardTitle>네트워크 In/Out</CardTitle></CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={history}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.grid} />
                  <XAxis dataKey="time" tickFormatter={(v) => formatTime(v)} tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip labelFormatter={(v) => formatDateTime(v as string)} />
                  <Area type="monotone" dataKey="net_in" name="In" stroke={CHART_COLORS.success} fill="rgba(16, 185, 129, 0.1)" strokeWidth={2} />
                  <Area type="monotone" dataKey="net_out" name="Out" stroke={CHART_COLORS.primary} fill={CHART_COLORS.primaryFill} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────
// Service Tab
// ─────────────────────────────────────────────────
function ServiceTab({ services, loading }: { services: ServiceInfo[]; loading: boolean }) {
  if (loading) return <LoadingSpinner />;

  return (
    <Card>
      <CardHeader><CardTitle>서비스 목록 ({services.length})</CardTitle></CardHeader>
      <CardContent>
        {services.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">서비스 정보가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">서비스명</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">표시 이름</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">상태</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">시작 유형</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">PID</th>
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">메모리</th>
                </tr>
              </thead>
              <tbody>
                {services.map((svc, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-3 py-2 font-mono text-xs">{svc.service_name}</td>
                    <td className="px-3 py-2 text-gray-700 dark:text-gray-300">{svc.display_name}</td>
                    <td className="px-3 py-2">
                      <Badge color={svc.status === 'Running' || svc.status === 'running' ? 'emerald' : 'gray'}>
                        {svc.status}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{svc.start_type}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums">{svc.pid ?? '-'}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400 tabular-nums">{svc.mem_mb != null ? formatBytes(svc.mem_mb) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────
// Process Tab
// ─────────────────────────────────────────────────
function ProcessTab({
  processes,
  loading,
  sort,
  onSort,
}: {
  processes: ProcessInfo[];
  loading: boolean;
  sort: { key: keyof ProcessInfo; dir: 'asc' | 'desc' };
  onSort: (key: keyof ProcessInfo) => void;
}) {
  if (loading) return <LoadingSpinner />;

  const sortIcon = (key: keyof ProcessInfo) => {
    if (sort.key !== key) return null;
    return sort.dir === 'asc' ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />;
  };

  const thBtn = (key: keyof ProcessInfo, label: string) => (
    <th
      className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-300 select-none"
      onClick={() => onSort(key)}
    >
      <span className="inline-flex items-center gap-1">
        {label} {sortIcon(key)}
      </span>
    </th>
  );

  return (
    <Card>
      <CardHeader><CardTitle>프로세스 목록 ({processes.length})</CardTitle></CardHeader>
      <CardContent>
        {processes.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">프로세스 정보가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-white dark:bg-gray-800">
                <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                  {thBtn('pid', 'PID')}
                  {thBtn('name', '이름')}
                  {thBtn('username', '사용자')}
                  {thBtn('cpu_pct', 'CPU%')}
                  {thBtn('mem_pct', 'MEM%')}
                  {thBtn('mem_mb', 'MEM(MB)')}
                  {thBtn('thread_count', '스레드')}
                  <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">상태</th>
                </tr>
              </thead>
              <tbody>
                {processes.map((p, i) => (
                  <tr key={i} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                    <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">{p.pid}</td>
                    <td className="px-3 py-2 font-medium text-gray-900 dark:text-gray-100 max-w-[200px] truncate">{p.name}</td>
                    <td className="px-3 py-2 text-gray-500 dark:text-gray-400">{p.username}</td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: getGaugeColor(p.cpu_pct) }}>
                      {p.cpu_pct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 tabular-nums" style={{ color: getGaugeColor(p.mem_pct) }}>
                      {p.mem_pct.toFixed(1)}%
                    </td>
                    <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">{formatBytes(p.mem_mb)}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-500 dark:text-gray-400">{p.thread_count}</td>
                    <td className="px-3 py-2">
                      <Badge color={p.status === 'running' ? 'emerald' : 'gray'}>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─────────────────────────────────────────────────
// Log Tab
// ─────────────────────────────────────────────────
function LogTab({
  logs,
  loading,
  filter,
  onFilterChange,
}: {
  logs: ServerLogEntry[];
  loading: boolean;
  filter: { level: string; search: string };
  onFilterChange: (f: { level: string; search: string }) => void;
}) {
  const levelColors: Record<string, string> = {
    error: 'text-red-600 bg-red-50',
    warning: 'text-amber-600 bg-amber-50',
    info: 'text-blue-600 bg-blue-50',
    debug: 'text-gray-500 bg-gray-50',
  };

  if (loading) return <LoadingSpinner />;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <select
          value={filter.level}
          onChange={(e) => onFilterChange({ ...filter, level: e.target.value })}
          className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">전체 레벨</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>
        <div className="relative flex-1 max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="로그 검색..."
            value={filter.search}
            onChange={(e) => onFilterChange({ ...filter, search: e.target.value })}
            className="h-9 w-full pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      <Card>
        <CardContent>
          {logs.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">로그가 없습니다.</p>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-white dark:bg-gray-800">
                  <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                    <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-36">시간</th>
                    <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-20">레벨</th>
                    <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400 w-24">소스</th>
                    <th className="px-3 py-2 font-medium text-gray-500 dark:text-gray-400">메시지</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-gray-50 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400 tabular-nums whitespace-nowrap">
                        {formatDateTime(log.occurred_at)}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${levelColors[log.log_level.toLowerCase()] || 'text-gray-500 bg-gray-50'}`}>
                          {log.log_level}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-500 dark:text-gray-400">{log.log_source}</td>
                      <td className="px-3 py-2 text-gray-700 dark:text-gray-300 max-w-[500px] truncate">{log.message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────
// HealthCheck Tab
// ─────────────────────────────────────────────────
function HealthCheckTab({ checks }: { checks: HealthCheck[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>헬스체크 ({checks.length})</CardTitle></CardHeader>
      <CardContent>
        {checks.length === 0 ? (
          <p className="text-sm text-gray-400 dark:text-gray-500 py-8 text-center">등록된 헬스체크가 없습니다.</p>
        ) : (
          <div className="space-y-3">
            {checks.map((check) => (
              <div
                key={check.check_id}
                className={`flex items-center gap-4 p-4 rounded-lg border ${
                  check.latest_result?.is_healthy ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20' : 'border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/20'
                }`}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                  check.latest_result?.is_healthy ? 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400' : 'bg-red-100 dark:bg-red-900/50 text-red-600 dark:text-red-400'
                }`}>
                  <Heart size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                    {check.check_name || check.target}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                    {check.check_type.toUpperCase()} &middot; {check.target}
                    {!check.is_enabled && ' (비활성)'}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  {check.latest_result ? (
                    <>
                      <Badge color={check.latest_result.is_healthy ? 'emerald' : 'red'}>
                        {check.latest_result.is_healthy ? '정상' : '실패'}
                      </Badge>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {check.latest_result.response_ms}ms &middot; {formatRelative(check.latest_result.checked_at)}
                      </p>
                      {check.latest_result.error_message && (
                        <p className="text-xs text-red-500 dark:text-red-400 mt-0.5 max-w-[200px] truncate">
                          {check.latest_result.error_message}
                        </p>
                      )}
                    </>
                  ) : (
                    <Badge color="gray">미확인</Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Shared helpers ──
function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{label}</p>
      <p className="text-lg font-semibold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center py-16">
      <div className="animate-spin rounded-full h-6 w-6 border-2 border-indigo-600 border-t-transparent" />
    </div>
  );
}
