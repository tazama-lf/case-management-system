import React from 'react';
import TransactionNetworkTab from './TransactionNetworkTab';
import AccountNetworkTab from './AccountNetworkTab';
import CounterpartyNetworkTab from './CounterpartyNetworkTab';
import {
  ArrowsRightLeftIcon,
  BuildingOfficeIcon,
  UsersIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { useEntityMetadata } from '@/features/cases/hooks/useEntityMetadata';

type NetworkSubTab = 'transaction' | 'account' | 'counterparty';
type TimeRange = 'day' | 'month' | 'year' | 'all';

interface NetworkAnalysisTabProps {
  caseId?: number;
  transactionId?: string;
  alertId: number;
  tenantId: string;
}

const NetworkAnalysisTab: React.FC<NetworkAnalysisTabProps> = ({
  caseId,
  transactionId,
  alertId,
  tenantId,
}) => {
  const [activeSubTab, setActiveSubTab] =
    React.useState<NetworkSubTab>('transaction');
  const [timeRange, setTimeRange] = React.useState<TimeRange>('month');
  const [showTimeDropdown, setShowTimeDropdown] = React.useState(false);
  const [activeEntityRole, setActiveEntityRole] = React.useState<
    'creditor' | 'debtor'
  >('creditor');

  const { entityMetadata, isLoading } = useEntityMetadata(alertId, tenantId);

  const subTabs: Array<{
    key: NetworkSubTab;
    label: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }> = [
      {
        key: 'transaction',
        label: 'Transaction Network',
        icon: ArrowsRightLeftIcon,
      },
      {
        key: 'account',
        label: 'Account Network',
        icon: BuildingOfficeIcon,
      },
      {
        key: 'counterparty',
        label: 'Counterparty Network',
        icon: UsersIcon,
      },
    ];

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
          Select an alert to view navigator details
        </p>
      </div>
    );
  }

  if (isLoading || !entityMetadata) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600"></div>
        <span className="ml-3 text-gray-600">Loading...</span>
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
            Network Navigator
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Visualize relationships and transaction flows across accounts and counterparties
          </p>
        </div>

        {/* Right side (grouped correctly) */}
        <div className="flex items-center gap-3">

          {/* Creditor/Debtor toggle */}
          <div className="flex bg-gray-100 p-1 rounded-md">
            <button
              onClick={() => setActiveEntityRole('creditor')}
              className={`px-4 py-1.5 text-sm rounded-md transition ${activeEntityRole === 'creditor'
                ? 'bg-white shadow text-blue-600 font-medium'
                : 'text-gray-600 hover:text-gray-800'
                }`}
            >
              Creditor
            </button>

            <button
              onClick={() => setActiveEntityRole('debtor')}
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
              onClick={() => setShowTimeDropdown(!showTimeDropdown)}
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


      {/* Sub-tabs Navigation */}
      <div className="flex gap-2">
        {subTabs.map((subTab) => {
          const Icon = subTab.icon;
          const isActive = activeSubTab === subTab.key;
          return (
            <button
              key={subTab.key}
              onClick={() => setActiveSubTab(subTab.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${isActive
                ? 'bg-indigo-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              <Icon className="h-4 w-4" />
              {subTab.label}
            </button>
          );
        })}
      </div>
      {/* Sub-tab Content */}
      <div className="rounded-lg border border-gray-200 bg-white">
        {activeSubTab === 'transaction' && (
          <TransactionNetworkTab
            caseId={caseId}
            transactionId={transactionId}
            timeRange={timeRange}
            entityAccountId={
              activeEntityRole === 'creditor'
                ? entityMetadata?.creditorAccountId
                : entityMetadata?.debtorAccountId
            }
          />
        )}
        {activeSubTab === 'account' && (
          <AccountNetworkTab
            caseId={caseId}
            transactionId={transactionId}
            timeRange={timeRange}
            entityId={activeEntityRole === 'creditor'
              ? entityMetadata?.creditorId
              : entityMetadata?.debtorId
            }
          />
        )}
        {activeSubTab === 'counterparty' && (
          <CounterpartyNetworkTab
            caseId={caseId}
            transactionId={transactionId}
          />
        )}
      </div>
    </div>
  );
};

export default NetworkAnalysisTab;
