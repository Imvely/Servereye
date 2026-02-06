import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Server,
  Monitor,
  Bell,
  Search,
  LayoutGrid,
  List,
  Cpu,
  Activity,
  AlertTriangle,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { useDashboardStore } from '../stores/dashboardStore';
import { useWebSocket } from '../api/websocket';
import apiClient from '../api/client';
import type {
  DashboardSummary,
  ServerSummary,
  ActiveAlert,
  WSMessage,
  ServerStatus,
} from '../types';
import { STATUS_COLORS, STATUS_LABELS, SEVERITY_COLORS } from '../utils/constants';
import { formatPercent, formatRelative, formatDuration } from '../utils/format';
import Card from '../components/ui/Card';
import StatusBadge from '../components/common/StatusBadge';
import Badge from '../components/ui/Badge';

// ── Mini Gauge (horizontal bar) ──
function MiniGauge({ label, value, color }: { label: string; value: number | null; color: string }) {
  const pct = value ?? 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-8 text-gray-500 dark:text-gray-400 shrink-0">{label}</span>
      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
        <div className="h-full rounded-full transition-all duration-300" style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: color }} />
      </div>
      <span className="w-10 text-right text-gray-700 dark:text-gray-300 font-medium tabular-nums">
        {value != null ? `${pct.toFixed(0)}%` : '-'}
      </span>
    </div>
  );
}

