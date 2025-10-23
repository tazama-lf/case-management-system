import React from 'react';
import type { VolumeTrend } from '../types/reports.types';

interface CaseVolumeTrendChartProps {
  data: VolumeTrend[];
  title: string;
  height?: number;
}

const CaseVolumeTrendChart: React.FC<CaseVolumeTrendChartProps> = ({ data, title, height = 200 }) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No volume trend data available</p>
        </div>
      </div>
    );
  }

  const investigators = Object.keys(data[0]?.investigators || {});
  const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444'];
  const maxValue = Math.max(...data.flatMap(d => Object.values(d.investigators)), 1); // Ensure at least 1 to avoid division by 0

  const chartHeight = height - 60;
  const chartWidth = 300;
  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth / 2;

  const createPath = (investigator: string) => {
    return data
      .map((d, index) => {
        const x = index * stepX;
        const y = chartHeight - (d.investigators[investigator] / maxValue) * chartHeight;
        return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
      })
      .join(' ');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="relative">
        <svg width={chartWidth} height={height} className="overflow-visible">
          {investigators.map((investigator, index) => (
            <g key={investigator}>
              <path
                d={createPath(investigator)}
                fill="none"
                stroke={colors[index % colors.length]}
                strokeWidth="2"
              />
              {data.map((d, i) => (
                <circle
                  key={i}
                  cx={i * stepX}
                  cy={chartHeight - (d.investigators[investigator] / maxValue) * chartHeight}
                  r="3"
                  fill={colors[index % colors.length]}
                />
              ))}
            </g>
          ))}

          {data.map((_, index) => (
            <g key={index}>
              <line
                x1={index * stepX}
                y1={chartHeight}
                x2={index * stepX}
                y2={chartHeight + 5}
                stroke="#e5e7eb"
                strokeWidth="1"
              />
              <text
                x={index * stepX}
                y={chartHeight + 20}
                textAnchor="middle"
                className="text-xs fill-gray-600"
              >
                {data[index].month}
              </text>
            </g>
          ))}
        </svg>

        <div className="flex items-center justify-center mt-4 space-x-4 flex-wrap">
          {investigators.map((investigator, index) => (
            <div key={investigator} className="flex items-center">
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: colors[index % colors.length] }}
              />
              <span className="text-sm text-gray-600">{investigator}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CaseVolumeTrendChart;
