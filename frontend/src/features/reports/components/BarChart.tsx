import React from 'react';
import {
  BarChart as ReBarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';

interface BarChartData {
  label: string;
  value: number;
  color: string;
}

interface BarChartProps {
  data: BarChartData[];
  title: string;
  height?: number;
  isLoading?: boolean;
}

const BarChart: React.FC<BarChartProps> = ({
  data,
  title,
  height = 350,
  isLoading = false,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">
          {title}
        </h3>
        <div className="animate-pulse" style={{ height }}>
          <div className="bg-gray-200 rounded w-full h-full"></div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">
          {title}
        </h3>
        <div className="flex items-center justify-center" style={{ height }}>
          <p className="text-gray-500">No data available</p>
        </div>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    name: item.label,
    count: item.value,
    color: item.color,
  }));

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <ReBarChart
          data={chartData}
          margin={{ top: 20, right: 20, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="name" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Bar dataKey="count" fill="#3b82f6" radius={[4, 4, 0, 0]}>
            {chartData.map((entry, index) => (
              <Cell
                key={`${entry.name}-${entry.count}-${index}`}
                fill={entry.color}
              />
            ))}
          </Bar>
        </ReBarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default BarChart;
