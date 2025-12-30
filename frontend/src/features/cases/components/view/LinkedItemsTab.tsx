import React, { useState, useEffect } from 'react';
import { LinkIcon } from '@heroicons/react/24/outline';
import { caseService } from '../../services/caseService';
import triageService from '@/features/alerts/services/triageservice';
import AlertsDetailModal from '@/features/alerts/components/AlertsDetailModal';

interface LinkedItemsTabProps {
  caseId: number;
}

// interface LinkedCase {
//   id: number;
//   label: string;
//   status: string;
// }

// interface LinkedAlert {
//   id: number;
//   label: string;
//   type: string;
// }

interface LinkedTransaction {
  id: string;
  label: string;
  description: string;
}

const LinkedItemsTab: React.FC<LinkedItemsTabProps> = ({ caseId }) => {
  const [loading, setLoading] = useState(true);
  // const [linkedCases, setLinkedCases] = useState<LinkedCase[]>([]);
  // const [linkedAlerts, setLinkedAlerts] = useState<LinkedAlert[]>([]);
  const [linkedTransactions, setLinkedTransactions] = useState<LinkedTransaction[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  // const handleAlertClick = (alertId: number) => {
  //   setSelectedAlertId(alertId);
  //   setIsAlertModalOpen(true);
  // };

  const handleCloseAlertModal = () => {
    setIsAlertModalOpen(false);
    setSelectedAlertId(null);
  };

  useEffect(() => {
    const fetchLinkedItems = async () => {
      try {
        setLoading(true);

        // Fetch current case details
        const currentCase = await caseService.getCaseDetails(caseId);

        // Fetch all alerts to find related ones
        const alertsResponse = await triageService.getAlerts({ limit: 1000 });
        const allAlerts = alertsResponse.alerts;

        // Find alerts linked to this case
        const caseAlerts = allAlerts.filter(alert => alert.case_id === caseId);

        // Extract transaction IDs from alerts
        const transactionIds = new Set<string>();
        const alertTransactionMap = new Map<string, { label: string; description: string }>();

        caseAlerts.forEach(alert => {
          if (alert.transaction && typeof alert.transaction === 'object') {
            const txn = alert.transaction as Record<string, unknown>;
            const txnId = (txn.TransactionID || txn.transaction_id || txn.id) as string | undefined;
            if (txnId) {
              transactionIds.add(txnId);
              alertTransactionMap.set(txnId, {
                label: alert.message || 'Transaction Alert',
                description: alert.txtp || 'Suspicious activity detected'
              });
            }
          }
        });

        // Map alerts for display
        // const mappedAlerts: LinkedAlert[] = caseAlerts.map(alert => ({
        //   id: alert.alert_id,
        //   label: alert.message || 'Alert',
        //   type: alert.alert_type || 'N/A'
        // }));

        // Map transactions for display
        const mappedTransactions: LinkedTransaction[] = Array.from(transactionIds).map(txnId => ({
          id: txnId,
          label: alertTransactionMap.get(txnId)?.label || 'Transaction',
          description: alertTransactionMap.get(txnId)?.description || 'Related transaction'
        }));

        // Fetch all cases to find related ones
        const casesResponse = await caseService.getAllCases({ limit: 1000 });
        const allCases = casesResponse.cases;

        // Find related cases (cases with shared alert IDs)
        const alertIds = caseAlerts.map(alert => alert.alert_id);
        const relatedCaseIds = new Set<string>();

        // Find cases that reference any of our alerts
        allAlerts.forEach(alert => {
          if (alert.case_id && alert.case_id !== caseId && alertIds.includes(alert.alert_id)) {
            relatedCaseIds.add(alert.case_id.toString());
          }
        });

        // Also find cases with the same parent_id or where parent_id equals caseId
        allCases.forEach(caseItem => {
          if (caseItem.case_id !== caseId) {
            if (caseItem.case_id === currentCase.parent_id ||
              caseItem.case_id === caseId ||
              (currentCase.parent_id && caseItem.case_id === currentCase.parent_id)) {
              relatedCaseIds.add(caseItem.case_id.toString());
            }
          }
        });

        // const mappedCases: LinkedCase[] = allCases
        //   .filter(caseItem => relatedCaseIds.has(caseItem.case_id.toString()))
        //   .map(caseItem => ({
        //     id: caseItem.case_id,
        //     label: caseItem.case_type || 'Investigation',
        //     status: caseItem.status || 'Unknown'
        //   }));

        // setLinkedCases(mappedCases);
        // setLinkedAlerts(mappedAlerts);
        setLinkedTransactions(mappedTransactions);

        setLoading(false);
      } catch (error) {
        console.error('Failed to fetch linked items:', error);
        setLoading(false);
      }
    };

    fetchLinkedItems();
  }, [caseId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="py-4 space-y-8 min-h-[200px]">
      {/* <h2 className="text-lg font-semibold text-gray-900">Related Items</h2> */}

      {/* Related Cases Section */}
      {/* <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Related Cases</h3>
        <div className="space-y-2">
          {linkedCases.length > 0 ? (
            linkedCases.map((item) => (
              <a
                key={item.id}
                href={`#/cases/${item.id}`}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline text-sm"
              >
                <LinkIcon className="h-4 w-4 flex-shrink-0" />
                <span>Case {item.id} - {item.label}</span>
              </a>
            ))
          ) : (
            <p className="text-sm text-gray-500">No related cases found</p>
          )}
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Related Alerts</h3>
        <div className="space-y-2">
          {linkedAlerts.length > 0 ? (
            linkedAlerts.map((item) => (
              <button
                key={item.id}
                onClick={() => handleAlertClick(item.id)}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline text-sm text-left"
              >
                <LinkIcon className="h-4 w-4 flex-shrink-0" />
                <span>{item.id} - {item.label}</span>
              </button>
            ))
          ) : (
            <p className="text-sm text-gray-500">No related alerts found</p>
          )}
        </div>
      </div> */}

      {/* Related Transactions Section */}
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Related Transactions</h3>
        <div className="space-y-2">
          {linkedTransactions.length > 0 ? (
            linkedTransactions.map((item) => (
              <a
                key={item.id}
                href={`#/transactions/${item.id}`}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline text-sm"
              >
                <LinkIcon className="h-4 w-4 flex-shrink-0" />
                <span>{item.id} - {item.label}</span>
              </a>
            ))
          ) : (
            <p className="text-sm text-gray-500">No related transactions found</p>
          )}
        </div>
      </div>

      {/* Alert Detail Modal */}
      <AlertsDetailModal
        alertId={selectedAlertId}
        isOpen={isAlertModalOpen}
        onClose={handleCloseAlertModal}
      />
    </div>
  );
};

export default LinkedItemsTab;
