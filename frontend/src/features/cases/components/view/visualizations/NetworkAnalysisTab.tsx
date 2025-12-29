import React from 'react';
import TransactionNetworkTab from './network-analysis/TransactionNetworkTab';
import AccountNetworkTab from './network-analysis/AccountNetworkTab';
import CounterpartyNetworkTab from './network-analysis/CounterpartyNetworkTab';
import {
  ArrowsRightLeftIcon,
  BuildingOfficeIcon,
  UsersIcon,
  AdjustmentsHorizontalIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';

type NetworkSubTab = 'transaction' | 'account' | 'counterparty';
type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';

interface NetworkAnalysisTabProps {
  caseId?: string;
  transactionId?: string;
}

const NetworkAnalysisTab: React.FC<NetworkAnalysisTabProps> = ({
  caseId,
  transactionId,
}) => {
  const [activeSubTab, setActiveSubTab] =
    React.useState<NetworkSubTab>('transaction');
  const [timeRange, setTimeRange] = React.useState<TimeRange>('30d');
  const [showTimeDropdown, setShowTimeDropdown] = React.useState(false);

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
    { value: '7d', label: 'Last 7 Days' },
    { value: '30d', label: 'Last 30 Days' },
    { value: '90d', label: 'Last 90 Days' },
    { value: '1y', label: 'Last Year' },
    { value: 'all', label: 'All Time' },
  ];

  const selectedTimeLabel =
    timeRangeOptions.find((opt) => opt.value === timeRange)?.label ||
    'Last 30 Days';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            Network Navigator
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Visualize relationships and transaction flows across accounts and
            counterparties
          </p>
        </div>
        {/* Time Range Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowTimeDropdown(!showTimeDropdown)}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {selectedTimeLabel}
            <ChevronDownIcon className="h-4 w-4 text-gray-500" />
          </button>
          {showTimeDropdown && (
            // <div className="absolute right-0 mt-2 w-40 bg-white rounded-md shadow-lg border border-gray-200 z-10">
            <div className="absolute right-0 z-10 mt-1 w-40 rounded-lg border border-gray-200 bg-white py-1 shadow-lg">
              {timeRangeOptions.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setTimeRange(option.value);
                    setShowTimeDropdown(false);
                  }}
                  className={`block w-full px-4 py-2 text-left text-sm ${
                    timeRange === option.value
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

      {/* Sub-tabs Navigation */}
      <div className="flex gap-2">
        {subTabs.map((subTab) => {
          const Icon = subTab.icon;
          const isActive = activeSubTab === subTab.key;
          return (
            <button
              key={subTab.key}
              onClick={() => setActiveSubTab(subTab.key)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                isActive
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
          />
        )}
        {activeSubTab === 'account' && (
          <AccountNetworkTab caseId={caseId} transactionId={transactionId} />
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
