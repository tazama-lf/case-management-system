import React from 'react';
import { PieChart as ReChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';

interface PieChartData {
  label: string;
  value: number;
  color: string;
  percentage: number;
}

interface PieChartProps {
  data: PieChartData[];
  title: string;
  size?: number;
  isLoading?: boolean;
}

const PieChart: React.FC<PieChartProps> = ({ data, title, size = 350, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
        <div className="animate-pulse flex items-center justify-center" style={{ height: size }}>
          <div className="bg-gray-200 rounded-full" style={{ width: size * 0.6, height: size * 0.6 }}></div>
        </div>
      </div>
    );
  }

  const validData = data.filter(item => item.value > 0);
  const total = validData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
        <div className="flex items-center justify-center" style={{ height: size }}>
          <p className="text-gray-500">No data available</p>
        </div>
      </div>
    );
  }

  // Transform data for recharts
  const chartData = validData.map(item => ({
    name: item.label,
    value: item.value,
    percentage: item.percentage.toFixed(1),
    color: item.color
  }));

  const renderLabel = ({ name, percentage }: any) => {
    return `${name}: ${percentage}%`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={size}>
        <ReChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={true}
            label={renderLabel}
            outerRadius="70%"
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${value} cases`} />
          <Legend />
        </ReChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PieChart;