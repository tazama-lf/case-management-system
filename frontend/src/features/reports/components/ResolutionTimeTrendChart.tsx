import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { ResolutionTrend } from '../types/reports.types';

interface ResolutionTimeTrendChartProps {
  data: ResolutionTrend[];
  title: string;
  height?: number;
}

const ResolutionTimeTrendChart: React.FC<ResolutionTimeTrendChartProps> = ({
  data,
  title,
  height = 350,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6 w-full max-w-full">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">
          {title}
        </h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No data available</p>
        </div>
      </div>
    );
  }

  // Aggregate data by date - calculate average if multiple cases closed on same date
  const aggregatedData = data.reduce(
    (acc: { [key: string]: { total: number; count: number } }, item) => {
      const date = item.month;
      if (!acc[date]) {
        acc[date] = { total: 0, count: 0 };
      }
      acc[date].total += item.avgDays || 0;
      acc[date].count += 1;
      return acc;
    },
    {},
  );

  const chartData = Object.entries(aggregatedData)
    .map(([date, values]) => ({
      month: date,
      averageDays: Math.round(values.total / values.count),
    }))
    .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 w-full max-w-full">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart
          data={chartData}
          margin={{ top: 20, right: 20, bottom: 60, left: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#e0e0e0"
            vertical={true}
            horizontal={true}
          />
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11 }}
            angle={-45}
            textAnchor="end"
            height={80}
            interval="preserveStartEnd"
            axisLine={{ stroke: '#d1d5db' }}
            tickLine={{ stroke: '#d1d5db' }}
          />
          <YAxis
            domain={[0, 'dataMax + 2']}
            tick={{ fontSize: 12 }}
            axisLine={{ stroke: '#d1d5db' }}
            tickLine={{ stroke: '#d1d5db' }}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e5e7eb',
              borderRadius: '6px',
              padding: '8px 12px',
            }}
            formatter={(value: number) => [
              `${Math.round(value)} days`,
              'Average Days',
            ]}
          />
          <Line
            type="monotone"
            dataKey="averageDays"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }}
            activeDot={{ r: 6, fill: '#3b82f6' }}
            name="Average Days"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default ResolutionTimeTrendChart;
