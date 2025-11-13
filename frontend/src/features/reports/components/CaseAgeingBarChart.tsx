import React from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import type { AgeingByStatus } from '../types/reports.types';

interface CaseAgeingBarChartProps {
  data: AgeingByStatus[];
  title: string;
  subtitle?: string;
  height?: number;
}

const CaseAgeingBarChart: React.FC<CaseAgeingBarChartProps> = ({
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
          <p className="text-gray-500 text-center">No data available</p>
        </div>
      </div>
    );
  }

  const formatStatusName = (status: string) => {
    return status.replace('STATUS_', '').replace(/_/g, ' ').trim();
  };

  const chartData = data.map((item) => ({
    status: formatStatusName(item.status),
    '0-7 days': item.age0to7,
    '8-15 days': item.age8to15,
    '16-30 days': item.age16to30,
    '30+ days': item.age30Plus,
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
          <XAxis dataKey="status" tick={{ fontSize: 12 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="0-7 days" stackId="a" fill="#10b981" />
          <Bar dataKey="8-15 days" stackId="a" fill="#fbbf24" />
          <Bar dataKey="16-30 days" stackId="a" fill="#f97316" />
          <Bar dataKey="30+ days" stackId="a" fill="#ef4444" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CaseAgeingBarChart;
