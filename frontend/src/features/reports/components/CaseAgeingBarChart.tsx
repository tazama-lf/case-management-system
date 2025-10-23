import React from 'react';
import type { AgeingByStatus } from '../types/reports.types';

interface CaseAgeingBarChartProps {
  data: AgeingByStatus[];
  title: string;
  subtitle?: string
  height?: number;
}

const CaseAgeingBarChart: React.FC<CaseAgeingBarChartProps> = ({ data, title, height = 320 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 w-full max-w-full">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No data available</p>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(...data.map(item =>
    item.age0to7 + item.age8to15 + item.age16to30 + item.age30Plus
  ), 10);

  const chartHeight = height - 180;

  const formatStatusName = (status: string) => {

    return status
      .replace('STATUS_', '')
      .replace(/_/g, ' ')
      .trim();
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 w-full max-w-full">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>

      <div className="relative" style={{ height: height - 60 }}>
        {}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2" style={{ height: `${chartHeight}px` }}>
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="leading-none">
              {Math.round((maxValue * (5 - i)) / 5)}
            </span>
          ))}
        </div>

        {}
        <div className="ml-8 h-full">
          <div className="flex items-end justify-between space-x-3" style={{ height: `${chartHeight}px` }}>
            {data.map((item, index) => {
              const total = item.age0to7 + item.age8to15 + item.age16to30 + item.age30Plus;
              const barHeight = maxValue > 0 ? (total / maxValue) * chartHeight : 0;

              return (
                <div key={index} className="flex flex-col items-center flex-1 min-w-0 group">
                  {}
                  <div className="text-sm font-semibold text-gray-900 mb-2">
                    {total}
                  </div>

                  {}
                  <div className="w-full max-w-16 relative">
                    <div
                      className="w-full bg-blue-500 rounded-t hover:bg-blue-600 transition-colors cursor-pointer relative"
                      style={{ height: `${Math.max(barHeight, 4)}px` }}
                      title={`Total: ${total} cases`}
                    >
                      {}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded py-2 px-3 whitespace-nowrap z-10">
                        <div className="font-semibold mb-1">{formatStatusName(item.status)}</div>
                        <div>0-7 days: {item.age0to7}</div>
                        <div>8-15 days: {item.age8to15}</div>
                        <div>16-30 days: {item.age16to30}</div>
                        <div>30+ days: {item.age30Plus}</div>
                        <div className="font-semibold mt-1">Total: {total}</div>
                        {}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {}
          <div className="absolute inset-0 pointer-events-none" style={{ height: `${chartHeight}px` }}>
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="absolute w-full border-t border-gray-100"
                style={{ top: `${(i / 5) * chartHeight}px` }}
              />
            ))}
            {}
            <div
              className="absolute w-full border-t-2 border-gray-800"
              style={{ top: `${chartHeight}px` }}
            />
          </div>

          {}
          <div className="flex justify-between items-start mt-4 space-x-3">
            {data.map((item, index) => (
              <div key={index} className="flex-1 text-center">
                <div className="text-xs text-gray-600 leading-tight break-words">
                  <div className="font-medium">{formatStatusName(item.status)}</div>
                  <div className="text-gray-500 mt-1">{item.age0to7 + item.age8to15 + item.age16to30 + item.age30Plus}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {}
      <div className="grid grid-cols-2 gap-3 mt-6 pt-4 border-t border-gray-100">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded mr-2 flex-shrink-0" />
          <span className="text-sm text-gray-600">0-7 days</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-yellow-500 rounded mr-2 flex-shrink-0" />
          <span className="text-sm text-gray-600">8-15 days</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-orange-500 rounded mr-2 flex-shrink-0" />
          <span className="text-sm text-gray-600">16-30 days</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-600 rounded mr-2 flex-shrink-0" />
          <span className="text-sm text-gray-600">30+ days</span>
        </div>
      </div>
    </div>
  );
};

export default CaseAgeingBarChart;
