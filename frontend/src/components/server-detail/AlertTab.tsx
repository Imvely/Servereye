import React, { useState } from 'react';
import { AlertCircle, AlertTriangle, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAlerts, type AlertListParams } from '../../api/hooks/useAlerts';
import { formatDateTime, formatRelative, formatDuration } from '../../utils/format';
import { SEVERITY_COLORS } from '../../utils/constants';

interface AlertTabProps {
  serverId: number;
}

const PAGE_SIZE = 15;

const AlertTab: React.FC<AlertTabProps> = ({ serverId }) => {
  const [page, setPage] = useState(1);
  const [severityFilter, setSeverityFilter] = useState<string>('');

  const queryParams: AlertListParams = {
    server_id: serverId,
    page,
    size: PAGE_SIZE,
  };
  if (severityFilter) {
    queryParams.severity = severityFilter;
  }

  const { data, isLoading } = useAlerts(queryParams);

  const alerts = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.ceil(total / PAGE_SIZE);

  const SeverityIcon: React.FC<{ severity: string }> = ({ severity }) => {
    if (severity === 'critical') {
      return <AlertCircle size={14} className="text-red-500" />;
    }
    return <AlertTriangle size={14} className="text-amber-500" />;
  };

  return (
    <div className="space-y-4">
      {/* 상단 바 */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          알림 이력
          <span className="ml-2 text-xs font-normal text-gray-500 dark:text-gray-400">
            (총 {total}건)
          </span>
        </h3>
        <div className="flex items-center gap-1">
          {(
            [
              { key: '', label: '전체' },
              { key: 'critical', label: '위험' },
              { key: 'warning', label: '경고' },
            ] as const
          ).map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => {
                setSeverityFilter(item.key);
                setPage(1);
              }}
              className={`px-2.5 py-1 text-xs font-medium rounded-lg transition-colors ${
                severityFilter === item.key
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* 테이블 */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        {isLoading ? (
          <div className="animate-pulse p-5 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-gray-100 dark:bg-gray-700 rounded" />
            ))}
          </div>
        ) : alerts.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mx-auto mb-3">
              <AlertTriangle size={20} className="text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">알림 이력 없음</p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              이 서버에 대한 알림이 없습니다.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-44">
                    발생 시각
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                    심각도
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                    메트릭
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    메시지
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                    상태
                  </th>
                  <th className="px-4 py-3 text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-28">
                    지속 시간
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {alerts.map((alert) => {
                  const sevColor =
                    SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.warning;
                  return (
                    <tr
                      key={alert.alert_id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      {/* 발생 시각 */}
                      <td className="px-4 py-3 text-xs text-gray-600 dark:text-gray-300 whitespace-nowrap tabular-nums">
                        <div>{formatDateTime(alert.created_at)}</div>
                        <div className="text-[11px] text-gray-400 dark:text-gray-500">
                          {formatRelative(alert.created_at)}
                        </div>
                      </td>

                      {/* 심각도 */}
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${sevColor.bg} ${sevColor.text}`}
                        >
                          <SeverityIcon severity={alert.severity} />
                          {alert.severity === 'critical' ? '위험' : '경고'}
                        </span>
                      </td>

                      {/* 메트릭 */}
                      <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-300">
                        {alert.metric_name || '-'}
                        {alert.metric_value != null && (
                          <span className="block text-[11px] text-gray-400">
                            {alert.metric_value.toFixed(1)}%
                            {alert.threshold_value != null && (
                              <> / 임계값 {alert.threshold_value}%</>
                            )}
                          </span>
                        )}
                      </td>

                      {/* 메시지 */}
                      <td className="px-4 py-3 text-xs text-gray-700 dark:text-gray-200 max-w-xs">
                        <p className="line-clamp-2">{alert.message}</p>
                      </td>

                      {/* 상태 */}
                      <td className="px-4 py-3">
                        {alert.acknowledged ? (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400">
                            확인됨
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400 animate-pulse">
                            활성
                          </span>
                        )}
                      </td>

                      {/* 지속 시간 */}
                      <td className="px-4 py-3 text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                        {formatDuration(alert.duration_seconds)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-1">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {total}건 중 {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)}
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => {
                // 현재 페이지 주변과 처음/마지막만 표시
                if (p === 1 || p === totalPages) return true;
                if (Math.abs(p - page) <= 1) return true;
                return false;
              })
              .map((p, idx, arr) => {
                const elements: React.ReactNode[] = [];
                // 생략부호 삽입
                if (idx > 0 && p - arr[idx - 1] > 1) {
                  elements.push(
                    <span
                      key={`ellipsis-${p}`}
                      className="px-1 text-xs text-gray-400"
                    >
                      ...
                    </span>,
                  );
                }
                elements.push(
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPage(p)}
                    className={`inline-flex items-center justify-center h-8 min-w-[32px] px-2 rounded-lg text-xs font-medium transition-colors ${
                      p === page
                        ? 'bg-indigo-600 text-white'
                        : 'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                    }`}
                  >
                    {p}
                  </button>,
                );
                return elements;
              })}

            <button
              type="button"
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AlertTab;
