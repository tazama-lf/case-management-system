import React from 'react';
import VoilaFrame from '../network-analysis/VoilaFrame';
import { useEntityMetadata } from '@/features/cases/hooks/useEntityMetadata';
import { ChevronDownIcon } from '@heroicons/react/24/outline';

type TimeRange = 'day' | 'month' | 'year' | 'all';
interface AlertHistoryTabProps {
  alertId: number;
  transactionId?: string;
  tenantId: string;
}

const AlertHistoryTab: React.FC<AlertHistoryTabProps> = ({
  alertId,
  transactionId,
  tenantId,
}) => {
  const [activeEntityRole, setActiveEntityRole] = React.useState<
    'creditor' | 'debtor'
  >('creditor');
  const [timeRange, setTimeRange] = React.useState<TimeRange>('month');
  const [showTimeDropdown, setShowTimeDropdown] = React.useState(false);
  const { entityMetadata } = useEntityMetadata(alertId, tenantId);

  const timeRangeOptions: Array<{ value: TimeRange; label: string }> = [
    { value: 'day', label: 'Day' },
    { value: 'month', label: 'Month' },
    { value: 'year', label: 'Year' },
    { value: 'all', label: 'All Time' },
  ];

  const selectedTimeLabel =
    timeRangeOptions.find((opt) => opt.value === timeRange)?.label ||
    'Last 30 Days';

  if (!alertId) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">
          Select an alert to view alert history
        </p>
      </div>
    );
  }

  // Show error state if no transaction ID
  if (!transactionId) {
    return (
      <div className="flex items-center justify-center h-[600px] bg-gray-50 border border-gray-200 rounded-lg">
        <div className="text-center p-8">
          <div className="text-gray-400 mb-4">
            <svg
              className="w-16 h-16 mx-auto"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            Transaction Data Unavailable
          </h3>
          <p className="text-sm text-gray-600 max-w-md">
            Alert history requires transaction information to display relevant
            data. This case may not have associated transaction details.
          </p>
        </div>
      </div>
    );
  }

  if (!entityMetadata) {
    return (
      <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
        <p className="text-sm text-gray-600">Loading entity metadata...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        {/* Left side */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Alert History
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Visualize alert history
          </p>
        </div>

        {/* Right side (grouped correctly) */}
        <div className="flex items-center gap-3">
          {/* Creditor/Debtor toggle */}
          <div className="flex bg-gray-100 p-1 rounded-md">
            <button
              onClick={() => {
                setActiveEntityRole('creditor');
              }}
              className={`px-4 py-1.5 text-sm rounded-md transition ${activeEntityRole === 'creditor'
                ? 'bg-white shadow text-blue-600 font-medium'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Creditor
            </button>

            <button
              onClick={() => {
                setActiveEntityRole('debtor');
              }}
              className={`px-4 py-1.5 text-sm rounded-md transition ${activeEntityRole === 'debtor'
                ? 'bg-white shadow text-blue-600 font-medium'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Debtor
            </button>
          </div>

          {/* Time Range Dropdown (moved here) */}
          <div className="relative">
            <button
              onClick={() => {
                setShowTimeDropdown(!showTimeDropdown);
              }}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              {selectedTimeLabel}
              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
            </button>

            {showTimeDropdown && (
              <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
                {timeRangeOptions.map((option) => (
                  <button
                    key={option.value}
                    onClick={() => {
                      setTimeRange(option.value);
                      setShowTimeDropdown(false);
                    }}
                    className={`block w-full px-4 py-2 text-left text-sm ${timeRange === option.value
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-gray-700 hover:bg-gray-50'
                      }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <VoilaFrame
        key={`${activeEntityRole}-${timeRange}-${transactionId}`}
        notebookPath="alert-history.ipynb"
        title="Alert History"
        queryParams={{
          tenantId: tenantId || '',
          entityId:
            activeEntityRole === 'creditor'
              ? entityMetadata?.creditorId
              : entityMetadata?.debtorId,
          granularity: timeRange,
        }}
      />
    </div>
  );
};

export default AlertHistoryTab;
