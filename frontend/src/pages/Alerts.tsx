import { useState, useMemo } from 'react';
import {
  Bell,
  AlertTriangle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Check,
  CheckCheck,
  XCircle,
  Loader2,
} from 'lucide-react';
import {
  useAlerts,
  useAcknowledgeAlert,
  useResolveAlert,
  useAcknowledgeAll,
} from '../api/hooks/useAlerts';
import type { AlertListParams } from '../api/hooks/useAlerts';
import type { ActiveAlert } from '../types';
import { SEVERITY_COLORS, METRIC_LABELS } from '../utils/constants';
import { formatDateTime, formatDuration, formatPercent } from '../utils/format';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import DateRangePicker from '../components/ui/DateRangePicker';
import toast from '../components/ui/Toast';

export default function Alerts() {
  // ── Filters ──
  const [page, setPage] = useState(1);
  const [severity, setSeverity] = useState('');
  const [serverId, setServerId] = useState('');
  const [acknowledged, setAcknowledged] = useState<string>('');
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);

  const params: AlertListParams = useMemo(
    () => ({
      page,
      size: 20,
      severity: severity || undefined,
      server_id: serverId ? Number(serverId) : undefined,
      acknowledged: acknowledged === '' ? undefined : acknowledged === 'true',
      from: startDate ? startDate.toISOString() : undefined,
      to: endDate ? endDate.toISOString() : undefined,
    }),
    [page, severity, serverId, acknowledged, startDate, endDate],
  );

  const { data, isLoading } = useAlerts(params);
  const acknowledgeAlert = useAcknowledgeAlert();
  const resolveAlert = useResolveAlert();
  const acknowledgeAll = useAcknowledgeAll();

  const alerts = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  // ── Handlers ──
  const handleAcknowledge = async (alertId: number) => {
    try {
      await acknowledgeAlert.mutateAsync(alertId);
      toast.success('알림이 확인 처리되었습니다.');
    } catch {
      toast.error('확인 처리에 실패했습니다.');
    }
  };

  const handleResolve = async (alertId: number) => {
    try {
      await resolveAlert.mutateAsync(alertId);
      toast.success('알림이 해결 처리되었습니다.');
    } catch {
      toast.error('해결 처리에 실패했습니다.');
    }
  };

  const handleAcknowledgeAll = async () => {
    if (!confirm('모든 미확인 알림을 확인 처리하시겠습니까?')) return;
    try {
      await acknowledgeAll.mutateAsync();
      toast.success('모든 알림이 확인 처리되었습니다.');
    } catch {
      toast.error('전체 확인 처리에 실패했습니다.');
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Bell size={22} className="text-indigo-600 dark:text-indigo-400" />
          알림
        </h1>
        <Button
          variant="secondary"
          icon={<CheckCheck size={16} />}
          onClick={handleAcknowledgeAll}
          disabled={acknowledgeAll.isPending}
        >
          {acknowledgeAll.isPending ? '처리 중...' : '전체 확인'}
        </Button>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={severity}
          onChange={(e) => { setSeverity(e.target.value); setPage(1); }}
          className="h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
        >
          <option value="">전체 심각도</option>
          <option value="critical">위험</option>
          <option value="warning">경고</option>
        </select>

        <select
          value={acknowledged}
          onChange={(e) => { setAcknowledged(e.target.value); setPage(1); }}
          className="h-9 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
        >
          <option value="">전체 상태</option>
          <option value="false">미확인</option>
          <option value="true">확인됨</option>
        </select>

        <input
          type="number"
          placeholder="서버 ID"
          value={serverId}
          onChange={(e) => { setServerId(e.target.value); setPage(1); }}
          className="h-9 w-28 px-3 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200 dark:placeholder:text-gray-500"
        />

        <DateRangePicker
          startDate={startDate}
          endDate={endDate}
          onChange={({ start, end }) => {
            setStartDate(start);
            setEndDate(end);
            setPage(1);
          }}
        />
      </div>

      {/* ── Alert List ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={24} className="animate-spin text-gray-400" />
        </div>
      ) : alerts.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 size={40} className="mx-auto mb-3 opacity-40" />
          <p className="text-sm">알림이 없습니다.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => (
            <AlertCard
              key={alert.alert_id}
              alert={alert}
              onAcknowledge={handleAcknowledge}
              onResolve={handleResolve}
              isAcknowledging={acknowledgeAlert.isPending}
              isResolving={resolveAlert.isPending}
            />
          ))}
        </div>
      )}

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            총 {total}개 중 {(page - 1) * 20 + 1}-{Math.min(page * 20, total)}
          </span>
          <div className="inline-flex items-center gap-1">
            <Button
              variant="secondary"
              size="sm"
              iconOnly
              icon={<ChevronLeft size={16} />}
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            />
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (page <= 4) {
                pageNum = i + 1;
              } else if (page >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = page - 3 + i;
              }
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`h-8 w-8 text-sm rounded-lg font-medium transition-colors ${
                    page === pageNum
                      ? 'bg-indigo-600 text-white'
                      : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-700'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            <Button
              variant="secondary"
              size="sm"
              iconOnly
              icon={<ChevronRight size={16} />}
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ── Alert Card ──
function AlertCard({
  alert,
  onAcknowledge,
  onResolve,
  isAcknowledging,
  isResolving,
}: {
  alert: ActiveAlert;
  onAcknowledge: (id: number) => void;
  onResolve: (id: number) => void;
  isAcknowledging: boolean;
  isResolving: boolean;
}) {
  const severityStyle =
    SEVERITY_COLORS[alert.severity as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.warning;
  const metricLabel = alert.metric_name ? METRIC_LABELS[alert.metric_name] || alert.metric_name : null;

  return (
    <div
      className={`flex items-start gap-4 px-5 py-4 rounded-xl border-l-4 bg-white border border-gray-200 ${severityStyle.border} transition-colors hover:bg-gray-50/50 dark:bg-gray-800 dark:border-gray-700 dark:hover:bg-gray-700/50`}
    >
      {/* Severity icon */}
      <div className={`mt-0.5 shrink-0 ${severityStyle.text}`}>
        <AlertTriangle size={20} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-1">
          <Badge color={alert.severity === 'critical' ? 'red' : 'amber'}>
            {alert.severity === 'critical' ? '위험' : '경고'}
          </Badge>
          {alert.acknowledged && (
            <Badge color="blue">확인됨</Badge>
          )}
          <span className="text-xs text-gray-400 dark:text-gray-500">{alert.server_name}</span>
        </div>

        <p className="text-sm text-gray-900 dark:text-gray-100 mb-1">{alert.message}</p>

        <div className="flex items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          {metricLabel && (
            <span>
              {metricLabel}: {alert.metric_value != null ? formatPercent(alert.metric_value) : '-'}
              {alert.threshold_value != null && ` (임계값: ${formatPercent(alert.threshold_value)})`}
            </span>
          )}
          <span>{formatDateTime(alert.created_at)}</span>
          {alert.duration_seconds > 0 && (
            <span>지속: {formatDuration(alert.duration_seconds)}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 shrink-0">
        {!alert.acknowledged && (
          <Button
            variant="secondary"
            size="sm"
            icon={<Check size={14} />}
            onClick={() => onAcknowledge(alert.alert_id)}
            disabled={isAcknowledging}
          >
            확인
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          icon={<XCircle size={14} className="text-emerald-600" />}
          onClick={() => onResolve(alert.alert_id)}
          disabled={isResolving}
        >
          해결
        </Button>
      </div>
    </div>
  );
}
