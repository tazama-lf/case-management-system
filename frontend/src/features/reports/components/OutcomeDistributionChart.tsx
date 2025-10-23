import React from 'react';
import type { OutcomeDistribution } from '../types/reports.types';

interface OutcomeDistributionChartProps {
  data: OutcomeDistribution[];
  title: string;
  height?: number;
}

const OutcomeDistributionChart: React.FC<OutcomeDistributionChartProps> = ({ data, title, height = 200 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No outcome data available</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="space-y-4" style={{ height }}>
        {data.map((item, index) => {
          const total = item.confirmed + item.refuted + item.inconclusive;
          const confirmedWidth = total > 0 ? (item.confirmed / total) * 100 : 0;
          const refutedWidth = total > 0 ? (item.refuted / total) * 100 : 0;
          const inconclusiveWidth = total > 0 ? (item.inconclusive / total) * 100 : 0;

          return (
            <div key={index} className="flex items-center">
              <div className="w-24 text-sm text-gray-600 truncate mr-4">
                {item.name}
              </div>
              <div className="flex-1 flex items-center">
                <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                  <div
                    className="bg-red-500 h-6 absolute top-0 left-0"
                    style={{ width: `${confirmedWidth}%` }}
                  />
                  <div
                    className="bg-green-500 h-6 absolute top-0"
                    style={{
                      width: `${refutedWidth}%`,
                      left: `${confirmedWidth}%`
                    }}
                  />
                  <div
                    className="bg-orange-500 h-6 absolute top-0"
                    style={{
                      width: `${inconclusiveWidth}%`,
                      left: `${confirmedWidth + refutedWidth}%`
                    }}
                  />
                </div>
                <div className="w-16 text-xs text-gray-500 text-right ml-4">
                  {total}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex items-center justify-center mt-4 space-x-4">
        <div className="flex items-center">
          <div className="w-3 h-3 bg-red-500 rounded-full mr-2" />
          <span className="text-sm text-gray-600">Confirmed</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-green-500 rounded-full mr-2" />
          <span className="text-sm text-gray-600">Refuted</span>
        </div>
        <div className="flex items-center">
          <div className="w-3 h-3 bg-orange-500 rounded-full mr-2" />
          <span className="text-sm text-gray-600">Inconclusive</span>
        </div>
      </div>
    </div>
  );
};

export default OutcomeDistributionChart;
