import React from 'react';
import type { AgeingDistribution } from '../types/reports.types';

interface CaseAgeingPieChartProps {
  data: AgeingDistribution[];
  title: string;
  size?: number;
}

const ageColors = {
  '0-7 days': '#10b981',
  '8-15 days': '#3b82f6',
  '16-30 days': '#f59e0b',
  '30+ days': '#ef4444'
};

const CaseAgeingPieChart: React.FC<CaseAgeingPieChartProps> = ({ data, title, size = 280 }) => {
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

  const total = data.reduce((sum, item) => sum + (item.count || 0), 0);

  if (total === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 w-full max-w-full">
        <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No cases found</p>
        </div>
      </div>
    );
  }

  const validSegments = data.filter(item => item.count > 0);

  let cumulativePercentage = 0;
  const segments = validSegments.map((item) => {
    const percentage = (item.count / total) * 100;
    const startAngle = cumulativePercentage * 3.6;
    const endAngle = (cumulativePercentage + percentage) * 3.6;
    cumulativePercentage += percentage;

    if (percentage >= 99.9) {
      return {
        ...item,
        percentage: Math.round(percentage * 10) / 10,
        color: ageColors[item.ageRange as keyof typeof ageColors] || '#94a3b8',
        path: `M 50,15 A 35,35 0 1,1 49.99,15`
      };
    }

    const x1 = 50 + 35 * Math.cos((startAngle - 90) * Math.PI / 180);
    const y1 = 50 + 35 * Math.sin((startAngle - 90) * Math.PI / 180);
    const x2 = 50 + 35 * Math.cos((endAngle - 90) * Math.PI / 180);
    const y2 = 50 + 35 * Math.sin((endAngle - 90) * Math.PI / 180);

    const largeArcFlag = percentage > 50 ? 1 : 0;

    return {
      ...item,
      percentage: Math.round(percentage * 10) / 10,
      color: ageColors[item.ageRange as keyof typeof ageColors] || '#94a3b8',
      path: `M 50,50 L ${x1},${y1} A 35,35 0 ${largeArcFlag},1 ${x2},${y2} z`
    };
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 w-full max-w-full">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>

      <div className="flex flex-col lg:flex-row items-center gap-6">
        {}
        <div className="relative flex-shrink-0">
          <svg width={size} height={size} viewBox="0 0 100 100">
            {segments.map((segment, index) => (
              <g key={index}>
                <path
                  d={segment.path}
                  fill={segment.color}
                  stroke="white"
                  strokeWidth="0.5"
                  className="hover:opacity-80 cursor-pointer transition-all duration-200 hover:stroke-2"
                  style={{ filter: 'drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))' }}
                />
                <title>{`${segment.ageRange}: ${segment.count} cases (${segment.percentage}%)`}</title>
              </g>
            ))}
          </svg>

          {}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold text-gray-900">{total}</div>
            <div className="text-sm text-gray-600">Total Cases</div>
          </div>
        </div>

        {}
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-1 gap-3">
            {data.map((item, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <div
                    className="w-4 h-4 rounded-full flex-shrink-0 ring-2 ring-white shadow-sm"
                    style={{ backgroundColor: ageColors[item.ageRange as keyof typeof ageColors] || '#94a3b8' }}
                  />
                  <span className="text-sm font-medium text-gray-700">{item.ageRange}</span>
                </div>
                <div className="flex items-center gap-3 text-right">
                  <span className="text-lg font-semibold text-gray-900">{item.count}</span>
                  <span className="text-sm text-gray-500 min-w-[45px] font-medium">
                    {item.count > 0 ? `${Math.round((item.count / total) * 100)}%` : '0%'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CaseAgeingPieChart;
