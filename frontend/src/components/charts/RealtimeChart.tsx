import React from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
} from 'recharts';

interface RealtimeChartProps {
  data: Array<{ time: string; [key: string]: any }>;
  dataKeys: Array<{ key: string; color: string; name: string }>;
  yDomain?: [number, number];
  yFormatter?: (value: number) => string;
  height?: number;
  showLegend?: boolean;
}

const formatTimeLabel = (time: string): string => {
  try {
    const date = new Date(time);
    return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}:${String(date.getSeconds()).padStart(2, '0')}`;
  } catch {
    return time;
  }
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string;
  yFormatter?: (value: number) => string;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  label,
  yFormatter,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg px-3 py-2">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
        {label ? formatTimeLabel(label) : ''}
      </p>
      {payload.map((entry, idx) => (
        <div key={idx} className="flex items-center gap-2 text-sm">
          <span
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-gray-700 dark:text-gray-300">{entry.name}:</span>
          <span className="font-medium text-gray-900 dark:text-white">
            {yFormatter ? yFormatter(entry.value) : entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

const RealtimeChart: React.FC<RealtimeChartProps> = ({
  data,
  dataKeys,
  yDomain,
  yFormatter,
  height = 300,
  showLegend = true,
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          stroke="#E5E7EB"
          opacity={0.4}
          vertical={false}
        />
        <XAxis
          dataKey="time"
          tickFormatter={formatTimeLabel}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={{ stroke: '#E5E7EB' }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          domain={yDomain}
          tickFormatter={yFormatter}
          tick={{ fontSize: 11, fill: '#9CA3AF' }}
          axisLine={false}
          tickLine={false}
          width={45}
        />
        <Tooltip
          content={<CustomTooltip yFormatter={yFormatter} />}
          cursor={{ stroke: '#D1D5DB', strokeDasharray: '3 3' }}
        />
        {showLegend && (
          <Legend
            verticalAlign="top"
            height={30}
            iconType="circle"
            iconSize={8}
            wrapperStyle={{ fontSize: 12 }}
          />
        )}
        {dataKeys.map((dk) => (
          <Line
            key={dk.key}
            type="monotone"
            dataKey={dk.key}
            name={dk.name}
            stroke={dk.color}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3, strokeWidth: 0 }}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
};

export default RealtimeChart;
