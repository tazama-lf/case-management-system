import React from 'react';
import type { CompletionTime } from '../types/reports.types';

interface CompletionTimeChartProps {
  data: CompletionTime[];
  title: string;
  height?: number;
}

const CompletionTimeChart: React.FC<CompletionTimeChartProps> = ({ data, title, height = 200 }) => {
  const maxValue = Math.max(...data.map(item => item.avgDays));
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4" style={{ height }}>
        {data.map((item, index) => {
          const barWidth = (item.avgDays / maxValue) * 100;
          
          return (
            <div key={index} className="flex items-center">
              <div className="w-24 text-sm text-gray-600 truncate mr-4">
                {item.type}
              </div>
              <div className="flex-1 flex items-center">
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative">
                  <div 
                    className="bg-orange-500 h-6 rounded-full"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="w-16 text-xs text-gray-500 text-right ml-4">
                  {item.avgDays} days
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CompletionTimeChart;
