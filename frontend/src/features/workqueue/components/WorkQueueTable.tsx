import React, { Suspense, useState } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import { formatDate } from '../../../shared/utils/dateUtils';
import { EmptyState } from '../../../shared/components/ui';
import TablePagination from '../../../shared/components/TablePagination';
import type { TablePaginationInfo } from '../../../shared/types/pagination.types';
import type { UnifiedWorkQueueTask } from '../types/flowable.types';
import { useAlertOperations } from '@/features/alerts/hooks/useAlertsQuery';
import { transformBackendAlertToUI, convertToTriageAlert } from '@/features/alerts/utils/alertTransformers';
import triageService from '@/features/alerts/services/triageservice';
import type { Alert } from '@/features/alerts/types/alertsdashboard.types';
import type { ManualTriageDto } from '@/features/alerts/types/triage.types';
import { useToast } from '@/shared/providers/ToastProvider';
import ManualTriageModal from '@/features/alerts/components/ManualTriageModal';

interface WorkQueueTableProps {
  tasks: UnifiedWorkQueueTask[];
  onAssign: (task: UnifiedWorkQueueTask) => void;
  onUnassign?: (task: UnifiedWorkQueueTask) => void;
  onReassign?: (task: UnifiedWorkQueueTask) => void;
  onComplete?: (task: UnifiedWorkQueueTask) => void;
  onUpdateStatus?: (task: UnifiedWorkQueueTask) => void;
  pagination?: TablePaginationInfo;
  onRefreshCases?: () => void;
}

const WorkQueueTable: React.FC<WorkQueueTableProps> = ({
  tasks,
  onAssign: _onAssign,
  onUnassign: _onUnassign,
  onReassign: _onReassign,
  onComplete: _onComplete,
  onUpdateStatus: _onUpdateStatus,
  pagination,
  onRefreshCases
}) => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showManualTriageModal, setShowManualTriageModal] = useState(false);
  const { success, error: showError } = useToast();
  const { performManualTriage } = useAlertOperations();

  const tableColumns = [
    { key: 'taskName', label: 'Task Name', width: 'w-60' },
    { key: 'description', label: 'Description', width: 'w-80' },
    { key: 'assignee', label: 'Assignee', width: 'w-48' },
    { key: 'createdTime', label: 'Created Time', width: 'w-40' },
    { key: 'caseId', label: 'Case ID', width: 'w-48' },
  ];

  const handleManualTriage = async (alert: Alert, triageData: ManualTriageDto) => {
    try {
      await performManualTriage({
        alertId: alert.alert_ids as number,
        data: triageData,
      });
      success('Triage Complete', 'Alert triage completed successfully');

      // Refresh the alert details and keep the modal open
      try {
        const updatedAlert = await triageService.getAlertById(alert.alert_id);
        setSelectedAlert(transformBackendAlertToUI(updatedAlert));
        setShowManualTriageModal(false);
      } catch (error) {
        console.error('Failed to refresh alert:', error);
        onRefreshCases?.();
      }
    } catch (error) {
      console.error('Failed to perform manual triage:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to perform triage. Please try again.';
      showError('Triage Failed', errorMessage);
      throw error;
    }
  };
  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <colgroup>
            {tableColumns.map((col) => (
              <col key={col.key} className={col.width} />
            ))}
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              {tableColumns.map((col) => (
                <th
                  key={col.key}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.map((task, index) => (
              <tr key={task.id || `task-${index}`} className="hover:bg-gray-50">
                <td className="px-4 py-3">
                  <div className="text-sm font-medium text-gray-900 break-words" title={task.name || 'No Name'}>
                    {task.name || 'Unnamed Task'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-700 break-words" title={task.description || 'No Description'}>
                    {task.description || '-'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900">
                    {task.assignee ? (
                      <span className="text-blue-600 break-words">{task.assigneeName || task.assignee}</span>
                    ) : (
                      <span className="text-gray-400">Unassigned</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center text-sm text-gray-500">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    {formatDate(task.createdAt)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900 font-mono break-all" title={task.caseId?.toString() || 'No Case ID'}>
                    {task.caseId || '-'}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tasks.length === 0 && (
        <EmptyState
          title="No tasks found"
          description="No tasks are currently available in this work queue"
          icon="folder"
        />
      )}

      {/* Pagination */}
      {pagination && <TablePagination pagination={pagination} itemLabel="tasks" />}
      {/* Manual Triage Modal */}
      {selectedAlert && (
        <Suspense fallback={<div>Loading modal...</div>}>
          <ManualTriageModal
            isOpen={showManualTriageModal}
            alert={convertToTriageAlert(selectedAlert)}
            onClose={() => {
              setShowManualTriageModal(false);
              setSelectedAlert(null);
            }}
            onSubmit={(triageData: ManualTriageDto) => handleManualTriage(selectedAlert, triageData)}
          />
        </Suspense>
      )}
    </div>
  );
};

export default WorkQueueTable;