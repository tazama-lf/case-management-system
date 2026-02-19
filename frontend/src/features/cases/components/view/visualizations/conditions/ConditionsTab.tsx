import React, { useState, useEffect } from 'react';
import ConditionsService from './services/service';
import TransactionDetailsService from '../transactiondetails/services/service';
import type { ConditionsData } from './types';

interface ConditionsTabProps {
  caseId?: number;
  transactionId?: string;
}

const ConditionsTab: React.FC<ConditionsTabProps> = ({
  caseId,
  transactionId,
}) => {
  const [timeRange, setTimeRange] = useState('Last 30 Days');
  const [data, setData] = useState<ConditionsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const timeRangeOptions = [
    'Last 30 Days',
    'Last 60 Days',
    'Last 90 Days',
    'Last 6 Months',
    'Last Year',
    'All Time',
  ];

  // Helper function to calculate fromDate based on time range
  const getFromDate = (range: string): string | undefined => {
    const now = new Date();
    let daysAgo = 0;

    switch (range) {
      case 'Last 30 Days':
        daysAgo = 30;
        break;
      case 'Last 60 Days':
        daysAgo = 60;
        break;
      case 'Last 90 Days':
        daysAgo = 90;
        break;
      case 'Last 6 Months':
        daysAgo = 180;
        break;
      case 'Last Year':
        daysAgo = 365;
        break;
      case 'All Time':
        return undefined;
      default:
        return undefined;
    }

    const fromDate = new Date(now);
    fromDate.setDate(fromDate.getDate() - daysAgo);
    return fromDate.toISOString().split('T')[0]; // Format as YYYY-MM-DD
  };

  useEffect(() => {
    const fetchData = async () => {
      // Prioritize transactionId flow as requested
      if (!transactionId) {
        return;
      }

      setLoading(true);
      setError(null);
      try {
        // 1. Fetch Transaction Details to get Account ID
        const txnDetails =
          await TransactionDetailsService.getTransactionDetails(transactionId);

        // 2. Extract Creditor Account IBAN or use sample account for testing
        const accountId =
          txnDetails.creditorProfile?.account?.iban ||
          '7777cdefaa9b430692dafe4bd0ef9999'; // Fallback sample account for testing

        console.log('Using accountId for conditions:', accountId);

        // 3. Fetch Conditions using Account ID with date filter
        const fromDate = getFromDate(timeRange);
        const response = await ConditionsService.getConditionsData(
          accountId,
          fromDate,
        );
        setData(response);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to fetch conditions',
        );
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [caseId, transactionId, timeRange]);

  if (loading) {
    return (
      <div className="p-4 text-center text-gray-500">Loading conditions...</div>
    );
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  }

  if (!data) {
    return (
      <div className="p-4 text-center text-gray-500">No data available</div>
    );
  }

  return (
    <div className="space-y-6 p-4">
      {/* Header with Filter */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            Conditions View
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Conditions and conditions for{' '}
            {caseId || transactionId || 'Unknown ID'}
          </p>
        </div>
        <select
          value={timeRange}
          onChange={(e) => setTimeRange(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium text-gray-900 hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {timeRangeOptions.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            Active Conditions
          </div>
          <div className="text-2xl font-bold text-red-600">
            {data.metrics?.active ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            Blocked Transactions
          </div>
          <div className="text-2xl font-bold text-orange-600">
            {data.metrics?.blocked ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            Overridden Transactions
          </div>
          <div className="text-2xl font-bold text-green-600">
            {data.metrics?.overridden ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            Future Conditions
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {data.metrics?.future ?? 0}
          </div>
        </div>
      </div>

      {/* Active Conditions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Active Conditions
        </h3>
        <div className="space-y-3">
          {data.activeConditions?.length > 0 ? (
            data.activeConditions.map((condition) => (
              <div
                key={condition.id}
                className={`rounded-lg border-l-4 p-4 ${condition.severity === 'high'
                    ? 'border-l-red-500 bg-red-50'
                    : condition.severity === 'medium'
                      ? 'border-l-yellow-500 bg-yellow-50'
                      : 'border-l-green-500 bg-green-50'
                  }`}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {condition.title}
                    </h4>
                    <div className="mt-2 space-y-1">
                      <p className="text-xs text-gray-600">
                        <span className="font-medium">Start:</span>{' '}
                        {new Date(condition.startDate).toLocaleString()}
                        {condition.endDate && (
                          <>
                            {' | '}
                            <span className="font-medium">End:</span>{' '}
                            {new Date(condition.endDate).toLocaleString()}
                          </>
                        )}
                      </p>
                      {condition.createdBy && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Created by:</span>{' '}
                          {condition.createdBy}
                        </p>
                      )}
                      {condition.action && (
                        <p className="text-xs text-gray-600">
                          <span className="font-medium">Action:</span>{' '}
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-semibold ${condition.action === 'BLOCK'
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                              }`}
                          >
                            {condition.action}
                          </span>
                        </p>
                      )}
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${condition.status === 'ACTIVE'
                        ? 'bg-green-100 text-green-800'
                        : condition.status === 'EXPIRED'
                          ? 'bg-gray-100 text-gray-800'
                          : 'bg-purple-100 text-purple-800'
                      }`}
                  >
                    {condition.status}
                  </span>
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500">No active conditions.</p>
          )}
        </div>
      </div>

      {/* Evaluated Transactions */}
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <h3 className="text-sm font-semibold text-gray-900 mb-4">
          Evaluated Transactions
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Transaction ID
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Date
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Type
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Amount
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Currency
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Outcome
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Condition ID
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Reason
                </th>
              </tr>
            </thead>
            <tbody>
              {data.evaluatedTransactions?.length > 0 ? (
                data.evaluatedTransactions.map((txn) => (
                  <tr
                    key={txn.id}
                    className="border-b border-gray-200 hover:bg-gray-50"
                  >
                    <td className="px-4 py-3 text-gray-900 font-semibold">
                      {txn.id}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {new Date(txn.date).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{txn.type}</td>
                    <td className="px-4 py-3 text-gray-600">{txn.amount}</td>
                    <td className="px-4 py-3 text-gray-600">{txn.currency}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${txn.outcome === 'PASSED'
                            ? 'bg-green-100 text-green-800'
                            : txn.outcome === 'BLOCKED'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                      >
                        {txn.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {txn.conditionId}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{txn.reason}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={8}
                    className="px-4 py-3 text-center text-gray-500"
                  >
                    No evaluated transactions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Expired & Future Conditions */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Expired Conditions
          </h3>
          <div className="space-y-3">
            {data.expiredConditions?.length > 0 ? (
              data.expiredConditions.map((condition) => (
                <div
                  key={condition.id}
                  className="rounded-lg border border-gray-300 bg-gray-50 p-4"
                >
                  <p className="text-sm text-gray-700 font-medium">
                    {condition.title}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    {new Date(condition.startDate).toLocaleDateString()} -{' '}
                    {new Date(condition.endDate || '').toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No expired conditions.</p>
            )}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Future Conditions
          </h3>
          <div className="space-y-3">
            {data.futureConditions?.length > 0 ? (
              data.futureConditions.map((condition) => (
                <div
                  key={condition.id}
                  className="rounded-lg border border-purple-300 bg-purple-50 p-4"
                >
                  <p className="text-sm text-gray-700 font-medium">
                    {condition.title}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Effective from{' '}
                    {new Date(condition.startDate).toLocaleDateString()}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No future conditions.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConditionsTab;
