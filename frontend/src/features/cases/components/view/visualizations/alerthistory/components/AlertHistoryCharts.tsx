import React from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface ChartData {
  date: string;
  alerts?: number;
  cases?: number;
  investigations?: number;
  value?: number;
}

interface AlertHistoryChartsProps {
  countData: ChartData[];
  valueData: ChartData[];
}

export const AlertHistoryCharts: React.FC<AlertHistoryChartsProps> = ({
  countData,
  valueData,
}) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Alert Count Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          Alert, Case & Investigation Trend
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={countData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="alerts" fill="#ef4444" />
            <Bar dataKey="cases" fill="#f59e0b" />
            <Bar dataKey="investigations" fill="#3b82f6" />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Transaction Value Chart */}
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h4 className="text-sm font-semibold text-gray-900 mb-4">
          Transaction Value Trend
        </h4>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={valueData}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="date" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line
              type="monotone"
              dataKey="value"
              stroke="#3b82f6"
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
