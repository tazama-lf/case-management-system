import React from 'react';
import type { ResolutionTrend } from '../types/reports.types';

interface ResolutionTimeTrendChartProps {
  data: ResolutionTrend[];
  title: string;
  height?: number;
}

const ResolutionTimeTrendChart: React.FC<ResolutionTimeTrendChartProps> = ({ data, title, height = 280 }) => {
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

  const maxValue = Math.max(...data.map(item => item.avgDays), 20);
  const chartHeight = height - 100;
  const chartWidth = 100;
  const paddingLeft = 8;
  const paddingRight = 8;

  const gridLines = [];
  const ySteps = 5;
  for (let i = 0; i <= ySteps; i++) {
    const y = (i / ySteps) * chartHeight;
    const value = Math.round((maxValue * (ySteps - i)) / ySteps);
    gridLines.push({ y, value });
  }

  const createPath = () => {
    if (data.length === 1) {
      const x = 50;
      const y = chartHeight - (data[0].avgDays / maxValue) * chartHeight;
      return `M ${x},${y} L ${x},${y}`;
    }

    return data
      .map((item, index) => {
        const x = paddingLeft + ((index / (data.length - 1)) * (chartWidth - paddingLeft - paddingRight));
        const y = chartHeight - (item.avgDays / maxValue) * chartHeight;
        return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
      })
      .join(' ');
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 w-full max-w-full">
      <h3 className="text-lg font-semibold text-gray-900 mb-6">{title}</h3>
      <div className="relative">
        <svg
          width="100%"
          height={height}
          viewBox={`0 0 ${chartWidth} ${height}`}
          preserveAspectRatio="xMidYMid meet"
          className="overflow-visible"
        >
          {}
          <defs>
            <pattern id="grid" width="100" height={chartHeight / ySteps} patternUnits="userSpaceOnUse">
              <path d={`M 0 ${chartHeight / ySteps} L 100 ${chartHeight / ySteps}`} fill="none" stroke="#f3f4f6" strokeWidth="0.5"/>
            </pattern>
          </defs>
          <rect width="100" height={chartHeight} fill="url(#grid)"/>

          {}
          {gridLines.map((line, index) => (
            <g key={index}>
              <line
                x1={paddingLeft}
                y1={line.y}
                x2={chartWidth - paddingRight}
                y2={line.y}
                stroke="#e5e7eb"
                strokeWidth="0.5"
              />
              <text
                x={paddingLeft - 2}
                y={line.y + 1}
                textAnchor="end"
                className="text-xs fill-gray-500"
                fontSize="10"
              >
                {line.value}
              </text>
            </g>
          ))}

          {}
          <path
            d={createPath()}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {}
          {data.map((item, index) => {
            const x = paddingLeft + ((index / (data.length - 1)) * (chartWidth - paddingLeft - paddingRight));
            const y = chartHeight - (item.avgDays / maxValue) * chartHeight;
            return (
              <g key={index} className="group">
                <circle
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#3b82f6"
                  stroke="white"
                  strokeWidth="2"
                  className="hover:r-6 hover:fill-blue-600 transition-all duration-200 cursor-pointer"
                />
                {}
                <circle
                  cx={x}
                  cy={y}
                  r="8"
                  fill="transparent"
                  className="hover:fill-blue-100 hover:fill-opacity-30 transition-all duration-200 cursor-pointer"
                />
                {}
                <g className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none">
                  <rect
                    x={x - 30}
                    y={y - 40}
                    width="60"
                    height="28"
                    fill="#374151"
                    rx="4"
                    ry="4"
                  />
                  <text
                    x={x}
                    y={y - 30}
                    textAnchor="middle"
                    className="text-xs fill-white font-medium"
                    fontSize="10"
                  >
                    {item.month}
                  </text>
                  <text
                    x={x}
                    y={y - 18}
                    textAnchor="middle"
                    className="text-xs fill-white"
                    fontSize="10"
                  >
                    {item.avgDays.toFixed(1)} days
                  </text>
                  {}
                  <polygon
                    points={`${x},${y - 12} ${x - 4},${y - 16} ${x + 4},${y - 16}`}
                    fill="#374151"
                  />
                </g>
                {}
                <text
                  x={x}
                  y={chartHeight + 20}
                  textAnchor="middle"
                  className="text-xs fill-gray-600"
                  fontSize="11"
                >
                  {item.month}
                </text>
              </g>
            );
          })}

          {}
          <line
            x1={paddingLeft}
            y1={chartHeight}
            x2={chartWidth - paddingRight}
            y2={chartHeight}
            stroke="#374151"
            strokeWidth="1.5"
          />

          {}
          <line
            x1={paddingLeft}
            y1={0}
            x2={paddingLeft}
            y2={chartHeight}
            stroke="#374151"
            strokeWidth="1.5"
          />
        </svg>

        {}
        <div className="flex items-center justify-center mt-4">
          <div className="flex items-center">
            <div className="w-3 h-0.5 bg-blue-500 mr-2"></div>
            <span className="text-sm text-gray-600">Average Days</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResolutionTimeTrendChart;
