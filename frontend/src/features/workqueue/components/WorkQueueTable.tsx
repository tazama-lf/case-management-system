import React, { Suspense, useState } from 'react';
import { ClockIcon } from '@heroicons/react/24/outline';
import { formatDate } from '../../../shared/utils/dateUtils';
import { EmptyState } from '../../../shared/components/ui';
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
    // { key: 'actions', label: 'Actions', width: 'w-40', align: 'right' }
  ];

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
                  <div className="text-sm text-gray-900 font-mono break-all" title={task.caseId || 'No Case ID'}>
                    {task.caseId || '-'}
                  </div>
                </td>
                {/* <td className="px-4 py-3 text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    {getAvailableActions(task)}
                  </div>
                </td> */}
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
  // return (
  //   <div className="bg-white rounded-lg border border-gray-200 overflow-hidden relative">
  //     {/* Table */}
  //     <div className="overflow-x-auto">
  //       <table className="min-w-full divide-y divide-gray-200">
  //         <thead className="bg-gray-50">
  //           <tr>
  //             {tableColumns.map((col) => (
  //               <th
  //                 key={col.key}
  //                 className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
  //                 style={{ width: col.width }}
  //               >
  //                 {col.label}
  //               </th>
  //             ))}
  //           </tr>
  //         </thead>

  //         <tbody className="bg-white divide-y divide-gray-200">
  //           {tasks.length === 0 ? (
  //             <tr>
  //               <td
  //                 colSpan={tableColumns.length}
  //                 className="px-6 py-12 text-center text-gray-500"
  //               >
  //                 No tasks found
  //               </td>
  //             </tr>
  //           ) : (
  //             tasks.map((task, index) => (
  //               <tr
  //                 key={task.id || `task-${index}`}
  //                 className="hover:bg-gray-50 cursor-pointer"
  //               >
  //                 <td className="px-6 py-4 text-sm font-medium text-gray-900 break-words">
  //                   {task.name || 'Unnamed Task'}
  //                 </td>
  //                 <td className="px-6 py-4 text-sm text-gray-700 break-words">
  //                   {task.description || '-'}
  //                 </td>
  //                 <td className="px-6 py-4 text-sm text-gray-900">
  //                   {task.assignee ? (
  //                     <span className="text-blue-600 break-words">
  //                       {task.assigneeName || task.assignee}
  //                     </span>
  //                   ) : (
  //                     <span className="text-gray-400">Unassigned</span>
  //                   )}
  //                 </td>
  //                 <td className="px-6 py-4 text-sm text-gray-500 flex items-center space-x-1">
  //                   <ClockIcon className="h-4 w-4" />
  //                   <span>{formatDate(task.createdAt)}</span>
  //                 </td>
  //                 <td className="px-6 py-4 text-sm text-gray-900 font-mono break-all">
  //                   {task.caseId || '-'}
  //                 </td>
  //               </tr>
  //             ))
  //           )}
  //         </tbody>
  //       </table>
  //     </div>

  //     {/* Pagination */}
  //     {pagination && (
  //       <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
  //         <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
  //           <div>
  //             <p className="text-sm text-gray-700">
  //               Showing{' '}
  //               <span className="font-medium">
  //                 {Math.min(
  //                   (pagination.currentPage - 1) * pagination.pageSize + 1,
  //                   pagination.totalItems
  //                 )}
  //               </span>{' '}
  //               to{' '}
  //               <span className="font-medium">
  //                 {Math.min(pagination.currentPage * pagination.pageSize, pagination.totalItems)}
  //               </span>{' '}
  //               of <span className="font-medium">{pagination.totalItems}</span> tasks
  //             </p>
  //           </div>
  //           <div>
  //             <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
  //               <button
  //                 onClick={() => pagination.onPageChange(Math.max(1, pagination.currentPage - 1))}
  //                 disabled={pagination.currentPage <= 1}
  //                 className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
  //               >
  //                 Previous
  //               </button>
  //               {/* Page numbers */}
  //               {(() => {
  //                 const { currentPage, totalPages } = pagination;
  //                 const pages: (number | 'ellipsis')[] = [];
  //                 const windowSize = 5;
  //                 const half = Math.floor(windowSize / 2);

  //                 const addPage = (p: number) => pages.push(p);
  //                 const addEllipsis = () => pages.push('ellipsis');

  //                 if (totalPages <= windowSize + 2) {
  //                   for (let p = 1; p <= totalPages; p++) addPage(p);
  //                 } else {
  //                   const start = Math.max(2, currentPage - half);
  //                   const end = Math.min(totalPages - 1, currentPage + half);

  //                   addPage(1);
  //                   if (start > 2) addEllipsis();
  //                   for (let p = start; p <= end; p++) addPage(p);
  //                   if (end < totalPages - 1) addEllipsis();
  //                   addPage(totalPages);
  //                 }

  //                 return pages.map((p, idx) =>
  //                   p === 'ellipsis' ? (
  //                     <span
  //                       key={`ellipsis-${idx}`}
  //                       className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-400 select-none"
  //                     >
  //                       …
  //                     </span>
  //                   ) : (
  //                     <button
  //                       key={p}
  //                       onClick={() => pagination.onPageChange(p)}
  //                       className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${currentPage === p
  //                         ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
  //                         : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
  //                         }`}
  //                       aria-current={currentPage === p ? 'page' : undefined}
  //                     >
  //                       {p}
  //                     </button>
  //                   )
  //                 );
  //               })()}
  //               <button
  //                 onClick={() => pagination.onPageChange(Math.min(pagination.totalPages, pagination.currentPage + 1))}
  //                 disabled={pagination.currentPage >= pagination.totalPages}
  //                 className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
  //               >
  //                 Next
  //               </button>
  //             </nav>
  //           </div>
  //         </div>
  //       </div>
  //     )}
  //   </div>
  // );


};

export default WorkQueueTable;