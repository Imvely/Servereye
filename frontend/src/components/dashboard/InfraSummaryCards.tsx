import React from 'react';
import { Server, Cpu, MemoryStick, AlertTriangle } from 'lucide-react';
import type { DashboardSummary } from '../../types';
import { formatPercent } from '../../utils/format';
import { getGaugeColor } from '../../utils/format';

interface InfraSummaryCardsProps {
  summary: DashboardSummary;
}

/** 사용률 바 */
const UsageBar: React.FC<{ value: number; label: string }> = ({ value, label }) => {
  const color = getGaugeColor(value);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
        <span>{label}</span>
        <span style={{ color }} className="font-medium">
          {formatPercent(value)}
        </span>
      </div>
      <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${Math.min(value, 100)}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
};

const InfraSummaryCards: React.FC<InfraSummaryCardsProps> = ({ summary }) => {
  const {
    total_servers,
    status_counts,
    avg_cpu,
    avg_mem,
    active_alerts,
    unacknowledged_alerts,
  } = summary;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      {/* ── 전체 서버 ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center">
            <Server size={20} className="text-indigo-600 dark:text-indigo-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">전체 서버</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {total_servers}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-gray-600 dark:text-gray-300">
              온라인 {status_counts.online}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-gray-400" />
            <span className="text-gray-600 dark:text-gray-300">
              오프라인 {status_counts.offline}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-violet-500" />
            <span className="text-gray-600 dark:text-gray-300">
              유지보수 {status_counts.maintenance}
            </span>
          </span>
        </div>
      </div>

      {/* ── 평균 CPU ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
            <Cpu size={20} className="text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">평균 CPU</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatPercent(avg_cpu)}
            </p>
          </div>
        </div>
        <UsageBar value={avg_cpu} label="전체 평균" />
      </div>

      {/* ── 평균 메모리 ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center">
            <MemoryStick size={20} className="text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">평균 메모리</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatPercent(avg_mem)}
            </p>
          </div>
        </div>
        <UsageBar value={avg_mem} label="전체 평균" />
      </div>

      {/* ── 활성 알림 ── */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center">
            <AlertTriangle size={20} className="text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <p className="text-xs font-medium text-gray-500 dark:text-gray-400">활성 알림</p>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {active_alerts}
            </p>
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-red-500" />
            <span className="text-gray-600 dark:text-gray-300">
              위험 {status_counts.critical}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span className="text-gray-600 dark:text-gray-300">
              경고 {status_counts.warning}
            </span>
          </span>
          <span className="flex items-center gap-1">
            <span className="text-gray-500 dark:text-gray-400">
              미확인 {unacknowledged_alerts}
            </span>
          </span>
        </div>
      </div>
    </div>
  );
};

export default InfraSummaryCards;
