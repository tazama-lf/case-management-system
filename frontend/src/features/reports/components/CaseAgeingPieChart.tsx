import React from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import type { AgeingDistribution } from '../types/reports.types';

interface CaseAgeingPieChartProps {
  data: AgeingDistribution[];
  title: string;
  size?: number;
}

/** Same band set and colors as CaseAgeingBarChart - the two must never drift apart. */
const ageColors = {
  '0-7 days': '#10b981',
  '8-15 days': '#f59e0b',
  '16-30 days': '#ef4444',
  '30+ days': '#991b1b',
};

const CaseAgeingPieChart: React.FC<CaseAgeingPieChartProps> = ({
  data,
  title,
  size = 350,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6 w-full max-w-full">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4 sm:mb-6">
          {title}
        </h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No data available</p>
        </div>
      </div>
    );
  }

  const allAgeRanges = ['0-7 days', '8-15 days', '16-30 days', '30+ days'];
  const completeData = allAgeRanges.map((range) => {
    const existing = data.find((item) => item.ageRange === range);
    return {
      ageRange: range,
      count: existing?.count ?? 0,
      // Percentages come straight from the backend's largest-remainder
      // reconciliation, so this donut always sums to exactly 100.
      percentage: existing?.percentage ?? 0,
    };
  });

  const total = completeData.reduce((sum, item) => sum + (item.count || 0), 0);

  if (total === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6 w-full max-w-full">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4 sm:mb-6">
          {title}
        </h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">No cases found</p>
        </div>
      </div>
    );
  }

  const chartData = completeData.map((item) => ({
    name: item.ageRange,
    value: item.count,
    percentage: item.percentage.toFixed(0),
  }));

  const pieData = chartData.filter((item) => item.value > 0);

  const CustomLegend = () => (
    <div className="flex flex-wrap justify-center gap-4 mt-4">
      {chartData.map((item) => (
        <div key={item.name} className="flex items-center gap-2">
          <div
            className="w-3 h-3 rounded-sm"
            style={{
              backgroundColor:
                ageColors[item.name as keyof typeof ageColors] || '#94a3b8',
            }}
          />
          <span className="text-sm text-gray-700">
            {item.name}: {item.percentage}% · {item.value}{' '}
            {item.value === 1 ? 'case' : 'cases'}
          </span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 w-full max-w-full">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={size}>
        <PieChart>
          <Pie
            data={pieData}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={false}
            innerRadius="55%"
            outerRadius="80%"
            paddingAngle={2}
            fill="#8884d8"
            dataKey="value"
            minAngle={5}
          >
            {pieData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={
                  ageColors[entry.name as keyof typeof ageColors] || '#94a3b8'
                }
                stroke="#fff"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, props) => [
              `${value} cases (${props.payload.percentage}%)`,
              props.payload.name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
      <CustomLegend />
    </div>
  );
};

export default CaseAgeingPieChart;
