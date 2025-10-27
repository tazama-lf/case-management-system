import React from 'react';
import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { AgeingDistribution } from '../types/reports.types';

interface CaseAgeingPieChartProps {
  data: AgeingDistribution[];
  title: string;
  size?: number;
}

const ageColors = {
  '0-7 days': '#10b981',
  '8-15 days': '#fbbf24',
  '16-30 days': '#f97316',
  '30+ days': '#ef4444'
};

const CaseAgeingPieChart: React.FC<CaseAgeingPieChartProps> = ({ data, title, size = 350 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6 w-full max-w-full">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4 sm:mb-6">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No data available</p>
        </div>
      </div>
    );
  }

  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);

  if (total === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6 w-full max-w-full">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4 sm:mb-6">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No cases found</p>
        </div>
      </div>
    );
  }

  // Transform data for recharts
  const chartData = data.map(item => ({
    name: item.ageRange,
    value: item.count,
    percentage: ((item.count / total) * 100).toFixed(1)
  }));

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 w-full max-w-full">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={size}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={false}
            outerRadius="70%"
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={ageColors[entry.name as keyof typeof ageColors] || '#94a3b8'} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value, _name, props) => [`${value} cases (${props.payload.percentage}%)`, props.payload.name]}
          />
          <Legend 
            verticalAlign="bottom" 
            height={36}
            formatter={(value, entry: any) => `${value}: ${entry.payload.percentage}%`}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CaseAgeingPieChart;
