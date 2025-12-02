import React, { Suspense, useEffect, useState } from 'react';
import { UserPlusIcon, UserMinusIcon, CheckIcon, ClockIcon, ArrowPathIcon, Cog6ToothIcon, XCircleIcon } from '@heroicons/react/24/outline';
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
import authService from '@/features/auth/services/authService';
import type { User } from '@/shared/interfaces/user.interface';
import { useInvestigatorSupervisorList } from '@/features/cases/hooks/useInvestigatorSupervisorList';

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
  canManageSupervisorActions?: boolean;
  caseData?: any;
  onApproveCase?: (caseData: any) => void;
  onApproveCaseCreation?: (caseData: any) => void;
  onRejectCaseCreation?: (caseData: any) => void;
  onAbandonCase?: (caseData: any) => void;
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
  onRefreshCases,
  canManageSupervisorActions = false,
  caseData,
  onApproveCase,
  onApproveCaseCreation,
  onRejectCaseCreation,
}) => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showManualTriageModal, setShowManualTriageModal] = useState(false);
  const [loadingAlertForTask, setLoadingAlertForTask] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<User>(); // Replace with actual user fetching logic
  const { success, error: showError } = useToast();
  const { performManualTriage } = useAlertOperations();

  useEffect(() => {
    const user = authService.getUser();
    if (user) setCurrentUser(user);
  }, []);

  const tableColumns = [
    { key: 'task', label: 'Task', width: 'w-80' },
    { key: 'case', label: 'Case', width: 'w-72' },
    { key: 'queue', label: 'Queue', width: 'w-32' },
    { key: 'status', label: 'Status', width: 'w-32' },
    { key: 'created', label: 'Created', width: 'w-40' },
    { key: 'assignedTo', label: 'Assigned To', width: 'w-48' },
    { key: 'actions', label: 'Actions', width: 'w-40', align: 'left' }
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

  /**
   * TASK ACTION BUTTON UTILITIES
   * 
   * These functions handle the creation and management of task action buttons
   * in the work queue table. Each task can have different actions based on:
   * - Task status (UNASSIGNED, ASSIGNED, IN_PROGRESS, COMPLETED)
   * - User permissions (supervisor vs regular user)
   * - Task type (investigation, approval, triage)
   * - Current assignment state
   */
  /**
     * Creates a standardized action button with consistent styling
     * 
     * @param key - Unique identifier for React key prop
     * @param onClick - Click handler function
     * @param icon - React icon component (from Heroicons)
     * @param label - Button text label
     * @param title - Tooltip text on hover
     * @param colorClasses - Tailwind CSS color classes for styling
     * @param disabled - Whether button should be disabled
     * @returns JSX button element with consistent styling
     */
  const createActionButton = (
    key: string,
    onClick: () => void,
    icon: React.ReactNode,
    // label: string,
    title: string,
    colorClasses: string,
    disabled = false
  ) => (
    <button
      key={key}
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md ${colorClasses} focus:outline-none focus:ring-2 focus:ring-offset-2 ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      title={title}
    >
      {icon}
      {/* {label} */}
    </button>
  );


  /**
      * PERMISSION CHECK UTILITIES
      * 
      * These functions determine what actions are available for a given task
      * based on current state, user permissions, and business rules
      */

  /** Check if the current logged-in user is assigned to this task */
  const isCurrentUserAssigned = (task: UnifiedWorkQueueTask) => task.assignee === currentUser?.userId;
  /** Check if a task can be assigned (unassigned + not special approval tasks) */
  const canAssignTask = (task: UnifiedWorkQueueTask) =>
    !task.assignee &&
    task.name !== 'Approve Case Closure' &&
    task.name !== 'Approve Case Creation';
  /** Check if a task can be reassigned (has assignee + callback exists) */
  const canReassignTask = (task: UnifiedWorkQueueTask) => task.assignee && onReassign;

  /** Check if a task can be unassigned (has assignee + callback exists) */
  const canUnassignTask = (task: UnifiedWorkQueueTask) => task.assignee && onUnassign;

  /** Check if a task can be completed (assigned + callback exists + not approval tasks) */
  const canCompleteTask = (task: UnifiedWorkQueueTask) =>
    task.assignee &&
    onComplete &&
    !['Approve Case Creation', 'Approve Case Closure'].includes(task.name || '');

  /**
       * ACTION BUTTON BUILDERS
       * 
       * These functions add specific action buttons to the actions array
       * Each function handles one type of action with its own business logic
       */

  /**
   * Adds an "Assign" button for unassigned tasks
   * Only shows for tasks that are unassigned and not special approval tasks
   */
  const addAssignAction = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    if (canAssignTask(task)) {
      actions.push(
        createActionButton(
          'assign',
          () => onAssign(task),
          <UserPlusIcon className="h-4 w-4 mr-1" />,
          // 'Assign',
          'Assign task',
          'text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-blue-500'
        )
      );
    }
  };

  /**
   * Adds a "Reassign" button for assigned tasks
   * Allows supervisors to reassign tasks to different users
   */
  const addReassignAction = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    if (canReassignTask(task)) {
      actions.push(
        createActionButton(
          'reassign',
          () => onReassign!(task),
          <ArrowPathIcon className="h-4 w-4 mr-1" />,
          // 'Reassign',
          'Reassign task',
          'text-purple-700 bg-purple-100 hover:bg-purple-200 focus:ring-purple-500'
        )
      );
    }
  };

  /**
   * Adds an "Unassign" button for assigned tasks
   * Returns the task to unassigned state, making it available in work queue
   */
  const addUnassignAction = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    if (canUnassignTask(task)) {
      actions.push(
        createActionButton(
          'unassign',
          () => onUnassign!(task),
          <UserMinusIcon className="h-4 w-4 mr-1" />,
          // 'Unassign',
          'Unassign task',
          'text-orange-700 bg-orange-100 hover:bg-orange-200 focus:ring-orange-500'
        )
      );
    }
  };

  /**
   * Adds a "Complete" button for regular tasks
   * Excludes special approval tasks that have their own completion flow
   */
  const addCompleteAction = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    if (canCompleteTask(task)) {
      actions.push(
        createActionButton(
          'complete',
          () => onComplete!(task),
          <CheckIcon className="h-4 w-4 mr-1" />,
          // 'Complete',
          'Mark complete',
          'text-green-700 bg-green-100 hover:bg-green-200 focus:ring-green-500'
        )
      );
    }
  };

  /**
   * Adds approval/rejection buttons for supervisor-level tasks
   * Handles both case creation and case closure approval workflows
   * 
   * Business Rules:
   * - Only supervisors can see these actions (canManageSupervisorActions)
   * - Requires valid case data to perform actions
   * - Case Creation: Shows Approve + optional Reject buttons
   * - Case Closure: Shows Review button for final approval
   */
  const addApprovalActions = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    // Handle "Approve Case Creation" tasks - supervisor approval for new cases
    if (task.name === 'Approve Case Creation' && canManageSupervisorActions && onApproveCaseCreation && caseData) {
      actions.push(
        createActionButton(
          'approve-creation',
          () => onApproveCaseCreation(caseData),
          <CheckIcon className="h-4 w-4 mr-1" />,
          // 'Approve',
          'Approve Case Creation',
          'text-green-700 bg-green-100 hover:bg-green-200 focus:ring-green-500'
        )
      );

      // Optional reject button if callback is provided
      if (onRejectCaseCreation) {
        actions.push(
          createActionButton(
            'reject-creation',
            () => onRejectCaseCreation(caseData),
            <XCircleIcon className="h-4 w-4 mr-1" />,
            // 'Reject',
            'Reject Case Creation',
            'text-red-700 bg-red-100 hover:bg-red-200 focus:ring-red-500'
          )
        );
      }
    }

    // Handle "Approve Case Closure" tasks - supervisor review before case closure
    if (task.name === 'Approve Case Closure' && canManageSupervisorActions && onApproveCase && caseData) {
      actions.push(
        createActionButton(
          'approve-closure',
          () => onApproveCase(caseData),
          <CheckIcon className="h-4 w-4 mr-1" />,
          // 'Review',
          'Review Case Closure',
          'text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:ring-indigo-500'
        )
      );
    }
  };

  /**
   * Adds a special "Complete" button for triage tasks
   * 
   * This handles the "Complete New Case" task type which requires:
   * 1. Loading alert details from the triage service
   * 2. Opening a manual triage modal for detailed analysis
   * 3. Handling loading states and error conditions
   * 
   * Note: This is different from regular task completion as it requires
   * additional user input through the triage modal interface.
   */
  const addTriageAction = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    if (task.name === 'Complete New Case' && task.assignee && onUpdateStatus) {
      const isLoading = loadingAlertForTask === task.id;
      actions.push(
        <button
          key="complete-triage"
          onClick={async () => {
            try {
              // Fetch alert details for triage analysis
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
          disabled={isLoading}
          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Complete triage"
        >
          {/* Show loading spinner or normal icon based on state */}
          {isLoading ? (
            <>
              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-blue-700 mr-1" />
              Loading...
            </>
          ) : (
            <>
              <CheckIcon className="h-4 w-4 mr-1" />
              {/* Complete */}
            </>
          )}
        </button>);
    }
  };

  /**
   * Adds a "Status" button for task status updates
   * 
   * This allows users to update task status (e.g., from ASSIGNED to IN_PROGRESS)
   * 
   * Restrictions:
   * - Only the assigned user can update their own task status
   * - Excludes "Complete New Case" tasks (handled by triage action)
   * - Requires onUpdateStatus callback to be provided
   */
  const addStatusAction = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    if (task.assignee && onUpdateStatus && task.name !== 'Complete New Case' && isCurrentUserAssigned(task)) {
      actions.push(
        createActionButton(
          'update-status',
          () => onUpdateStatus(task),
          <Cog6ToothIcon className="h-4 w-4 mr-1" />,
          // 'Status',
          'Update status',
          'text-gray-700 bg-gray-100 hover:bg-gray-200 focus:ring-gray-500'
        )
      );
    }
  };

  /**
   * MAIN ACTION ORCHESTRATOR
   * 
   * Determines which action buttons to show for a given task based on:
   * - Task status (COMPLETED, IN_PROGRESS, ASSIGNED, UNASSIGNED)
   * - User permissions (current user vs assignee, supervisor privileges)
   * - Task type and business rules
   * 
   * Flow:
   * 1. Return empty for COMPLETED tasks (no actions allowed)
   * 2. For IN_PROGRESS tasks: Show management actions (reassign, unassign, complete, approve)
   * 3. For other statuses: Show assignment and workflow actions
   * 
   * @param task - The task object containing status, assignee, and metadata
   * @returns Array of React button elements for available actions
   */
  const getAvailableActions = (task: UnifiedWorkQueueTask) => {
    const actions: React.ReactNode[] = [];

    // COMPLETED tasks have no available actions
    if (task.status === 'COMPLETED') {
      return actions;
    }

    // IN_PROGRESS tasks show workflow management actions
    if (task.status === 'IN_PROGRESS') {
      addReassignAction(actions, task);  // Allow reassignment to different user
      addUnassignAction(actions, task);  // Allow returning to unassigned state
      addCompleteAction(actions, task);  // Allow marking as complete
      addApprovalActions(actions, task); // Show approval buttons for supervisor tasks
      return actions;
    }

    // Handle ASSIGNED, UNASSIGNED, and other statuses
    addAssignAction(actions, task);        // Show assign button for unassigned tasks
    addReassignAction(actions, task);     // Allow reassigning already assigned tasks
    addUnassignAction(actions, task);     // Allow unassigning tasks
    addApprovalActions(actions, task);    // Show approval workflow buttons
    addTriageAction(actions, task);       // Show triage completion for investigation tasks
    addStatusAction(actions, task);       // Show status update for assigned user

    return actions;
  };

  const { investigators, supervisors, fetchInvestigatorsList, fetchSupervisorsList } = useInvestigatorSupervisorList();

  React.useEffect(() => {
    if (investigators.length === 0)
      fetchInvestigatorsList();
    if (supervisors.length === 0)
      fetchSupervisorsList();
  }, []);


  const getAssigneeFullName = (assigneeName: string, assignee?: string) => {

    const inv = investigators.find(i => i.id === assigneeName || i.id === assignee);
    if (inv) return `${inv.firstName} ${inv.lastName}`;

    const sup = supervisors.find(i => i.id === assigneeName || i.id === assignee);
    if (sup) return `${sup.firstName} ${sup.lastName}`;

    return assigneeName || assignee;
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
                    {/* <ClockIcon className="h-4 w-4 mr-1" /> */}
                    {formatDate(task.createdAt)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900">
                    {task.assignee ? (
                      <span className="text-blue-600 break-words">
                        {/* {task.assigneeName || task.assignee} */}
                        {getAssigneeFullName(task.assignee, task.assigneeName)}
                      </span>
                    ) : (
                      <span className="text-gray-400">Unassigned</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm font-medium">
                  <div className="flex justify-start space-x-2 items-center">
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
    </div>)
};

export default WorkQueueTable;