import React, { Suspense, useEffect, useState } from 'react';
import { UserPlusIcon, UserMinusIcon, CheckIcon, ArrowPathIcon, Cog6ToothIcon, XCircleIcon, DocumentTextIcon } from '@heroicons/react/24/outline';
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
import { EyeIcon } from '@heroicons/react/24/solid';
import { useAuth } from '@/features/auth';

interface CaseDetailTaskLogTableProps {
  alertId?: number;
  tasks: UnifiedWorkQueueTask[];
  onAssign: (task: UnifiedWorkQueueTask) => void;
  onUnassign?: (task: UnifiedWorkQueueTask) => void;
  onReassign?: (task: UnifiedWorkQueueTask) => void;
  onComplete?: (task: UnifiedWorkQueueTask) => void;
  onUpdateStatus?: (task: UnifiedWorkQueueTask) => void;
  onRefreshCases?: () => void;
  canManageSupervisorActions?: boolean;
  caseData?: any;
  onApproveCase?: (caseData: any) => void;
  onApproveCaseCreation?: (caseData: any) => void;
  onRejectCaseCreation?: (caseData: any) => void;
  onAbandonCase?: (caseData: any) => void;
  onCaseIdClick?: (caseId: string) => void;
  pagination?: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  onTaskClick?: (task: UnifiedWorkQueueTask) => void;
}


