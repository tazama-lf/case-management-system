import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { TaskStatusDistribution } from '../types/reports.types';

interface TaskStatusPieChartProps {
  data: TaskStatusDistribution[];
  title: string;
  size?: number;
}

const TaskStatusPieChart: React.FC<TaskStatusPieChartProps> = ({ data, title, size = 350 }) => {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  if (total === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No data available</p>
        </div>
      </div>
    );
  }

  // Transform data for recharts
  const chartData = data.map(item => ({
    name: item.status,
    value: item.count,
    percentage: ((item.count / total) * 100).toFixed(1),
    color: item.color
  }));

  const renderLabel = ({ name, percentage }: any) => {
    return `${name}: ${percentage}%`;
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={size}>
        <PieChart>
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
          <Tooltip formatter={(value) => `${value} tasks`} />
          <Legend />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TaskStatusPieChart;
