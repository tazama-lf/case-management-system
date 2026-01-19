import React, { useState, useEffect } from 'react';
import ConditionsService from './services/service';
import TransactionDetailsService from '../transactiondetails/services/service';
import type { ConditionsResponse } from './types';

interface ConditionsTabProps {
  caseId?: string;
  transactionId?: string;
}

const ConditionsTab: React.FC<ConditionsTabProps> = ({
  caseId,
  transactionId,
}) => {
  const [timeRange, setTimeRange] = useState('Last 30 Days');
  const [data, setData] = useState<ConditionsResponse | null>(null);
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

        // 2. Extract Creditor Account IBAN
        const accountId = txnDetails.creditorProfile?.account?.iban;

        if (!accountId) {
          throw new Error(
            'Could not find Creditor Account IBAN in transaction details',
          );
        }

        // 3. Fetch Conditions using Account ID
        const response = await ConditionsService.getConditions(accountId);
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
  }, [caseId, transactionId]);

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
            Approved Transactions
          </div>
          <div className="text-2xl font-bold text-green-600">
            {data.metrics?.approved ?? 0}
          </div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="text-xs text-gray-600 uppercase font-semibold mb-2">
            Review Conditions
          </div>
          <div className="text-2xl font-bold text-purple-600">
            {data.metrics?.review ?? 0}
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
                className={`rounded-lg border-l-4 p-4 ${
                  condition.severity === 'high'
                    ? 'border-l-red-500 bg-red-50'
                    : 'border-l-green-500 bg-green-50'
                }`}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-gray-900 text-sm">
                      {condition.title}
                    </h4>
                    <p className="text-xs text-gray-600 mt-1">
                      Start Date: {condition.startDate}
                      {condition.endDate && ` | End Date: ${condition.endDate}`}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded text-xs font-semibold ${
                      condition.status === 'No reply'
                        ? 'bg-red-100 text-red-800'
                        : 'bg-green-100 text-green-800'
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
                  Status
                </th>
                <th className="px-4 py-3 text-left font-semibold text-gray-900">
                  Jurisdiction
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
                    <td className="px-4 py-3 text-gray-600">{txn.date}</td>
                    <td className="px-4 py-3 text-gray-600">{txn.type}</td>
                    <td className="px-4 py-3 text-gray-600">{txn.amount}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          txn.status === 'COMPLIANT'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {txn.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {txn.jurisdiction}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{txn.reason}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
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

      {/* Earned & Future Conditions */}
      <div className="grid grid-cols-2 gap-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-900 mb-4">
            Earned Conditions
          </h3>
          <div className="space-y-3">
            {data.earnedConditions?.length > 0 ? (
              data.earnedConditions.map((condition) => (
                <div
                  key={condition.id}
                  className="rounded-lg border border-gray-300 bg-gray-50 p-4"
                >
                  <p className="text-sm text-gray-700 font-medium">
                    {condition.title}
                  </p>
                  <p className="text-xs text-gray-600 mt-2">
                    Active since {condition.startDate}{' '}
                    {condition.endDate ? `| Ends ${condition.endDate}` : ''}
                  </p>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">No earned conditions.</p>
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
                    Effective from {condition.startDate}
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