const CaseDetailTaskLogTable: React.FC<CaseDetailTaskLogTableProps> = ({
  alertId,
  tasks,
  onAssign,
  onUnassign,
  onReassign,
  onUpdateStatus,
  onRefreshCases,
  canManageSupervisorActions = false,
  caseData,
  onApproveCase,
  onApproveCaseCreation,
  onRejectCaseCreation,
  onTaskClick,

}) => {
  const [selectedAlert, setSelectedAlert] = useState<Alert | null>(null);
  const [showManualTriageModal, setShowManualTriageModal] = useState(false);
  const [loadingAlertForTask, setLoadingAlertForTask] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<User>(); // Replace with actual user fetching logic
  const { success, error: showError } = useToast();
  const { performManualTriage } = useAlertOperations();
  const { hasComplianceOfficerRole, hasSupervisorRole, hasInvestigatorRole } = useAuth();
  // const [isComplianceOfficer, setIsComplianceOfficer] = useState(false);

  useEffect(() => {
    const user = authService.getUser();
    if (user) setCurrentUser(user);
  }, []);

  const filteredTasks = tasks.filter(task => {
    if (hasSupervisorRole() || hasComplianceOfficerRole()) {
      return true;
    } else if (hasInvestigatorRole() &&
      task.candidateGroup?.toLowerCase() === 'compliance') {
      return false;
    }

    return true;
  });


  const tableColumns = [
    { key: 'taskId', label: 'Task ID', width: 'w-72', align: 'left' },
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
        alertId: alert.alert_id,
        data: triageData,
      });

      // Close modal immediately
      setShowManualTriageModal(false);
      setSelectedAlert(null);
      setLoadingAlertForTask(null);

      success('Manual Triage Completed', 'The alert has been triaged successfully.');

      // Brief delay to ensure backend has processed the triage and created new tasks
      await new Promise(resolve => setTimeout(resolve, 500));

      // Refresh tasks to show updated "Complete New Case" status and new "Investigate" task
      if (onRefreshCases) {
        await onRefreshCases();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to perform triage. Please try again.';
      showError('Triage Failed', errorMessage);
      throw error;
    }
  };

  const createActionButton = (
    key: string,
    onClick: () => void,
    icon: React.ReactNode,
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
    </button>
  );

  /** Check if the current logged-in user is assigned to this task */
  const isCurrentUserAssigned = (task: UnifiedWorkQueueTask) => task.assignee === currentUser?.userId;
  /** Check if a task can be assigned (unassigned + not special approval tasks) */
  const canAssignTask = (task: UnifiedWorkQueueTask) =>
    !task.assignee &&
    task.name !== 'Approve Case Closure' &&
    task.name !== 'Approve Case Creation' && task.name !== 'Approve Case Reopening';
  /** Check if a task can be reassigned (has assignee + callback exists) */
  const canReassignTask = (task: UnifiedWorkQueueTask) => task.assignee && onReassign;

  /** Check if a task can be unassigned (has assignee + callback exists) */
  const canUnassignTask = (task: UnifiedWorkQueueTask) => task.assignee && onUnassign;

  const addAssignAction = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    if (canAssignTask(task)) {
      actions.push(
        createActionButton(
          'assign',
          () => onAssign(task),
          <UserPlusIcon className="h-4 w-4 mr-1" />,
          'Assign task',
          'text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-blue-500'
        )
      );
    }
  };



  const addReassignAction = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    if (canReassignTask(task)) {
      actions.push(
        createActionButton(
          'reassign',
          () => onReassign!(task),
          <ArrowPathIcon className="h-4 w-4 mr-1" />,
          'Reassign task',
          'text-purple-700 bg-purple-100 hover:bg-purple-200 focus:ring-purple-500'
        )
      );
    }
  };

  const addUnassignAction = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    if (canUnassignTask(task)) {
      actions.push(
        createActionButton(
          'unassign',
          () => onUnassign!(task),
          <UserMinusIcon className="h-4 w-4 mr-1" />,
          'Unassign task',
          'text-orange-700 bg-orange-100 hover:bg-orange-200 focus:ring-orange-500'
        )
      );
    }
  };

  const addViewAction = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    if (onTaskClick) {
      const isInvestigationTask = task.name && (task.name.toLowerCase().includes('investigate') || task.name.toLowerCase().includes('sar'));
      const isClickable = isInvestigationTask;
      actions.push(
        createActionButton(
          'view',
          () => isClickable && onTaskClick(task),
          <EyeIcon className="h-4 w-4 mr-1" />,
          'View task',
          'text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-blue-500'
        )
      );
    }
  };

  const addApprovalActions = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    // Handle "Approve Case Creation" tasks - supervisor approval for new cases
    if (task.name === 'Approve Case Creation' && canManageSupervisorActions && onApproveCaseCreation && caseData) {
      actions.push(
        createActionButton(
          'approve-creation',
          () => onApproveCaseCreation(caseData),
          <CheckIcon className="h-4 w-4 mr-1" />,
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

  const addTriageAction = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    if (task.name === 'Complete New Case' && task.assignee && onUpdateStatus) {
      const isLoading = loadingAlertForTask === task.id;
      actions.push(
        <button
          key="complete-triage"
          onClick={async () => {
            try {
              if (alertId == null || alertId == undefined) {
                console.error('alert Id is undefined');
                showError('Error', 'AlertId is undefined');
                return;
              }
              // Fetch alert details for triage analysis
              const alertDetails = await triageService.getAlertById(alertId);
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

  const addStatusAction = (actions: React.ReactNode[], task: UnifiedWorkQueueTask) => {
    if (task.assignee && onUpdateStatus && task.name !== 'Complete New Case' && isCurrentUserAssigned(task) && task.status.toUpperCase() !== 'SUSPENDED') {
      actions.push(
        createActionButton(
          'update-status',
          () => onUpdateStatus(task),
          <Cog6ToothIcon className="h-4 w-4 mr-1" />,
          'Update status',
          'text-gray-700 bg-gray-100 hover:bg-gray-200 focus:ring-gray-500'
        )
      );
    }
  };

  const getAvailableActions = (task: UnifiedWorkQueueTask) => {
    const actions: React.ReactNode[] = [];

    // COMPLETED tasks have no available actions
    if (task.status === 'COMPLETED') {
      if (task.name.toLowerCase().includes('sar')) {
        addViewAction(actions, task);
      } else if (task.status === 'COMPLETED' && task.name.toLowerCase().includes('investigat')) {

        addViewAction(actions, task);
      }
      return actions;
    }

    if (task.status === 'SUSPENDED' && (caseData.status === 'STATUS_21_SUSPENDED' || caseData.status.includes('SUSPENDED'))) {
      addViewAction(actions, task);
      return actions;
    }

    if (task.name === 'SAR/STR Filing' && !hasComplianceOfficerRole()) {
      if (task.status === 'UNASSIGNED') {
        return actions;
      } else {
        addViewAction(actions, task);

        return actions;
      }

    }

    if (task.status === 'IN_PROGRESS') {
      addReassignAction(actions, task);
      addUnassignAction(actions, task);
      addViewAction(actions, task);
      addApprovalActions(actions, task);
      return actions;
    }






    addAssignAction(actions, task);
    addReassignAction(actions, task);
    addUnassignAction(actions, task);
    addApprovalActions(actions, task);
    addTriageAction(actions, task);
    addStatusAction(actions, task);

    return actions;
  };
  const { investigators, supervisors, fetchInvestigatorsList, fetchSupervisorsList, complianceOfficers, fetchComplianceOfficersList } = useInvestigatorSupervisorList();



  useEffect(() => {
    if (investigators.length === 0)
      fetchInvestigatorsList();
    if (supervisors.length === 0)
      fetchSupervisorsList();
    if (complianceOfficers.length === 0)
      fetchComplianceOfficersList();


  }, []);


  const getAssigneeFullName = (assigneeName: string, assignee?: string) => {

    // const compliance = (currentUser?.userId === assigneeName || currentUser?.userId === assignee);
    // if (compliance) return `${currentUser?.fullName}`;

    const compliance = complianceOfficers.find(i => i.id === assigneeName || i.id === assignee);
    if (compliance) return `${compliance.firstName} ${compliance.lastName}`;

    const inv = investigators.find(i => i.id === assigneeName || i.id === assignee);
    if (inv) return `${inv.firstName} ${inv.lastName}`;

    const sup = supervisors.find(i => i.id === assigneeName || i.id === assignee);
    if (sup) return `${sup.firstName} ${sup.lastName}`;

    return assigneeName || assignee;
  };

  const getCandidateGroup = (candidateGroup?: string, taskName?: string) => {
    const containsInvestigate = taskName?.toLowerCase().includes("investigate") ?? false;
    if (containsInvestigate) return "Investigators";
    if (!candidateGroup) return "-";
    return candidateGroup.charAt(0).toUpperCase() + candidateGroup.slice(1);
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
            {filteredTasks.map((task, index) => {
              return (
                <tr key={task.id || `task-${index}`}
                  className={`hover:bg-gray-50`}
                >
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-900 font-mono break-all" title={task.taskId?.toString() || ''}>
                      TASK-{task.taskId || ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      {task.name && (
                        <div
                          className={`text-xs break-words mt-1 text-gray-900`}
                          title={task.name || 'View task details'}>
                          {task.name || 'Unnamed Task'}

                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-xs text-gray-900 font-mono break-all" title={task.caseId?.toString() || ''}>
                      CASE-{task.caseId || ''}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900 break-words">
                      {getCandidateGroup(task.candidateGroup, task.name)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    {getStatusBadge(task.status)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center text-sm text-gray-500">
                      {formatDate(task.createdAt)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-900">
                      {task.assignee ? (
                        <span className="text-blue-600 break-words">
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
                      {/* {task.name === 'SAR/STR Filing' && latestReports?.['INVESTIGATION_REPORT'] && onViewReport && (
                        <button
                          onClick={() => {
                            const report = latestReports['INVESTIGATION_REPORT'];
                            if (!report) return;
                            onViewReport(report.reportId);
                          }}
                          className="inline-flex items-center px-3 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:ring-blue-500 focus:outline-none focus:ring-2 focus:ring-offset-2"
                          title="View Investigation Report"
                        >

                          <DocumentTextIcon className="h-4 w-4" aria-hidden="true" />
                        </button>
                      )} */}
                    </div>
                  </td>
                </tr>
              )
            }
            )}
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

export default CaseDetailTaskLogTable;