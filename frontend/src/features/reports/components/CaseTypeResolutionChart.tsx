import React from 'react';
import type { CaseTypeResolution } from '../types/reports.types';

interface CaseTypeResolutionChartProps {
  data: CaseTypeResolution[];
  title: string;
  height?: number;
}

const CaseTypeResolutionChart: React.FC<CaseTypeResolutionChartProps> = ({ data, title, height = 280 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 w-full max-w-full">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No data available</p>
        </div>
      </div>
    );
  }

  const maxDataValue = Math.max(...data.map(item => item.avgDays || 0));
  const maxValue = Math.max(maxDataValue, 20);
  const chartHeight = height - 120;

  const getCaseTypeColor = (caseType: string) => {
    switch (caseType) {
      case 'FRAUD': case 'Fraud': return '#8b5cf6';
      case 'AML': return '#7c3aed';
      case 'FRAUD_AND_AML': return '#6366f1';
      case 'KYC': return '#a855f7';
      case 'NONE': return '#6b7280';
      default: return '#8b5cf6';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 w-full max-w-full">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>

      <div className="relative" style={{ height: height - 40 }}>
        {}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500 pr-2">
          {Array.from({ length: 6 }, (_, i) => (
            <span key={i} className="leading-none">
              {Math.round((maxValue * (5 - i)) / 5)}
            </span>
          ))}
        </div>

        {}
        <div className="ml-8 h-full">
          <div className="flex items-end justify-between space-x-4 h-full pb-12">
            {data.map((item, index) => {
              const avgDays = item.avgDays || 0;
              const barHeight = maxValue > 0 ? (avgDays / maxValue) * chartHeight : 0;

              return (
                <div key={index} className="flex flex-col items-center flex-1">
                  {}
                  <div className="text-sm font-semibold text-gray-900 mb-2">
                    {avgDays.toFixed(1)}
                  </div>

                  {}
                  <div className="w-full max-w-16 relative flex-1 flex flex-col justify-end group">
                    <div
                      className="w-full rounded-t transition-all duration-300 hover:opacity-80 hover:shadow-lg cursor-pointer"
                      style={{
                        height: `${Math.max(barHeight, avgDays > 0 ? 4 : 2)}px`,
                        backgroundColor: avgDays > 0 ? getCaseTypeColor(item.caseType) : '#e5e7eb',
                        minHeight: '2px'
                      }}
                      title={`${item.caseType}: ${avgDays.toFixed(1)} days`}
                    >
                      {}
                      <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-gray-800 text-white text-xs rounded py-2 px-3 whitespace-nowrap z-10">
                        <div className="font-semibold">{item.caseType.replace('_', ' & ')}</div>
                        <div>Avg Resolution: {avgDays.toFixed(1)} days</div>
                        {avgDays === 0 && <div className="text-yellow-300">No resolved cases</div>}
                        {}
                        <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                      </div>
                    </div>
                    {}
                    {avgDays === 0 && (
                      <div className="w-full h-0.5 bg-gray-300 rounded"></div>
                    )}
                  </div>

                  {}
                  <div className="text-xs text-gray-600 mt-3 text-center font-medium">
                    {item.caseType.replace('_', ' & ')}
                  </div>
                </div>
              );
            })}
          </div>

          {}
          <div className="absolute inset-0 pointer-events-none ml-8">
            {Array.from({ length: 6 }, (_, i) => (
              <div
                key={i}
                className="absolute w-full border-t border-gray-100"
                style={{ top: `${(i / 5) * chartHeight}px` }}
              />
            ))}
            {}
            <div
              className="absolute w-full border-t-2 border-gray-300"
              style={{ bottom: '48px' }}
            />
          </div>
        </div>
      </div>

      {}
      <div className="flex items-center justify-center mt-4">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-purple-600 mr-2"></div>
          <span className="text-sm text-gray-600">Average Days to Resolution</span>
        </div>
      </div>
    </div>
  );
};

export default CaseTypeResolutionChart;
