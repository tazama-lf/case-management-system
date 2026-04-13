import React from 'react';
import {
  ClockIcon,
  DocumentTextIcon,
  ChartBarIcon,
  ShareIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';

import AlertNavigatorTab from './visualizations/alertnavigator/AlertNavigatorTab';
import TransactionDetailsTab from './visualizations/transactiondetails/TransactionDetailsTab';
import TransactionHistoryTab from './visualizations/transactionhistory/TransactionHistoryTab';
import NetworkAnalysisTab from './visualizations/network-analysis/NetworkAnalysisTab';
import AlertHistoryTab from './visualizations/alerthistory/AlertHistoryTab';
import ConditionsTab from './visualizations/conditions/ConditionsTab';
import ProfileOverviewTab from './visualizations/profileoverview/ProfileOverviewTab';

type VisualizationSubTab =
  | 'alert-navigator'
  | 'transaction-details'
  | 'transaction-history'
  | 'network-analysis'
  | 'alert-history'
  | 'conditions'
  | 'profile-overview';

interface VisualizationsTabProps {
  alertId?: number;
  caseId?: number;
  transactionId?: string;
}

const VisualizationsTab: React.FC<VisualizationsTabProps> = ({
  alertId,
  caseId,
  transactionId,
}) => {
  const [activeSubTab, setActiveSubTab] =
    React.useState<VisualizationSubTab>('alert-navigator');
  const [tenantId, setTenantId] = React.useState<string>('');

  React.useEffect(() => {
    const user = localStorage.getItem('user');
    if (user) {
      try {
        const userData = JSON.parse(user);
        setTenantId(userData.tenantId || '');
      } catch {
        setTenantId('');
      }
    }
  }, []);

  const subTabs = [
    {
      key: 'alert-navigator',
      label: 'Alert Navigator',
      icon: ExclamationTriangleIcon,
    },
    {
      key: 'transaction-details',
      label: 'Transaction Details',
      icon: DocumentTextIcon,
    },
    {
      key: 'transaction-history',
      label: 'Transaction History',
      icon: ClockIcon,
    },
    {
      key: 'network-analysis',
      label: 'Network Analysis',
      icon: ShareIcon,
    },
    {
      key: 'alert-history',
      label: 'Alert History',
      icon: ChartBarIcon,
    },
    {
      key: 'conditions',
      label: 'Conditions',
      icon: ChartBarIcon,
    },
    {
      key: 'profile-overview',
      label: 'Profile Overview',
      icon: DocumentTextIcon,
    },
  ];

  return (
    <div className="space-y-4">
      {/* 🔹 Sub-tabs container */}
      <div className="p-2 rounded-xl flex flex-wrap gap-3 justify-center">
        {subTabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.key;

          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key as VisualizationSubTab)}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-all
                ${isActive
                  ? 'bg-white shadow text-indigo-600'
                  : 'text-gray-600 hover:bg-gray-200'
                }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="mt-4">
        {activeSubTab === 'alert-navigator' && (
          <AlertNavigatorTab
            alertId={alertId}
            caseId={caseId}
            transactionId={transactionId}
          />
        )}

        {activeSubTab === 'transaction-details' && (
          <TransactionDetailsTab
            caseId={caseId}
            transactionId={transactionId}
          />
        )}

        {activeSubTab === 'transaction-history' && (
          (alertId && tenantId) ? (
            <TransactionHistoryTab

              alertId={alertId}
              caseId={caseId}
              transactionId={transactionId}
              tenantId={tenantId}
            />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                Select an alert to view network analysis
              </p>
            </div>
          ))}

        {activeSubTab === 'network-analysis' &&
          (alertId && tenantId ? (
            <NetworkAnalysisTab
              caseId={caseId}
              transactionId={transactionId}
              alertId={alertId}
              tenantId={tenantId}
            />
          ) : (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
              <p className="text-sm text-gray-600">
                Select an alert to view network analysis
              </p>
            </div>
          ))}

        {activeSubTab === 'alert-history' && (
          <AlertHistoryTab caseId={caseId} transactionId={transactionId} />
        )}

        {activeSubTab === 'conditions' && (
          <ConditionsTab
            caseId={caseId}
            transactionId={transactionId}
            tenantId={tenantId}
          />
        )}

        {activeSubTab === 'profile-overview' && (
          <ProfileOverviewTab alertId={alertId} transactionId={transactionId} />
        )}
      </div>
    </div>
  );
};

export default VisualizationsTab;
