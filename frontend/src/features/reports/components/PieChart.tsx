import React from 'react';
import {
  PieChart as ReChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

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
  showZeroLegend?: boolean;
}

const PieChart: React.FC<PieChartProps> = ({
  data,
  title,
  size = 350,
  isLoading = false,
  showZeroLegend = false,
}) => {
  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">
          {title}
        </h3>
        <div
          className="animate-pulse flex items-center justify-center"
          style={{ height: size }}
        >
          <div
            className="bg-gray-200 rounded-full"
            style={{ width: size * 0.6, height: size * 0.6 }}
          ></div>
        </div>
      </div>
    );
  }

  const validData = data.filter((item) => item.value > 0);
  const total = validData.reduce((sum, item) => sum + item.value, 0);
  const legendData = showZeroLegend ? data : validData;
  const renderLegend = () => (
    <div className="mt-6 grid grid-cols-2 gap-2 text-sm">
      {legendData.map((item, index) => (
        <div key={index} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: item.color }}
          ></div>
          <span className="font-medium text-gray-900">{item.label}: {(total > 0 ? (item.value / total) * 100 : 0).toFixed(1)}%</span>
        </div>
      ))}
    </div>
  );

  if (total === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">
          {title}
        </h3>
        <div
          className="flex items-center justify-center"
          style={{ height: size }}
        >
          <p className="text-gray-500">No data available</p>
        </div>
        {showZeroLegend && legendData.length > 0 && renderLegend()}
      </div>
    );
  }

  const chartData = validData.map((item) => ({
    name: item.label,
    value: item.value,
    percentage: ((item.value / total) * 100).toFixed(1),
    color: item.color,
  }));

  const renderLabel = ({ percentage }: any) => `${percentage}%`;

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={size}>
        <ReChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius="42%"
            labelLine={false}
            label={renderLabel}
            outerRadius="70%"
            fill="#8884d8"
            dataKey="value"
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `${value} cases`} />
          <Legend />
        </ReChart>
      </ResponsiveContainer>
      {renderLegend()}
    </div>
  );
};

export default PieChart;
