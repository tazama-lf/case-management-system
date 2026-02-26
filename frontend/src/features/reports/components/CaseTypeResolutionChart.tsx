import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import type { CaseTypeResolution } from '../types/reports.types';

interface CaseTypeResolutionChartProps {
  data: CaseTypeResolution[];
  title: string;
  height?: number;
}

const CaseTypeResolutionChart: React.FC<CaseTypeResolutionChartProps> = ({
  data,
  title,
  height = 350,
}) => {
  if (!data || data.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow-md border border-gray-200 p-4 sm:p-6 w-full max-w-full">
        <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">
          {title}
        </h3>
        <div className="flex items-center justify-center h-48">
          <p className="text-gray-500 text-center">
            No closed cases in selected period
          </p>
        </div>
      </div>
    );
  }

  const chartData = data.map((item) => ({
    type:
      item.caseType === 'NONE'
        ? 'None'
        : item.caseType.replace(/_/gu, ' ').replace(/AND/gu, '&'),
    averageDays: Math.round(item.avgDays),
  }));

  return (
    <div className="bg-white rounded-lg shadow-md p-4 sm:p-6 w-full max-w-full">
      <h3 className="text-lg sm:text-xl font-semibold text-gray-700 mb-4">
        {title}
      </h3>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={chartData}
          margin={{ top: 20, right: 20, bottom: 5, left: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
          <XAxis dataKey="type" tick={{ fontSize: 12 }} />
          <YAxis
            domain={[0, (dataMax: number) => Math.max(dataMax + 1, 5)]}
            label={{ value: 'Days', angle: -90, position: 'insideLeft' }}
          />
          <Tooltip
            formatter={(value: number | undefined) => {
              if (!value || value === 0) {
                return ['< 1 day', 'Time to Resolve'];
              }
              return [
                `${value} ${value === 1 ? 'day' : 'days'}`,
                'Time to Resolve',
              ];
            }}
          />
          <Bar
            dataKey="averageDays"
            fill="#8b5cf6"
            name="Days to Resolution"
            minPointSize={5}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CaseTypeResolutionChart;
