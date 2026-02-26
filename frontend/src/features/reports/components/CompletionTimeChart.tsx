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
import type { CompletionTime } from '../types/reports.types';

interface CompletionTimeChartProps {
  data: CompletionTime[];
  title: string;
  height?: number;
}

const CompletionTimeChart: React.FC<CompletionTimeChartProps> = ({
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
            No completion time data available
          </p>
        </div>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: item.type,
    days: item.avgDays,
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
          margin={{ top: 20, right: 20, bottom: 5, left: 80 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis type="number" />
          <YAxis type="category" dataKey="name" tick={{ fontSize: 12 }} />
          <Tooltip
            formatter={(value) => [`${value} days`, 'Average Days']}
            contentStyle={{
              backgroundColor: '#fff',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          />
          <Bar dataKey="days" fill="#3b82f6" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CompletionTimeChart;
