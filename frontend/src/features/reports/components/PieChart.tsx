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
}

const PieChart: React.FC<PieChartProps> = ({ data, title, size = 200 }) => {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  
  let cumulativePercentage = 0;
  const segments = data.map((item) => {
    const percentage = (item.value / total) * 100;
    const startAngle = cumulativePercentage * 3.6;
    const endAngle = (cumulativePercentage + percentage) * 3.6;
    cumulativePercentage += percentage;
    
    const x1 = 50 + 40 * Math.cos((startAngle - 90) * Math.PI / 180);
    const y1 = 50 + 40 * Math.sin((startAngle - 90) * Math.PI / 180);
    const x2 = 50 + 40 * Math.cos((endAngle - 90) * Math.PI / 180);
    const y2 = 50 + 40 * Math.sin((endAngle - 90) * Math.PI / 180);
    
    const largeArcFlag = percentage > 50 ? 1 : 0;
    
    return {
      ...item,
      percentage,
      path: `M 50,50 L ${x1},${y1} A 40,40 0 ${largeArcFlag},1 ${x2},${y2} z`
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
