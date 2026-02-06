import React from 'react';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';

interface MiniGaugeProps {
  value: number; // 0-100
  label: string;
  size?: number; // default 120
  color?: string;
}

const getDefaultColor = (value: number): string => {
  if (value > 90) return '#EF4444';
  if (value >= 70) return '#F59E0B';
  return '#10B981';
};

const MiniGauge: React.FC<MiniGaugeProps> = ({
  value,
  label,
  size = 120,
  color,
}) => {
  const fillColor = color || getDefaultColor(value);
  const clampedValue = Math.max(0, Math.min(100, value));

  const data = [
    {
      name: 'background',
      value: 100,
      fill: '#F3F4F6',
    },
    {
      name: label,
      value: clampedValue,
      fill: fillColor,
    },
  ];

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            cx="50%"
            cy="50%"
            innerRadius="70%"
            outerRadius="100%"
            startAngle={90}
            endAngle={-270}
            data={data}
            barSize={size * 0.1}
          >
            <RadialBar
              dataKey="value"
              cornerRadius={size * 0.05}
              isAnimationActive={false}
              background={false}
            />
          </RadialBarChart>
        </ResponsiveContainer>
        <div
          className="absolute inset-0 flex flex-col items-center justify-center"
          style={{ pointerEvents: 'none' }}
        >
          <span
            className="font-bold text-gray-900 dark:text-white leading-none"
            style={{ fontSize: size * 0.22 }}
          >
            {clampedValue.toFixed(0)}
          </span>
          <span
            className="text-gray-400 dark:text-gray-500 leading-none"
            style={{ fontSize: size * 0.13 }}
          >
            %
          </span>
        </div>
      </div>
      <span className="text-xs text-gray-500 dark:text-gray-400 font-medium">
        {label}
      </span>
    </div>
  );
};

export default MiniGauge;
