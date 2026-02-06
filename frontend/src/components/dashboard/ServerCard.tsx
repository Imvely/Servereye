import React from 'react';
import { Monitor, Terminal } from 'lucide-react';
import type { ServerSummary, ServerStatus } from '../../types';
import { formatPercent, formatRelative } from '../../utils/format';

import StatusBadge from '../common/StatusBadge';

interface ServerCardProps {
  server: ServerSummary;
  onClick: () => void;
}

/** 미니 사용률 바 */
const MiniBar: React.FC<{ label: string; value: number | null; color: string }> = ({
  label,
  value,
  color,
}) => (
  <div className="flex items-center gap-2">
    <span className="text-xs text-gray-500 dark:text-gray-400 w-10 shrink-0">{label}</span>
    <div className="flex-1 h-1.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: value != null ? `${Math.min(value, 100)}%` : '0%',
          backgroundColor: color,
        }}
      />
    </div>
    <span className="text-xs font-medium text-gray-700 dark:text-gray-300 w-12 text-right">
      {formatPercent(value)}
    </span>
  </div>
);

function getBarColor(value: number | null): string {
  if (value == null) return '#D1D5DB';
  if (value >= 90) return '#EF4444';
  if (value >= 70) return '#F59E0B';
  return '#6366F1';
}

const STATUS_BORDER_COLORS: Record<ServerStatus, string> = {
  online: 'border-l-emerald-500',
  warning: 'border-l-amber-500',
  critical: 'border-l-red-500',
  offline: 'border-l-gray-400',
  maintenance: 'border-l-violet-500',
  unknown: 'border-l-gray-400',
};

const ServerCard: React.FC<ServerCardProps> = ({ server, onClick }) => {
  const borderColor = STATUS_BORDER_COLORS[server.status] || 'border-l-gray-400';

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      }}
      className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 border-l-4 ${borderColor} p-5 cursor-pointer transition-shadow duration-150 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
    >
      {/* 상단: 이름 + 상태 */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          {server.os_type === 'windows' ? (
            <Monitor size={16} className="text-blue-500 shrink-0" />
          ) : (
            <Terminal size={16} className="text-orange-500 shrink-0" />
          )}
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white truncate">
              {server.display_name}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
              {server.ip_address}
            </p>
          </div>
        </div>
        <StatusBadge status={server.status} />
      </div>

      {/* 메트릭 바 */}
      <div className="space-y-2">
        <MiniBar label="CPU" value={server.cpu_usage_pct} color={getBarColor(server.cpu_usage_pct)} />
        <MiniBar label="MEM" value={server.mem_usage_pct} color={getBarColor(server.mem_usage_pct)} />
        <MiniBar label="DISK" value={server.disk_max_pct} color={getBarColor(server.disk_max_pct)} />
      </div>

      {/* 하단 정보 */}
      <div className="mt-3 flex items-center justify-between text-xs text-gray-400 dark:text-gray-500">
        <span>{server.group_name}</span>
        <span>{formatRelative(server.last_collected_at)}</span>
      </div>

      {/* 활성 알림 배지 */}
      {server.active_alerts > 0 && (
        <div className="mt-2">
          <span className="inline-flex items-center rounded-full bg-red-50 dark:bg-red-900/30 px-2 py-0.5 text-xs font-medium text-red-700 dark:text-red-400">
            알림 {server.active_alerts}건
          </span>
        </div>
      )}
    </div>
  );
};

export default ServerCard;
