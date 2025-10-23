import React from 'react';

interface LineChartData {
  label: string;
  casesCreated: number;
  casesClosed: number;
}

interface LineChartProps {
  data: LineChartData[];
  title: string;
  height?: number;
  isLoading?: boolean;
}

const LineChart: React.FC<LineChartProps> = ({ data, title, height = 200, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="animate-pulse" style={{ height }}>
          <div className="bg-gray-200 rounded w-full h-full"></div>
        </div>
        <div className="flex items-center justify-center mt-4 space-x-6">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-200 rounded-full mr-2" />
            <span className="text-sm text-gray-600">Cases Created</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-gray-200 rounded-full mr-2" />
            <span className="text-sm text-gray-600">Cases Closed</span>
          </div>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center" style={{ height }}>
          <p className="text-gray-500">No data available</p>
        </div>
        <div className="flex items-center justify-center mt-4 space-x-6">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2" />
            <span className="text-sm text-gray-600">Cases Created</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2" />
            <span className="text-sm text-gray-600">Cases Closed</span>
          </div>
        </div>
      </div>
    );
  }

  const maxValue = Math.max(
    ...data.flatMap(item => [item.casesCreated, item.casesClosed])
  );

  const chartHeight = height - 60;
  const chartWidth = 300;
  const stepX = chartWidth / (data.length - 1);

  const createPath = (values: number[]) => {
    return values
      .map((value, index) => {
        const x = index * stepX;
        const y = chartHeight - (value / maxValue) * chartHeight;
        return `${index === 0 ? 'M' : 'L'} ${x},${y}`;
      })
      .join(' ');
  };

  const createdPath = createPath(data.map(d => d.casesCreated));
  const closedPath = createPath(data.map(d => d.casesClosed));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="relative">
        <svg width={chartWidth} height={height} className="overflow-visible">
          <defs>
            <linearGradient id="createdGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0"/>
            </linearGradient>
            <linearGradient id="closedGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#10b981" stopOpacity="0.3"/>
              <stop offset="100%" stopColor="#10b981" stopOpacity="0"/>
            </linearGradient>
          </defs>

          <path
            d={`${createdPath} L ${(data.length - 1) * stepX},${chartHeight} L 0,${chartHeight} Z`}
            fill="url(#createdGradient)"
          />
          <path
            d={`${closedPath} L ${(data.length - 1) * stepX},${chartHeight} L 0,${chartHeight} Z`}
            fill="url(#closedGradient)"
          />

          <path
            d={createdPath}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
          />
          <path
            d={closedPath}
            fill="none"
            stroke="#10b981"
            strokeWidth="2"
          />

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
                {data[index].label}
              </text>
            </g>
          ))}
        </svg>

        <div className="flex items-center justify-center mt-4 space-x-6">
          <div className="flex items-center">
            <div className="w-3 h-3 bg-blue-500 rounded-full mr-2" />
            <span className="text-sm text-gray-600">Cases Created</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-2" />
            <span className="text-sm text-gray-600">Cases Closed</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LineChart;