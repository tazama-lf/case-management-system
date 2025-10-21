import React from 'react';
import type { CompletionTrend } from '../types/reports.types';

interface CompletionRateTrendChartProps {
  data: CompletionTrend[];
  title: string;
  height?: number;
}

const CompletionRateTrendChart: React.FC<CompletionRateTrendChartProps> = ({ data, title, height = 200 }) => {
  const maxValue = Math.max(...data.map(item => item.completionRate));
  
  const chartHeight = height - 60;
  const chartWidth = 300;
  const stepX = chartWidth / (data.length - 1);
  
  const createPath = () => {
    return data
      .map((item, index) => {
        const x = index * stepX;
        const y = chartHeight - (item.completionRate / maxValue) * chartHeight;
        return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
      })
      .join(' ');
  };
  
  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="relative">
        <svg width={chartWidth} height={height} className="overflow-visible">
          <path
            d={createPath()}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />
          
          {data.map((item, index) => (
            <g key={index}>
              <circle
                cx={index * stepX}
                cy={chartHeight - (item.completionRate / maxValue) * chartHeight}
                r="3"
                fill="#3b82f6"
              />
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
                {item.week}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
};

export default CompletionRateTrendChart;
