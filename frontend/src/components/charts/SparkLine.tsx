import React from 'react';
import { ResponsiveContainer, LineChart, Line } from 'recharts';

interface SparkLineProps {
  data: number[];
  color?: string;
  width?: number;
  height?: number;
}

const SparkLine: React.FC<SparkLineProps> = ({
  data,
  color = '#6366F1',
  width = 80,
  height = 30,
}) => {
  const chartData = data.map((value, index) => ({ index, value }));

  return (
    <div style={{ width, height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData}>
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default SparkLine;
