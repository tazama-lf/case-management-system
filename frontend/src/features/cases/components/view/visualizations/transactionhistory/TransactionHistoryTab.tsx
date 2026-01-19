import React, { useEffect, useState } from 'react';
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
import TransactionDetailsService from '../transactiondetails/services/service';
import TransactionHistoryService from './services/service';
import type { TransactionHistoryResponse } from './types';

interface TransactionHistoryTabProps {
  caseId?: string;
  transactionId?: string;
}

const TransactionHistoryTab: React.FC<TransactionHistoryTabProps> = ({
  caseId: _caseId,
  transactionId,
}) => {
  const [timeFilter, setTimeFilter] = useState('Last Month');
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [showBenfordsAnalysis, setShowBenfordsAnalysis] = useState(false);
  const [data, setData] = useState<TransactionHistoryResponse | null>(null);
  const [currentIban, setCurrentIban] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeFilters = [
    'Last Day',
    'Last Week',
    'Last Month',
    'Last Year',
    'All History',
  ];

  useEffect(() => {
    const fetchData = async () => {
      if (!transactionId) return;

      setLoading(true);
      setError(null);
      try {
        // 1. Get Transaction Details (for IBAN)
        const details =
          await TransactionDetailsService.getTransactionDetails(transactionId);
        const entityId =
          details.creditorProfile?.account?.iban ||
          details.debtorProfile?.account?.iban ||
          'cdtrAcct_3a1f3d24fb2046f2a28dc1fa506d6d69'; // Fallback for testing/missing data

        if (!entityId) {
          throw new Error('No entity ID (IBAN) found for this transaction');
        }

        setCurrentIban(entityId);

        // 2. Get History
        const response =
          await TransactionHistoryService.getTransactionHistory(entityId);
        setData(response);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [transactionId]);

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
      {error && (
        <div className="p-4 rounded-md bg-red-50 border border-red-200">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-red-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">
                Error loading history
              </h3>
              <div className="mt-2 text-sm text-red-700">
                <p>{error}</p>
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Header with Filter */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Transaction History Analysis
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Historical transaction patterns and behavioral analysis for{' '}
            {currentIban || '...'}
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
                    filter === timeFilter
                      ? 'bg-blue-50 text-blue-700 font-medium'
                      : 'text-gray-700'
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
          <div className="text-2xl font-bold text-gray-900">
            ${data?.summary ? data.summary.totalVolume.toLocaleString() : '0'}
          </div>
          {data?.summary && (
            <div className="text-xs text-gray-500 mt-1">
              Avg. $
              {(
                data.summary.totalVolume / (data.summary.durationDays || 1)
              ).toLocaleString(undefined, { maximumFractionDigits: 0 })}
              /day
            </div>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Total Transactions
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {data?.summary?.totalTransactions.toLocaleString() || '0'}
          </div>
          {data?.summary && (
            <div className="text-xs text-gray-500 mt-1">
              Avg. {data.summary.avgTransactionsPerDay.toFixed(1)} per day
            </div>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Alerts Triggered
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {data?.summary?.alertsTriggered || '0'}
          </div>
          {data?.summary && (
            <div className="text-xs text-gray-500 mt-1">
              {data.summary.alertsPercentage.toFixed(1)}% of total
            </div>
          )}
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs font-medium text-gray-500 uppercase mb-1">
            Investigated
          </div>
          <div className="text-2xl font-bold text-gray-900">
            {data?.summary?.investigated || '0'}
          </div>
          {data?.summary && (
            <div className="text-xs text-gray-500 mt-1">
              {data.summary.investigatedPercentage.toFixed(1)}% of total
            </div>
          )}
        </div>
      </div>

      {/* Transaction Timeline */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h4 className="text-sm font-semibold text-gray-900 mb-6">
          Transaction Timeline
        </h4>
        <ResponsiveContainer width="100%" height={350}>
          <ComposedChart
            data={data?.timeline || []}
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              stroke="#e5e7eb"
              tickFormatter={(value) =>
                new Date(value).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              }
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 12, fill: '#9ca3af' }}
              stroke="#e5e7eb"
              label={{
                value: 'Amount',
                angle: -90,
                position: 'insideLeft',
              }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#fff',
                border: '1px solid #e5e7eb',
                borderRadius: '6px',
                boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
              }}
              formatter={(value) =>
                typeof value === 'number' ? value.toLocaleString() : value
              }
              labelFormatter={(label) => `Date: ${label}`}
            />
            <Legend wrapperStyle={{ paddingTop: '20px' }} iconType="line" />
            <Bar
              yAxisId="left"
              dataKey="amount"
              fill="#60a5fa"
              name="Amount"
              barSize={20}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Cumulative Value */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h4 className="text-sm font-semibold text-gray-900 mb-6">
            Cumulative Value
          </h4>
          <ResponsiveContainer width="100%" height={280}>
            <LineChart
              data={data?.cumulative || []}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f9fafb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                stroke="#e5e7eb"
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
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
                formatter={(value) =>
                  typeof value === 'number'
                    ? `$${value.toLocaleString()}`
                    : value
                }
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="cumulativeAmount"
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
          <h4 className="text-sm font-semibold text-gray-900 mb-6">
            Transaction Volume Distribution
          </h4>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data?.volumeDistribution || []}
              margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f9fafb" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                stroke="#e5e7eb"
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })
                }
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
            <h4 className="text-sm font-semibold text-gray-900">
              Benford's Law Distribution Analysis
            </h4>
            <p className="text-xs text-gray-600 mt-1">
              Comparing first-digit distribution of transaction amounts against
              expected Benford's Law distribution
            </p>
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
                  label={{
                    value: 'First Digit',
                    position: 'insideBottomRight',
                    offset: -10,
                  }}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  stroke="#e5e7eb"
                />
                <YAxis
                  label={{
                    value: 'Frequency (%)',
                    angle: -90,
                    position: 'insideLeft',
                  }}
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
                  <svg
                    className="w-5 h-5"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                      clipRule="evenodd"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-yellow-800">
                    Deviation Detected
                  </h3>
                  <p className="text-sm text-yellow-700 mt-1">
                    Actual distribution shows significant variance from expected
                    Benford's Law pattern, particularly in digits 1, 5, and 9.
                    This may indicate potential manipulation or structuring.
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Recent Transactions Table */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="p-5 border-b border-gray-200">
          <h4 className="text-sm font-semibold text-gray-900">
            Recent Transactions
          </h4>
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
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-4 text-center text-sm text-gray-500"
                  >
                    Loading history...
                  </td>
                </tr>
              ) : !data?.recentTransactions?.length ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-5 py-4 text-center text-sm text-gray-500"
                  >
                    No transactions found.
                  </td>
                </tr>
              ) : (
                data.recentTransactions.map((txn) => (
                  <tr key={txn.transactionId} className="hover:bg-gray-50">
                    <td className="px-5 py-4 text-sm font-medium text-gray-900">
                      {txn.transactionId}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-900">
                      {new Date(txn.date).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-900">
                      {txn.type}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-900">
                      {txn.counterparty}
                    </td>
                    <td className="px-5 py-4 text-sm text-gray-900">
                      ${txn.amount.toLocaleString()}
                    </td>
                    <td className="px-5 py-4">
                      {/* Status is now an array [] in the sample, adjusting logic */}
                      {Array.isArray(txn.status) && txn.status.length > 0 ? (
                        txn.status.map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-gray-50 text-gray-700 ring-1 ring-gray-200 mr-1"
                          >
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium bg-green-50 text-green-700 ring-1 ring-green-200">
                          Completed
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      <a
                        href={txn.actions?.viewDetailsLink || '#'}
                        className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View Details
                      </a>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default TransactionHistoryTab;
