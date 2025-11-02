import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
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

  const allAgeRanges = ['0-7 days', '8-15 days', '16-30 days', '30+ days'];
  const completeData = allAgeRanges.map(range => {
    const existing = data.find(item => item.ageRange === range);
    return {
      ageRange: range,
      count: existing?.count || 0
    };
  });

  const total = completeData.reduce((sum, item) => sum + (item.count || 0), 0);

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

  const chartData = completeData.map(item => ({
    name: item.ageRange,
    value: item.count,
    percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) : '0.0'
  }));

  const pieData = chartData.filter(item => item.value > 0);

  const CustomLegend = () => (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {chartData.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <div 
            className="w-3 h-3 rounded-sm" 
            style={{ backgroundColor: ageColors[item.name as keyof typeof ageColors] || '#94a3b8' }}
          />
          <span className="text-sm text-gray-700">
            {item.name}: {item.percentage}%
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 w-full max-w-full">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={size}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={false}
            outerRadius="70%"
            fill="#8884d8"
            dataKey="value"
            minAngle={5}
          >
            {pieData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={ageColors[entry.name as keyof typeof ageColors] || '#94a3b8'} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value, _name, props) => [`${value} cases (${props.payload.percentage}%)`, props.payload.name]}
          />
        </PieChart>
      </ResponsiveContainer>
      <CustomLegend />
    </div>
  );
};

export default CaseAgeingPieChart;
