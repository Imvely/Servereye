import React from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, AlertCircle, ArrowRight, Bell } from 'lucide-react';
import type { ActiveAlert } from '../../types';
import { formatRelative, formatDuration } from '../../utils/format';
import { SEVERITY_COLORS } from '../../utils/constants';

interface AlertPanelProps {
  alerts: ActiveAlert[];
  maxItems?: number;
}

const SeverityIcon: React.FC<{ severity: 'warning' | 'critical' }> = ({ severity }) => {
  if (severity === 'critical') {
    return <AlertCircle size={16} className="text-red-500 shrink-0" />;
  }
  return <AlertTriangle size={16} className="text-amber-500 shrink-0" />;
};

const AlertPanel: React.FC<AlertPanelProps> = ({ alerts, maxItems = 10 }) => {
  const visibleAlerts = alerts.slice(0, maxItems);

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-gray-700">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-gray-500 dark:text-gray-400" />
          <h2 className="text-sm font-semibold text-gray-900 dark:text-white">
            활성 알림
          </h2>
          {alerts.length > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-xs font-bold text-red-700 dark:text-red-400">
              {alerts.length}
            </span>
          )}
        </div>
        <Link
          to="/alerts"
          className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 flex items-center gap-1"
        >
          전체 보기
          <ArrowRight size={12} />
        </Link>
      </div>

      {/* 알림 리스트 */}
      <div className="flex-1 overflow-y-auto">
        {visibleAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center mb-3">
              <Bell size={20} className="text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              활성 알림 없음
            </p>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              모든 서버가 정상 상태입니다.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100 dark:divide-gray-700">
            {visibleAlerts.map((alert) => {
              const severityColor =
                SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.warning;

              return (
                <li
                  key={alert.alert_id}
                  className={`px-5 py-3 border-l-4 ${severityColor.border} hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors`}
                >
                  <div className="flex items-start gap-3">
                    <SeverityIcon severity={alert.severity} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                          {alert.server_name}
                        </span>
                        <span
                          className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${severityColor.bg} ${severityColor.text}`}
                        >
                          {alert.severity}
                        </span>
                      </div>
                      {alert.metric_name && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {alert.metric_name}
                          {alert.metric_value != null && (
                            <span className="font-medium text-gray-700 dark:text-gray-300">
                              {' '}
                              {alert.metric_value.toFixed(1)}%
                            </span>
                          )}
                        </p>
                      )}
                      <p className="text-xs text-gray-600 dark:text-gray-300 mt-0.5 line-clamp-2">
                        {alert.message}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400 dark:text-gray-500">
                        <span>{formatRelative(alert.created_at)}</span>
                        {alert.duration_seconds > 0 && (
                          <>
                            <span>·</span>
                            <span>지속 {formatDuration(alert.duration_seconds)}</span>
                          </>
                        )}
                        {!alert.acknowledged && (
                          <>
                            <span>·</span>
                            <span className="text-amber-600 dark:text-amber-400 font-medium">
                              미확인
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* 더 많은 알림이 있을 경우 안내 */}
      {alerts.length > maxItems && (
        <div className="px-5 py-2 border-t border-gray-100 dark:border-gray-700 text-center">
          <span className="text-xs text-gray-500 dark:text-gray-400">
            외 {alerts.length - maxItems}건의 알림이 더 있습니다.
          </span>
        </div>
      )}
    </div>
  );
};

export default AlertPanel;
