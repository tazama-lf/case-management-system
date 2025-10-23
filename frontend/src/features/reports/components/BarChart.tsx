import React from 'react';

interface BarChartData {
  label: string;
  value: number;
  color: string;
}

interface BarChartProps {
  data: BarChartData[];
  title: string;
  height?: number;
  isLoading?: boolean;
}

const BarChart: React.FC<BarChartProps> = ({ data, title, height = 200, isLoading = false }) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
        <div className="animate-pulse flex items-end justify-between space-x-2" style={{ height }}>
          {[...Array(5)].map((_, index) => (
            <div key={index} className="flex flex-col items-center flex-1">
              <div className="bg-gray-200 rounded w-8 h-4 mb-1"></div>
              <div className="bg-gray-200 rounded w-full" style={{ height: `${Math.random() * (height - 60) + 20}px` }}></div>
              <div className="bg-gray-200 rounded w-12 h-3 mt-2"></div>
            </div>
          ))}
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
      </div>
    );
  }

  const maxValue = Math.max(...data.map(item => item.value));

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      <div className="flex items-end justify-between space-x-2" style={{ height }}>
        {data.map((item, index) => {
          const barHeight = (item.value / maxValue) * (height - 40);
          return (
            <div key={index} className="flex flex-col items-center flex-1">
              <div className="text-xs font-medium text-gray-900 mb-1">
                {item.value}
              </div>
              <div
                className="w-full rounded-t"
                style={{
                  height: `${barHeight}px`,
                  backgroundColor: item.color,
                  minHeight: '4px'
                }}
              />
              <div className="text-xs text-gray-600 mt-2 text-center">
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default BarChart;