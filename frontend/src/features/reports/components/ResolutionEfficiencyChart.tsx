import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ResolutionEfficiency } from '../types/reports.types';

interface ResolutionEfficiencyChartProps {
  data: ResolutionEfficiency[];
  title: string;
  height?: number;
}

const ResolutionEfficiencyChart: React.FC<ResolutionEfficiencyChartProps> = ({
  data,
  title,
  height = 350,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">
          {title}
        </h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">
            No efficiency data available
          </p>
        </div>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: item.name,
    avgDays: item.avgDays,
  }));

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          layout="vertical"
          margin={{ top: 20, right: 30, bottom: 5, left: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis
            type="number"
            domain={[0, (dataMax: number) => Math.max(dataMax + 1, 5)]}
          />
          <YAxis
            dataKey="name"
            type="category"
            tick={{ fontSize: 12 }}
            width={70}
          />
          <Tooltip
            formatter={(value) =>
              value === 0
                ? ['< 1 day', 'Average Days']
                : [`${Math.round(Number(value))} days`, 'Average Days']
            }
          />
          <Bar dataKey="avgDays" fill="#3b82f6" minPointSize={5} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ResolutionEfficiencyChart;
