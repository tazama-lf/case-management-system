import React from 'react';
import type { AgeingByStatus } from '../types/reports.types';

interface CaseAgeingBarChartProps {
  data: AgeingByStatus[];
  title: string;
  height?: number;
}

const CaseAgeingBarChart: React.FC<CaseAgeingBarChartProps> = ({ data, title, height = 200 }) => {
  const maxValue = Math.max(...data.map(item => item.age0to7 + item.age8to15 + item.age16to30 + item.age30Plus));
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="flex items-end justify-between space-x-2" style={{ height }}>
        {data.map((item, index) => {
          const total = item.age0to7 + item.age8to15 + item.age16to30 + item.age30Plus;
          const totalHeight = (total / maxValue) * (height - 40);
          const age0to7Height = (item.age0to7 / maxValue) * (height - 40);
          const age8to15Height = (item.age8to15 / maxValue) * (height - 40);
          const age16to30Height = (item.age16to30 / maxValue) * (height - 40);
          const age30PlusHeight = (item.age30Plus / maxValue) * (height - 40);
          
          return (
            <div key={index} className="flex flex-col items-center flex-1">
              <div className="text-xs font-medium text-gray-900 mb-1">
                {total}
              </div>
              <div className="w-full relative">
                <div 
                  className="w-full rounded-t absolute bottom-0"
                  style={{ height: `${age0to7Height}px`, backgroundColor: '#10b981' }}
                />
                <div 
                  className="w-full absolute"
                  style={{ 
                    height: `${age8to15Height}px`, 
                    backgroundColor: '#f59e0b',
                    bottom: `${age0to7Height}px`
                  }}
                />
                <div 
                  className="w-full absolute"
                  style={{ 
                    height: `${age16to30Height}px`, 
                    backgroundColor: '#ef4444',
                    bottom: `${age0to7Height + age8to15Height}px`
                  }}
                />
                <div 
                  className="w-full absolute"
                  style={{ 
                    height: `${age30PlusHeight}px`, 
                    backgroundColor: '#7c2d12',
                    bottom: `${age0to7Height + age8to15Height + age16to30Height}px`
                  }}
                />
              </div>
              <div className="text-xs text-gray-600 mt-2 text-center">
                {item.status}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center mt-4 space-x-4">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-2" />
          <span className="text-sm text-gray-600">0-7 days</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-yellow-500 rounded-full mr-2" />
          <span className="text-sm text-gray-600">8-15 days</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded-full mr-2" />
          <span className="text-sm text-gray-600">16-30 days</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-800 rounded-full mr-2" />
          <span className="text-sm text-gray-600">30+ days</span>
        </div>
      </div>
    </div>
  );
};

export default CaseAgeingBarChart;
