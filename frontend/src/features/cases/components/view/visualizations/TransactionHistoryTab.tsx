import React from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
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
  ComposedChart,
} from 'recharts';

const TransactionHistoryTab: React.FC = () => {
  const [timeFilter, setTimeFilter] = React.useState('Last Month');
  const [showFilterDropdown, setShowFilterDropdown] = React.useState(false);
  const [showBenfordsAnalysis, setShowBenfordsAnalysis] = React.useState(false);

  const timeFilters = ['Last Day', 'Last Week', 'Last Month', 'Last Year', 'All History'];

  const chartData = React.useMemo(() => [
    { day: 0, date: 'Nov 25', amount: 8000, count: 2, alert: false },
    { day: 1, date: 'Nov 26', amount: 9500, count: 3, alert: false },
    { day: 2, date: 'Nov 27', amount: 11000, count: 3, alert: false },
    { day: 3, date: 'Nov 28', amount: 10000, count: 2, alert: false },
    { day: 4, date: 'Nov 29', amount: 7000, count: 2, alert: false },
    { day: 5, date: 'Nov 30', amount: 5000, count: 1, alert: false },
    { day: 6, date: 'Dec 1', amount: 6500, count: 2, alert: false },
    { day: 7, date: 'Dec 2', amount: 9000, count: 3, alert: true },
    { day: 8, date: 'Dec 3', amount: 11500, count: 3, alert: false },
    { day: 9, date: 'Dec 4', amount: 10500, count: 2, alert: false },
    { day: 10, date: 'Dec 5', amount: 7500, count: 2, alert: false },
    { day: 11, date: 'Dec 6', amount: 4500, count: 1, alert: false },
    { day: 12, date: 'Dec 7', amount: 3500, count: 1, alert: false },
    { day: 13, date: 'Dec 8', amount: 5500, count: 2, alert: false },
    { day: 14, date: 'Dec 9', amount: 13500, count: 4, alert: true },
    { day: 15, date: 'Dec 10', amount: 12000, count: 3, alert: false },
    { day: 16, date: 'Dec 11', amount: 8000, count: 2, alert: false },
    { day: 17, date: 'Dec 12', amount: 6000, count: 2, alert: false },
    { day: 18, date: 'Dec 13', amount: 9500, count: 3, alert: false },
    { day: 19, date: 'Dec 14', amount: 12500, count: 3, alert: false },
    { day: 20, date: 'Dec 15', amount: 13000, count: 4, alert: false },
    { day: 21, date: 'Dec 16', amount: 10500, count: 3, alert: false },
    { day: 22, date: 'Dec 17', amount: 9000, count: 2, alert: false },
    { day: 23, date: 'Dec 18', amount: 7500, count: 2, alert: false },
    { day: 24, date: 'Dec 19', amount: 11000, count: 3, alert: false },
    { day: 25, date: 'Dec 20', amount: 13500, count: 4, alert: true },
    { day: 26, date: 'Dec 21', amount: 12000, count: 3, alert: false },
    { day: 27, date: 'Dec 22', amount: 8500, count: 2, alert: false },
    { day: 28, date: 'Dec 23', amount: 10500, count: 3, alert: false },
    { day: 29, date: 'Dec 24', amount: 12000, count: 3, alert: false },
  ], []);

  const volumeDistribution = [
    { date: 'Dec 11', value: 5 },
    { date: 'Dec 12', value: 3 },
    { date: 'Dec 13', value: 2 },
    { date: 'Dec 14', value: 8 },
    { date: 'Dec 15', value: 6 },
    { date: 'Dec 16', value: 5 },
    { date: 'Dec 17', value: 3 },
    { date: 'Dec 18', value: 9 },
    { date: 'Dec 19', value: 10 },
    { date: 'Dec 20', value: 6 },
    { date: 'Dec 21', value: 5 },
    { date: 'Dec 22', value: 6 },
  ];

  const cumulativeData = React.useMemo(() => {
    let sum = 0;
    return chartData.map(d => ({
      date: d.date,
      cumulative: (sum += d.amount)
    }));
  }, [chartData]);

  const benfordsData = [
    { digit: '1', expected: 30.1, actual: 32 },
    { digit: '2', expected: 17.6, actual: 18 },
    { digit: '3', expected: 12.5, actual: 13 },
    { digit: '4', expected: 9.7, actual: 10 },
    { digit: '5', expected: 7.9, actual: 8 },
    { digit: '6', expected: 6.7, actual: 11 },
    { digit: '7', expected: 5.8, actual: 5 },
    { digit: '8', expected: 5.1, actual: 9 },
    { digit: '9', expected: 4.6, actual: 5 },
  ];

  return (
    <div className="space-y-6">
      {/* Header with Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Transaction History Analysis</h3>
          <p className="text-sm text-gray-600 mt-1">
            Historical transaction patterns and behavioral analysis for ACC-1234
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowFilterDropdown(!showFilterDropdown)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-md bg-white text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {timeFilter}
            <ChevronDownIcon className="h-4 w-4" />
          </button>
          {showFilterDropdown && (
            <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10">
              {timeFilters.map((filter) => (
                <button
                  key={filter}
                  onClick={() => {
                    setTimeFilter(filter);
                    setShowFilterDropdown(false);
                  }}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${
                    filter === timeFilter ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                  }`}
                >
                  {filter}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Total Volume
          </div>
          <div className="text-2xl font-bold text-gray-900">$308,255</div>
          <div className="text-xs text-gray-500 mt-1">Avg. $1,902/day</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Total Transactions
          </div>
          <div className="text-2xl font-bold text-gray-900">162</div>
          <div className="text-xs text-gray-500 mt-1">Avg. 5 per day</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Alerts Triggered
          </div>
          <div className="text-2xl font-bold text-gray-900">6</div>
          <div className="text-xs text-gray-500 mt-1">Over last 6 days</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Investigated
          </div>
          <div className="text-2xl font-bold text-gray-900">2</div>
          <div className="text-xs text-gray-500 mt-1">Cases opened</div>
        </div>
      </div>

      {/* Transaction Timeline */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-6">Transaction Timeline</h4>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart
            data={chartData}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              stroke="#e5e7eb"
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              stroke="#e5e7eb"
              label={{ value: 'Amount ($)', angle: -90, position: 'insideLeft' }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              stroke="#e5e7eb"
              label={{ value: 'Count', angle: 90, position: 'insideRight' }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value) => value}
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              iconType="line"
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="amount"
              stroke="#60a5fa"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              name="Amount ($)"
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="count"
              stroke="#14b8a6"
              strokeWidth={2.5}
              dot={false}
              isAnimationActive={false}
              name="Transaction Count"
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cumulative Value */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-6">Cumulative Value</h4>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={cumulativeData}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f9fafb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                stroke="#e5e7eb"
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                stroke="#e5e7eb"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value) => `$${value.toLocaleString()}`}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="cumulative"
                stroke="#8b5cf6"
                strokeWidth={2.5}
                dot={{ fill: '#8b5cf6', r: 3 }}
                isAnimationActive={false}
                name="Cumulative Value"
              />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Transaction Volume Distribution */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-6">Transaction Volume Distribution</h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={volumeDistribution}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f9fafb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                stroke="#e5e7eb"
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                stroke="#e5e7eb"
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: '#fff',
                  border: '1px solid #e5e7eb',
                  borderRadius: '6px',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                }}
                formatter={(value) => value}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Bar
                dataKey="value"
                fill="#3b82f6"
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
                name="Transactions"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Benford's Law */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-semibold text-gray-900">Benford's Law Distribution Analysis</h4>
            <p className="text-xs text-gray-600 mt-1">Comparing first-digit distribution of transaction amounts against expected Benford's Law distribution</p>
          </div>
          <button
            onClick={() => setShowBenfordsAnalysis(!showBenfordsAnalysis)}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            {showBenfordsAnalysis ? 'Hide Analysis' : 'Show Analysis'}
          </button>
        </div>

        {showBenfordsAnalysis && (
          <>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={benfordsData}
                margin={{ top: 20, right: 30, left: 0, bottom: 20 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis
                  dataKey="digit"
                  label={{ value: 'First Digit', position: 'insideBottomRight', offset: -10 }}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  stroke="#e5e7eb"
                />
                <YAxis
                  label={{ value: 'Frequency (%)', angle: -90, position: 'insideLeft' }}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  stroke="#e5e7eb"
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '6px',
                  }}
                  formatter={(value) => `${value}%`}
                />
                <Legend />
                <Bar
                  dataKey="expected"
                  fill="#10b981"
                  radius={[4, 4, 0, 0]}
                  name="Expected (Benford)"
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="actual"
                  fill="#3b82f6"
                  radius={[4, 4, 0, 0]}
                  name="Actual"
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex gap-3">
                <div className="flex-shrink-0 text-yellow-600 mt-0.5">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-yellow-800">Deviation Detected</h3>
                  <p className="text-sm text-yellow-700 mt-1">Actual distribution shows significant variance from expected Benford's Law pattern, particularly in digits 1, 5, and 9. This may indicate potential manipulation or structuring.</p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Transactions Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-5 border-b border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900">Recent Transactions</h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Transaction ID
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Counterparty
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              <tr className="hover:bg-gray-50">
                <td className="px-5 py-4 text-sm font-medium text-gray-900">TXN-8921</td>
                <td className="px-5 py-4 text-sm text-gray-900">2024-01-15</td>
                <td className="px-5 py-4 text-sm text-gray-900">Wire Transfer</td>
                <td className="px-5 py-4 text-sm text-gray-900">ABC Corp</td>
                <td className="px-5 py-4 text-sm text-gray-900">$12,500</td>
                <td className="px-5 py-4">
                  <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-red-50 text-red-700 ring-1 ring-red-200">
                    Alert
                  </span>
                </td>
                <td className="px-5 py-4">
                  <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                    View Details
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistoryTab;
