import React from 'react';

interface PieChartData {
  label: string;
  value: number;
  color: string;
  percentage: number;
}

interface PieChartProps {
  data: PieChartData[];
  title: string;
  size?: number;
  isLoading?: boolean;
}

const PieChart: React.FC<PieChartProps> = ({ data, title, size = 200, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="animate-pulse flex items-center justify-between">
          <div className="bg-gray-200 rounded-full" style={{ width: size, height: size }}></div>
          <div className="ml-6 space-y-2">
            {[...Array(4)].map((_, index) => (
              <div key={index} className="flex items-center">
                <div className="bg-gray-200 rounded-full w-3 h-3 mr-2"></div>
                <div className="bg-gray-200 rounded w-16 h-4 mr-2"></div>
                <div className="bg-gray-200 rounded w-8 h-4"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const validData = data.filter(item => item.value > 0);
  const total = validData.reduce((sum, item) => sum + item.value, 0);

  if (total === 0) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="flex items-center justify-center" style={{ height: size }}>
          <p className="text-gray-500">No data available</p>
        </div>
      </div>
    );
  }

  let cumulativePercentage = 0;
  const segments = validData.map((item) => {
    const percentage = (item.value / total) * 100;
    const startAngle = cumulativePercentage * 3.6;
    const endAngle = (cumulativePercentage + percentage) * 3.6;
    cumulativePercentage += percentage;

    const x1 = 50 + 40 * Math.cos((Math.max(0, startAngle) - 90) * Math.PI / 180);
    const y1 = 50 + 40 * Math.sin((Math.max(0, startAngle) - 90) * Math.PI / 180);
    const x2 = 50 + 40 * Math.cos((Math.max(0, endAngle) - 90) * Math.PI / 180);
    const y2 = 50 + 40 * Math.sin((Math.max(0, endAngle) - 90) * Math.PI / 180);

    const largeArcFlag = percentage > 50 ? 1 : 0;

    const safeX1 = isNaN(x1) ? 50 : x1;
    const safeY1 = isNaN(y1) ? 50 : y1;
    const safeX2 = isNaN(x2) ? 50 : x2;
    const safeY2 = isNaN(y2) ? 50 : y2;

    return {
      ...item,
      percentage,
      path: `M 50,50 L ${safeX1},${safeY1} A 40,40 0 ${largeArcFlag},1 ${safeX2},${safeY2} z`
    };
  });

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="flex items-center justify-between">
        <div className="relative">
          <svg width={size} height={size} viewBox="0 0 100 100" className="transform -rotate-90">
            {segments.map((segment, index) => (
              <path
                key={index}
                d={segment.path}
                fill={segment.color}
                stroke="white"
                strokeWidth="0.5"
              />
            ))}
          </svg>
        </div>
        <div className="ml-6 space-y-2">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center text-sm">
              <div
                className="w-3 h-3 rounded-full mr-2"
                style={{ backgroundColor: segment.color }}
              />
              <span className="text-gray-600 mr-2">{segment.label}:</span>
              <span className="font-medium text-gray-900">{segment.percentage.toFixed(0)}%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PieChart;