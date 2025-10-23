import React from 'react';
import type { ResolutionEfficiency } from '../types/reports.types';

interface ResolutionEfficiencyChartProps {
  data: ResolutionEfficiency[];
  title: string;
  height?: number;
}

const ResolutionEfficiencyChart: React.FC<ResolutionEfficiencyChartProps> = ({ data, title, height = 200 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No efficiency data available</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(item => item.avgDays), 10);

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4" style={{ height }}>
        {data.map((item, index) => {
          const barWidth = maxValue > 0 ? (item.avgDays / maxValue) * 100 : 0;

          return (
            <div key={index} className="flex items-center">
              <div className="w-24 text-sm text-gray-600 truncate mr-4">
                {item.name}
              </div>
              <div className="flex-1 flex items-center">
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                  <div
                    className="bg-blue-500 h-6 rounded-full transition-all duration-300"
                    style={{ width: `${Math.max(barWidth, 2)}%` }}
                  />
                </div>
                <div className="w-16 text-xs text-gray-500 text-right ml-4">
                  {item.avgDays.toFixed(1)} days
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ResolutionEfficiencyChart;
