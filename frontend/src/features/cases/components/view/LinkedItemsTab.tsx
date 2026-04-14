import React, { useState, useEffect } from 'react';
import { LinkIcon } from '@heroicons/react/24/outline';
import { caseService } from '../../services/caseService';
import triageService from '@/features/alerts/services/triageservice';
import AlertsDetailModal from '@/features/alerts/components/AlertsDetailModal';

interface LinkedItemsTabProps {
  caseId: number;
}
interface LinkedAlert {
  id: number;
  label: string;
  type: string;
}

const LinkedItemsTab: React.FC<LinkedItemsTabProps> = ({ caseId }) => {
  const [loading, setLoading] = useState(true);
  const [linkedAlerts, setLinkedAlerts] = useState<LinkedAlert[]>([]);
  const [selectedAlertId, setSelectedAlertId] = useState<number | null>(null);
  const [isAlertModalOpen, setIsAlertModalOpen] = useState(false);

  const handleAlertClick = (alertId: number) => {
    setSelectedAlertId(alertId);
    setIsAlertModalOpen(true);
  };

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

        if (currentCase.parent_id) {
          // For FRAUD_AND_AML Cases, map parent alert

          if (currentCase.parent_id) {
            const parentCase = await caseService.getCaseDetails(
              currentCase.parent_id,
            );

            if (parentCase?.alert.alert_id) {
              const alert = await triageService.getAlertById(
                parentCase.alert.alert_id,
              );

              const mappedAlerts: LinkedAlert[] = [alert].map((alert) => ({
                id: alert.alert_id,
                label: alert.message || 'Alert',
                type: alert.alert_type || 'N/A',
              }));

              setLinkedAlerts(mappedAlerts);
            }
          }
        } else if (currentCase?.alert.alert_id) {
            const alert = await triageService.getAlertById(
              currentCase.alert.alert_id,
            );

            const mappedAlerts: LinkedAlert[] = [alert].map((alert) => ({
              id: alert.alert_id,
              label: alert.message || 'Alert',
              type: alert.alert_type || 'N/A',
            }));

            setLinkedAlerts(mappedAlerts);
          }

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
    <div className="py-4 space-y-8">
      <h2 className="text-lg font-semibold text-gray-900">Related Items</h2>
      {/* Related Alerts Section */}
      <br></br>
      <div>
        <h3 className="text-sm font-semibold text-gray-700 mb-3">
          Related Alerts
        </h3>
        <div className="space-y-2">
          {linkedAlerts.length > 0 ? (
            linkedAlerts.map((item) => (
              <button
                key={item.id}
                onClick={() => { handleAlertClick(item.id); }}
                className="flex items-center gap-2 text-blue-600 hover:text-blue-800 hover:underline text-sm text-left"
              >
                <LinkIcon className="h-4 w-4 flex-shrink-0" />
                <span>
                  {item.id} - {item.label}
                </span>
              </button>
            ))
          ) : (
            <p className="text-sm text-gray-500">No related alerts found</p>
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
