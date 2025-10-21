import React from 'react';
import type { CaseTypeResolution } from '../types/reports.types';

interface CaseTypeResolutionChartProps {
  data: CaseTypeResolution[];
  title: string;
  height?: number;
}

const CaseTypeResolutionChart: React.FC<CaseTypeResolutionChartProps> = ({ data, title, height = 200 }) => {
  const maxValue = Math.max(...data.map(item => item.avgDays));
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="flex items-end justify-between space-x-2" style={{ height }}>
        {data.map((item, index) => {
          const barHeight = (item.avgDays / maxValue) * (height - 40);
          
          return (
            <div key={index} className="flex flex-col items-center flex-1">
              <div className="text-xs font-medium text-gray-900 mb-1">
                {item.avgDays}
              </div>
              <div 
                className="w-full rounded-t"
                style={{ 
                  height: `${barHeight}px`,
                  backgroundColor: '#8b5cf6',
                  minHeight: '4px'
                }}
              />
              <div className="text-xs text-gray-600 mt-2 text-center">
                {item.caseType}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CaseTypeResolutionChart;
