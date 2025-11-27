import React, { Suspense, useState } from 'react';
import { UserPlusIcon, UserMinusIcon, CheckIcon, ClockIcon, ArrowPathIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { formatDate } from '../../../../shared/utils/dateUtils';
import { EmptyState } from '../../../../shared/components/ui';
import type { UnifiedWorkQueueTask } from '../../../workqueue/types/flowable.types';
import { useAlertOperations } from '@/features/alerts/hooks/useAlertsQuery';
import { transformBackendAlertToUI, convertToTriageAlert } from '@/features/alerts/utils/alertTransformers';
import triageService from '@/features/alerts/services/triageservice';
import type { Alert } from '@/features/alerts/types/alertsdashboard.types';
import type { ManualTriageDto } from '@/features/alerts/types/triage.types';
import { useToast } from '@/shared/providers/ToastProvider';
import ManualTriageModal from '@/features/alerts/components/ManualTriageModal';

interface WorkQueueTableProps {
  alertId?: string;
  tasks: UnifiedWorkQueueTask[];
  onAssign: (task: UnifiedWorkQueueTask) => void;
  onUnassign?: (task: UnifiedWorkQueueTask) => void;
  onReassign?: (task: UnifiedWorkQueueTask) => void;
  onComplete?: (task: UnifiedWorkQueueTask) => void;
  onUpdateStatus?: (task: UnifiedWorkQueueTask) => void;
  pagination?: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  onRefreshCases?: () => void;
}

const WorkQueueTable: React.FC<WorkQueueTableProps> = ({
  alertId,
  tasks,
  onAssign,
  onUnassign,
  onReassign,
  onComplete,
  onUpdateStatus,
  pagination,
  onRefreshCases
}) => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showManualTriageModal, setShowManualTriageModal] = useState(false);
  const [loadingAlertForTask, setLoadingAlertForTask] = useState<string | null>(null);
  const { success, error: showError } = useToast();
  const { performManualTriage } = useAlertOperations();

  const tableColumns = [
    { key: 'task', label: 'Task', width: 'w-80' },
    { key: 'case', label: 'Case', width: 'w-72' },
    { key: 'queue', label: 'Queue', width: 'w-32' },
    { key: 'status', label: 'Status', width: 'w-32' },
    { key: 'created', label: 'Created', width: 'w-40' },
    { key: 'assignedTo', label: 'Assigned To', width: 'w-48' },
    { key: 'actions', label: 'Actions', width: 'w-40', align: 'right' }
  ];
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      UNASSIGNED: { color: 'bg-gray-100 text-gray-800', label: 'Unassigned' },
      ASSIGNED: { color: 'bg-blue-100 text-blue-800', label: 'Assigned' },
      IN_PROGRESS: { color: 'bg-yellow-100 text-yellow-800', label: 'In Progress' },
      COMPLETED: { color: 'bg-green-100 text-green-800', label: 'Completed' },
      SUSPENDED: { color: 'bg-red-100 text-red-800', label: 'Blocked' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.UNASSIGNED;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const handleManualTriage = async (alert: Alert, triageData: ManualTriageDto) => {
    try {
      await performManualTriage({
        alertId: alert.alert_id as string,
        data: triageData,
      });
      success('Triage Complete', 'Alert triage completed successfully');

      // Refresh the alert details and keep the modal open
      try {
        const updatedAlert = await triageService.getAlertById(alert.alert_id as string);
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

  const getAvailableActions = (task: UnifiedWorkQueueTask) => {
    const actions: React.ReactNode[] = [];

    // Don't show action buttons for completed tasks
    if (task.status === 'COMPLETED') {
      return actions;
    }

    if (task.status === 'IN_PROGRESS') {
      // Add Reassign and Unassign actions for IN_PROGRESS tasks
      if (task.assignee && onReassign) {
        actions.push(
          <button
            key="reassign"
            onClick={() => onReassign(task)}
            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
            title="Reassign task"
          >
            <ArrowPathIcon className="h-3 w-3 mr-1" />
            Reassign
          </button>
        );
      }

      if (task.assignee && onUnassign) {
        actions.push(
          <button
            key="unassign"
            onClick={() => onUnassign(task)}
            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
            title="Unassign task"
          >
            <UserMinusIcon className="h-3 w-3 mr-1" />
            Unassign
          </button>
        );
      }

      if (task.assignee && onComplete) {
        actions.push(
          <button
            key="complete"
            onClick={() => onComplete(task)}
            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            title="Mark complete"
          >
            <CheckIcon className="h-3 w-3 mr-1" />
            Complete
          </button>
        );
      }


      return actions;
    }

    if (!task.assignee) {
      actions.push(
        <button
          key="assign"
          onClick={() => onAssign(task)}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          title="Assign task"
        >
          <UserPlusIcon className="h-3 w-3 mr-1" />
          Assign
        </button>
      );
    }

    if (task.assignee && onReassign) {
      actions.push(
        <button
          key="reassign"
          onClick={() => onReassign(task)}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          title="Reassign task"
        >
          <ArrowPathIcon className="h-3 w-3 mr-1" />
          Reassign
        </button>
      );
    }



    if (task.assignee && onUnassign) {
      actions.push(
        <button
          key="unassign"
          onClick={() => onUnassign(task)}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          title="Unassign task"
        >
          <UserMinusIcon className="h-3 w-3 mr-1" />
          Unassign
        </button>
      );
    }

    if (task.assignee && onUpdateStatus) {
      if (task.name === 'Complete New Case') {
        actions.push(
          <button
            key="complete-triage"
            onClick={async () => {
              try {
                // Fetch alert details using the cached or newly fetched alert ID
                const alertDetails = await triageService.getAlertById(alertId || '');
                setSelectedAlert(transformBackendAlertToUI(alertDetails));
                setShowManualTriageModal(true);
              } catch (error) {
                console.error('Failed to load alert for triage:', error);
                const errorMessage = error instanceof Error ? error.message : 'Failed to load alert details';
                showError('Error', errorMessage);
              } finally {
                setLoadingAlertForTask(null);
              }
            }}
            disabled={loadingAlertForTask === task.id}
            className="inline-flex items-center px-1 py-1 text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Complete triage"
          >
            {loadingAlertForTask === task.id ? (
              <>
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-700 mr-1" />
                Loading...
              </>
            ) : (
              <>
                <CheckIcon className="h-3 w-3 mr-1" />
                Complete
              </>
            )}
          </button>
        );
      } else {
        actions.push(
          <button
            key="update-status"
            onClick={() => onUpdateStatus(task)}
            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
            title="Update status"
          >
            <Cog6ToothIcon className="h-3 w-3 mr-1" />
            Status
          </button>
        );
      }
    }

    return actions;
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
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
                  className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
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
                  <div className="flex flex-col">
                    <div className="text-xs font-medium text-gray-900 font-mono break-all" title={task.id || 'No ID'}>
                      {task.id || 'No ID'}
                    </div>
                    {task.name && (
                      <div className="text-xs text-gray-500 break-words mt-1" title={task.name}>
                        {task.name}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-xs text-gray-900 font-mono break-all" title={task.caseId || ''}>
                    {task.caseId || ''}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900 break-words">
                    {task.candidateGroup || '-'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {getStatusBadge(task.status)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center text-sm text-gray-500">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    {formatDate(task.createdAt)}
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
                <td className="px-4 py-3 text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    {getAvailableActions(task)}
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

      {/* Pagination Controls */}
      {pagination && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">
                  {Math.min(
                    (pagination.currentPage - 1) * pagination.pageSize + 1,
                    pagination.totalItems,
                  )}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(
                    pagination.currentPage * pagination.pageSize,
                    pagination.totalItems,
                  )}
                </span>{' '}
                of <span className="font-medium">{pagination.totalItems}</span>{' '}
                tasks
              </p>
            </div>
            <div>
              <nav
                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                aria-label="Pagination"
              >
                <button
                  onClick={() =>
                    pagination.onPageChange(Math.max(1, pagination.currentPage - 1))
                  }
                  disabled={pagination.currentPage <= 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                { }
                {(() => {
                  const { currentPage, totalPages } = pagination;
                  const pages: (number | 'ellipsis')[] = [];
                  const windowSize = 5;
                  const half = Math.floor(windowSize / 2);

                  const addPage = (p: number) => pages.push(p);
                  const addEllipsis = () => pages.push('ellipsis');

                  if (totalPages <= windowSize + 2) {
                    for (let p = 1; p <= totalPages; p++) addPage(p);
                  } else {
                    const start = Math.max(2, currentPage - half);
                    const end = Math.min(totalPages - 1, currentPage + half);

                    addPage(1);
                    if (start > 2) addEllipsis();
                    for (let p = start; p <= end; p++) addPage(p);
                    if (end < totalPages - 1) addEllipsis();
                    addPage(totalPages);
                  }

                  return pages.map((p, idx) =>
                    p === 'ellipsis' ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-400 select-none"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => pagination.onPageChange(p)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${pagination.currentPage === p
                          ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                          : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                          }`}
                        aria-current={pagination.currentPage === p ? 'page' : undefined}
                      >
                        {p}
                      </button>
                    ),
                  );
                })()}
                <button
                  onClick={() =>
                    pagination.onPageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))
                  }
                  disabled={pagination.currentPage >= pagination.totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
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