import React from 'react';
import { formatBytes } from '../../utils/format';

interface DiskBarProps {
  drives: Array<{ name: string; total: number; used: number }>;
}

const getBarColor = (pct: number): string => {
  if (pct >= 90) return 'bg-red-500';
  if (pct >= 70) return 'bg-amber-500';
  return 'bg-emerald-500';
};

const getTextColor = (pct: number): string => {
  if (pct >= 90) return 'text-red-600 dark:text-red-400';
  if (pct >= 70) return 'text-amber-600 dark:text-amber-400';
  return 'text-emerald-600 dark:text-emerald-400';
};

const DiskBar: React.FC<DiskBarProps> = ({ drives }) => {
  if (!drives || drives.length === 0) {
    return (
      <p className="text-sm text-gray-400 dark:text-gray-500">
        디스크 정보 없음
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {drives.map((drive) => {
        const pct = drive.total > 0 ? (drive.used / drive.total) * 100 : 0;
        const clampedPct = Math.min(100, Math.max(0, pct));

        return (
          <div key={drive.name}>
            {/* Header row: drive name + usage text */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {drive.name}
              </span>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {formatBytes(drive.used)} / {formatBytes(drive.total)}
                <span className={`ml-1.5 font-semibold ${getTextColor(clampedPct)}`}>
                  {clampedPct.toFixed(1)}%
                </span>
              </span>
            </div>

            {/* Bar track */}
            <div className="w-full h-2.5 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getBarColor(clampedPct)}`}
                style={{ width: `${clampedPct}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default DiskBar;