function getGaugeColor(pct: number | null): string {
  if (pct == null) return '#D1D5DB';
  if (pct >= 90) return '#EF4444';
  if (pct >= 70) return '#F59E0B';
  return '#10B981';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const {
    servers,
    alerts,
    summary,
    setServers,
    setSummary,
    setAlerts,
    updateServerMetrics,
    addAlert,
    removeAlert,
  } = useDashboardStore();

  const [viewMode, setViewMode] = useState<'card' | 'table'>('card');
  const [searchQuery, setSearchQuery] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);

  // ── Initial data load ──
  useEffect(() => {
    let cancelled = false;

    async function fetchData() {
      try {
        const [summaryRes, serversRes, alertsRes] = await Promise.all([
          apiClient.get<DashboardSummary>('/dashboard/summary'),
          apiClient.get<{ items: ServerSummary[] }>('/servers', { params: { size: 200 } }),
          apiClient.get<ActiveAlert[]>('/alerts/active'),
        ]);
        if (!cancelled) {
          setSummary(summaryRes.data);
          setServers(serversRes.data.items);
          setAlerts(alertsRes.data);
        }
      } catch (err) {
        console.error('Dashboard data load failed:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchData();
    return () => { cancelled = true; };
  }, [setSummary, setServers, setAlerts]);

  // ── WebSocket for real-time updates ──
  const handleWsMessage = useCallback(
    (msg: WSMessage) => {
      if (msg.type === 'metrics') {
        updateServerMetrics(msg.server_id, {
          cpu_usage_pct: msg.data.cpu_usage_pct,
          mem_usage_pct: msg.data.mem_usage_pct,
          disk_max_pct: msg.data.disk_max_pct,
          status: msg.status,
        });
      } else if (msg.type === 'alert_fired') {
        addAlert({
          alert_id: msg.alert_id,
          server_id: msg.server_id,
          server_name: msg.server_name,
          severity: (msg.severity as 'warning' | 'critical') || 'warning',
          message: msg.message,
          acknowledged: false,
          created_at: msg.timestamp,
          duration_seconds: 0,
        });
      } else if (msg.type === 'alert_resolved') {
        removeAlert(msg.alert_id);
      } else if (msg.type === 'status_change') {
        updateServerMetrics(msg.server_id, {
          status: msg.new_status,
        });
      }
    },
    [updateServerMetrics, addAlert, removeAlert],
  );

  useWebSocket('/ws/dashboard', handleWsMessage, true);

  // ── Derived data ──
  const serverList = useMemo(() => Array.from(servers.values()), [servers]);

  const groups = useMemo(
    () => [...new Set(serverList.map((s) => s.group_name).filter(Boolean))].sort(),
    [serverList],
  );

  const filteredServers = useMemo(() => {
    return serverList.filter((s) => {
      if (groupFilter && s.group_name !== groupFilter) return false;
      if (statusFilter && s.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !s.display_name.toLowerCase().includes(q) &&
          !s.ip_address.toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [serverList, groupFilter, statusFilter, searchQuery]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-indigo-600 border-t-transparent" />
          <span className="text-sm text-gray-500 dark:text-gray-400">데이터 로딩 중...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Infra Summary Bar ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
        <SummaryCard
          icon={<Server size={18} />}
          label="전체 서버"
          value={summary?.total_servers ?? 0}
        />
        {(['online', 'warning', 'critical', 'offline'] as ServerStatus[]).map((status) => (
          <SummaryCard
            key={status}
            icon={<span className={`w-2.5 h-2.5 rounded-full ${STATUS_COLORS[status].dot}`} />}
            label={STATUS_LABELS[status]}
            value={summary?.status_counts?.[status as keyof DashboardSummary['status_counts']] ?? 0}
          />
        ))}
        <SummaryCard
          icon={<Cpu size={18} className="text-indigo-500" />}
          label="평균 CPU/MEM"
          value={`${formatPercent(summary?.avg_cpu)} / ${formatPercent(summary?.avg_mem)}`}
          isText
        />
        <SummaryCard
          icon={<Bell size={18} className="text-amber-500" />}
          label="오늘 알림"
          value={summary?.today_alert_count ?? 0}
          highlight={!!summary?.today_alert_count && summary.today_alert_count > 0}
        />
      </div>

      {/* ── Filter Bar ── */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Group filter */}
        <select
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value)}
          className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">전체 그룹</option>
          {groups.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-9 px-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <option value="">전체 상태</option>
          {Object.entries(STATUS_LABELS).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="서버 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-full pl-9 pr-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 dark:text-gray-100 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        {/* View toggle */}
        <div className="ml-auto flex items-center border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
          <button
            onClick={() => setViewMode('card')}
            className={`p-2 ${viewMode === 'card' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <LayoutGrid size={16} />
          </button>
          <button
            onClick={() => setViewMode('table')}
            className={`p-2 ${viewMode === 'table' ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700'}`}
          >
            <List size={16} />
          </button>
        </div>
      </div>

      {/* ── Server Grid / Table ── */}
      {filteredServers.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-gray-500">
          <Monitor size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">표시할 서버가 없습니다.</p>
        </div>
      ) : viewMode === 'card' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredServers.map((s) => (
            <Card
              key={s.server_id}
              hoverable
              onClick={() => navigate(`/servers/${s.server_id}`)}
              className="relative"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-3">
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                    {s.display_name}
                  </h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{s.ip_address}</p>
                </div>
                <StatusBadge status={s.status} />
              </div>

              {/* Gauges */}
              <div className="space-y-2 mb-3">
                <MiniGauge label="CPU" value={s.cpu_usage_pct} color={getGaugeColor(s.cpu_usage_pct)} />
                <MiniGauge label="MEM" value={s.mem_usage_pct} color={getGaugeColor(s.mem_usage_pct)} />
                <MiniGauge label="DISK" value={s.disk_max_pct} color={getGaugeColor(s.disk_max_pct)} />
              </div>

              {/* Sparkline placeholder */}
              <div className="h-8 bg-gray-50 dark:bg-gray-700 rounded-md flex items-center justify-center">
                <Activity size={14} className="text-gray-300 dark:text-gray-600" />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <span className="text-[11px] text-gray-400 dark:text-gray-500 flex items-center gap-1">
                  <Clock size={11} />
                  {s.last_collected_at ? formatRelative(s.last_collected_at) : '-'}
                </span>
                {s.active_alerts > 0 && (
                  <Badge color="red">
                    <Bell size={11} className="mr-1" />
                    {s.active_alerts}
                  </Badge>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <div className="overflow-x-auto bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-700 text-left">
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">서버명</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">IP</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">상태</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">CPU</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">MEM</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">DISK</th>
                <th className="px-4 py-3 font-medium text-gray-500 dark:text-gray-400">마지막 수집</th>
              </tr>
            </thead>
            <tbody>
              {filteredServers.map((s) => (
                <tr
                  key={s.server_id}
                  className="border-b border-gray-50 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer transition-colors"
                  onClick={() => navigate(`/servers/${s.server_id}`)}
                >
                  <td className="px-4 py-3 font-medium text-gray-900 dark:text-white">{s.display_name}</td>
                  <td className="px-4 py-3 text-gray-600 dark:text-gray-300">{s.ip_address}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={s.status} />
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatPercent(s.cpu_usage_pct)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatPercent(s.mem_usage_pct)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatPercent(s.disk_max_pct)}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {s.last_collected_at ? formatRelative(s.last_collected_at) : '-'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Recent Alerts Panel ── */}
      {alerts.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Bell size={16} className="text-amber-500" />
              최근 알림
            </h2>
            <button
              onClick={() => navigate('/alerts')}
              className="text-xs text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 font-medium flex items-center gap-0.5"
            >
              전체 보기 <ChevronRight size={14} />
            </button>
          </div>

          <div className="space-y-2">
            {alerts.slice(0, 5).map((alert) => {
              const severityStyle =
                SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS] ||
                SEVERITY_COLORS.warning;
              return (
                <div
                  key={alert.alert_id}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg border-l-4 ${severityStyle.bg} ${severityStyle.border}`}
                >
                  <AlertTriangle size={16} className={severityStyle.text} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-900 dark:text-white truncate">{alert.message}</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                      {alert.server_name} &middot; {formatRelative(alert.created_at)}
                      {alert.duration_seconds > 0 && ` &middot; ${formatDuration(alert.duration_seconds)}`}
                    </p>
                  </div>
                  <Badge color={alert.severity === 'critical' ? 'red' : 'amber'}>
                    {alert.severity === 'critical' ? '위험' : '경고'}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Summary Card Sub-component ──
function SummaryCard({
  icon,
  label,
  value,
  highlight = false,
  isText = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  highlight?: boolean;
  isText?: boolean;
}) {
  return (
    <div className={`flex items-center gap-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 ${highlight ? 'ring-1 ring-amber-300 dark:ring-amber-500' : ''}`}>
      <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-gray-50 dark:bg-gray-700">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[11px] text-gray-500 dark:text-gray-400 truncate">{label}</p>
        <p className={`font-semibold truncate ${isText ? 'text-xs' : 'text-lg'} ${highlight ? 'text-amber-600 dark:text-amber-500' : 'text-gray-900 dark:text-white'}`}>
          {value}
        </p>
      </div>
    </div>
  );
}
