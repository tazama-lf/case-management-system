import React from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { CaseTypeResolution } from '../types/reports.types';

interface CaseTypeResolutionChartProps {
  data: CaseTypeResolution[];
  title: string;
  height?: number;
}

const CaseTypeResolutionChart: React.FC<CaseTypeResolutionChartProps> = ({ data, title, height = 350 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6 w-full max-w-full">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No data available</p>
        </div>
      </div>
    );
  }

  // Transform data for recharts
  const chartData = data.map(item => ({
    type: item.caseType.replace('_', ' & '),
    averageDays: item.avgDays || 0
  }));

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 w-full max-w-full">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">{title}</h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={chartData} margin={{ top: 20, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="type" tick={{ fontSize: 12 }} />
          <YAxis domain={[0, 'dataMax + 2']} />
          <Tooltip 
            formatter={(value) => [`${value} days`, 'Average Days to Resolution']}
          />
          <Bar 
            dataKey="averageDays" 
            fill="#8b5cf6"
            name="Average Days to Resolution"
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CaseTypeResolutionChart;
