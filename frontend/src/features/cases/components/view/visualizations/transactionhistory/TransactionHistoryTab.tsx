import React, { useEffect, useState } from 'react';
import { ChevronDownIcon } from '@heroicons/react/24/outline';
import TransactionDetailsService from '../transactiondetails/services/service';
import JupyterVisualization from '../shared/JupyterVisualization';

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
        <div className="flex items-center gap-3">
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
      </div>

      <div className="h-[1500px]">
        <JupyterVisualization
          notebook="transaction-history"
          params={{
            entityId: currentIban,
            filter: timeFilter,
          }}
          title="Transaction History Analysis"
          height="100%"
        />
      </div>
    </div>
  );
};

export default TransactionHistoryTab;
