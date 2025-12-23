import React from 'react';
import AlertNavigatorTab from './visualizations/AlertNavigatorTab';
import TransactionDetailsTab from './visualizations/TransactionDetailsTab';
import TransactionHistoryTab from './visualizations/TransactionHistoryTab';
import NetworkAnalysisTab from './visualizations/NetworkAnalysisTab';
import AlertHistoryTab from './visualizations/AlertHistoryTab';
import ConditionsTab from './visualizations/ConditionsTab';

type VisualizationSubTab = 
  | 'alert-navigator'
  | 'transaction-details'
  | 'transaction-history'
  | 'network-analysis'
  | 'alert-history'
  | 'conditions';

interface VisualizationsTabProps {
  caseId?: string;
  transactionId?: string;
}

const VisualizationsTab: React.FC<VisualizationsTabProps> = ({
  caseId,
  transactionId,
}) => {
  const [activeSubTab, setActiveSubTab] = React.useState<VisualizationSubTab>('alert-navigator');

  const subTabs: Array<{ key: VisualizationSubTab; label: string }> = [
    { key: 'alert-navigator', label: 'Alert Navigator' },
    { key: 'transaction-details', label: 'Transaction Details' },
    { key: 'transaction-history', label: 'Transaction History' },
    { key: 'network-analysis', label: 'Network Analysis' },
    { key: 'alert-history', label: 'Alert History' },
    { key: 'conditions', label: 'Conditions' },
  ];

  return (
    <div className="space-y-4">
      {/* Sub-tabs */}
      <div className="border-b border-gray-200">
        <div className="flex flex-wrap gap-2">
          {subTabs.map((subTab) => (
            <button
              key={subTab.key}
              onClick={() => setActiveSubTab(subTab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSubTab === subTab.key
                  ? 'border-indigo-600 text-indigo-700'
                  : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-gray-300'
              }`}
            >
              {subTab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sub-tab content */}
      <div className="mt-4">
        {activeSubTab === 'alert-navigator' && (
          <AlertNavigatorTab caseId={caseId} transactionId={transactionId} />
        )}
        {activeSubTab === 'transaction-details' && (
          <TransactionDetailsTab caseId={caseId} transactionId={transactionId} />
        )}
        {activeSubTab === 'transaction-history' && (
          <TransactionHistoryTab caseId={caseId} transactionId={transactionId} />
        )}
        {activeSubTab === 'network-analysis' && (
          <NetworkAnalysisTab caseId={caseId} transactionId={transactionId} />
        )}
        {activeSubTab === 'alert-history' && (
          <AlertHistoryTab caseId={caseId} transactionId={transactionId} />
        )}
        {activeSubTab === 'conditions' && (
          <ConditionsTab caseId={caseId} transactionId={transactionId} />
        )}
      </div>
    </div>
  );
};

export default VisualizationsTab;
