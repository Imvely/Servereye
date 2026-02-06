import React, { useState } from 'react';
import { useMetricHistory } from '../../api/hooks/useMetrics';
import TimeRangeSelector from '../common/TimeRangeSelector';
import RealtimeChart from '../charts/RealtimeChart';

interface MetricTabProps {
  serverId: number;
}

/** 로딩 스켈레톤 */
const ChartSkeleton: React.FC = () => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5 animate-pulse">
    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
    <div className="h-[240px] bg-gray-100 dark:bg-gray-700 rounded" />
  </div>
);

const MetricTab: React.FC<MetricTabProps> = ({ serverId }) => {
  const [range, setRange] = useState('1h');

  const { data: history, isLoading } = useMetricHistory(serverId, { range });

  const cpuData = (history ?? []).map((m) => ({
    time: m.time,
    cpu: m.cpu ?? 0,
  }));

  const memData = (history ?? []).map((m) => ({
    time: m.time,
    mem: m.mem ?? 0,
  }));

  const diskData = (history ?? []).map((m) => ({
    time: m.time,
    read: m.disk_read ?? 0,
    write: m.disk_write ?? 0,
  }));

  const netData = (history ?? []).map((m) => ({
    time: m.time,
    in: m.net_in ?? 0,
    out: m.net_out ?? 0,
  }));

  return (
    <div className="space-y-4">
      {/* 시간 범위 선택기 */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          성능 메트릭
        </h3>
        <TimeRangeSelector value={range} onChange={setRange} />
      </div>

      {/* 차트 그리드 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* CPU */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              CPU 사용률 (%)
            </h4>
            <div className="h-[240px]">
              <RealtimeChart
                data={cpuData}
                dataKeys={[{ key: 'cpu', color: '#6366F1', name: 'CPU' }]}
                yDomain={[0, 100]}
                yFormatter={(v) => `${v}%`}
              />
            </div>
          </div>
        )}

        {/* Memory */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              메모리 사용률 (%)
            </h4>
            <div className="h-[240px]">
              <RealtimeChart
                data={memData}
                dataKeys={[{ key: 'mem', color: '#8B5CF6', name: 'Memory' }]}
                yDomain={[0, 100]}
                yFormatter={(v) => `${v}%`}
              />
            </div>
          </div>
        )}

        {/* Disk I/O */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              디스크 I/O (MB/s)
            </h4>
            <div className="h-[240px]">
              <RealtimeChart
                data={diskData}
                dataKeys={[
                  { key: 'read', color: '#10B981', name: 'Read' },
                  { key: 'write', color: '#F59E0B', name: 'Write' },
                ]}
                yFormatter={(v) => `${v} MB/s`}
              />
            </div>
          </div>
        )}

        {/* Network */}
        {isLoading ? (
          <ChartSkeleton />
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-5">
            <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
              네트워크 (MB/s)
            </h4>
            <div className="h-[240px]">
              <RealtimeChart
                data={netData}
                dataKeys={[
                  { key: 'in', color: '#3B82F6', name: 'In' },
                  { key: 'out', color: '#EF4444', name: 'Out' },
                ]}
                yFormatter={(v) => `${v} MB/s`}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default MetricTab;
