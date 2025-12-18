import React, { useState, useEffect, lazy, Suspense, useMemo } from 'react';
import CaseDetailTaskLogTable from './CaseDetailTaskLogTable';
import { taskService, TaskStatus, type TaskStatusType } from '../../services/taskService';
import type { TaskForSupervisor } from '../../services/taskService';
import type { UnifiedWorkQueueTask } from '../../../workqueue/types/flowable.types';
import { useToast } from '../../../../shared/providers/ToastProvider';
import { useAuth } from '@/features/auth/components/AuthContext';
import TaskDetailsModal from '../TasksDetailsModal';
import SarStrFilingModal from '../modals/SarStrFilingModal';
import type { CaseRow } from '../casesTable.utils';
import authService from '@/features/auth/services/authService';
import { caseService, type CaseWithTasksDto } from '../../services/caseService';
import { transformBackendCaseToUI } from '../casesTable.utils';

const UnassignTaskModal = lazy(() => import('../modals/UnassignTaskModal'));
const AssignTaskModal = lazy(() => import('../modals/AssignTaskModal'));
const ReassignTaskModal = lazy(() => import('../modals/ReassignTaskModal'));
const UpdateTaskStatusModal = lazy(() => import('../modals/UpdateTaskStatusModal'));
const CompleteTaskModal = lazy(() => import('../modals/CompleteTaskModal'));

interface TaskLogTabProps {
  caseId: number;
  caseStatus?: string;
  onRefreshCases?: () => Promise<void>;
  alertId?: number;
  canManageSupervisorActions?: boolean;
  caseData?: any;
  onApproveCase?: (caseData: any) => void;
  onApproveCaseCreation?: (caseData: any) => void;
  onRejectCaseCreation?: (caseData: any) => void;
  onAbandonCase?: (caseData: any) => void;
}
const TaskLogTab: React.FC<TaskLogTabProps> = ({
  caseId,
  onRefreshCases,
  alertId,
  canManageSupervisorActions = false,
  caseStatus,
  // caseData,
  onApproveCase,
  onApproveCaseCreation,
  onRejectCaseCreation,
  onAbandonCase
}) => {
  const { success, error: toastError } = useToast();
  const { hasSupervisorRole, hasCMSAdminRole, hasComplianceOfficerRole } = useAuth();
  const [tasks, setTasks] = useState<TaskForSupervisor[]>([]);
  const [caseData, setCaseData] = useState<CaseRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [taskDetailsModalOpen, setTaskDetailsModalOpen] = useState(false);
  const [sarStrFilingModalOpen, setSarStrFilingModalOpen] = useState(false);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [unassignModalOpen, setUnassignModalOpen] = useState(false);
  const [updateStatusModalOpen, setUpdateStatusModalOpen] = useState(false);
  const [completeTaskModalOpen, setCompleteTaskModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<UnifiedWorkQueueTask | null>(null);
  const [investigators, setInvestigators] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchTasks = async () => {
      if (!caseId) return;

      try {
        setLoading(true);
        setError(null);
        // old version
        // const fetchedTasks = await taskService.getTasksByCaseId(caseId);

        // Fetch tasks and case data in parallel
        const [fetchedTasks, fetchedCase] = await Promise.all([
          taskService.getTasksByCaseId(caseId),
          caseService.getUserCases({ limit: 1000 }).then(response =>
            response.cases.find(c => c.case_id === caseId)
          )
        ]);

        setTasks(fetchedTasks);

        // Transform backend case data to CaseRow format if found
        if (fetchedCase) {
          const transformedCase = transformBackendCaseToUI(fetchedCase);
          setCaseData(transformedCase);
        }

        // Fetch all investigators to build name mapping
        try {
          const investigatorList = await authService.fetchAllInvestigators();
          const investigatorMap: Record<string, string> = {};
          investigatorList.forEach((inv) => {
            const fullName = inv.firstName && inv.lastName ? `${inv.firstName} ${inv.lastName}` : inv.username;
            investigatorMap[inv.id] = fullName;
          });
          setInvestigators(investigatorMap);
        } catch (err) {
          console.warn('Failed to fetch investigators:', err);
        }
      } catch (err) {
        console.error('Failed to fetch tasks for case:', caseId, err);
        setError(err instanceof Error ? err.message : 'Failed to fetch tasks');
      } finally {
        setLoading(false);
      }
    };

    fetchTasks();
  }, [caseId]);


  const transformBackendTaskToWorkQueue = (backendTask: TaskForSupervisor): UnifiedWorkQueueTask => {

    let effectiveStatus = backendTask.status;
    if (backendTask.status === 'STATUS_10_ASSIGNED' && !backendTask.assigned_user_id) {
      effectiveStatus = 'STATUS_01_UNASSIGNED';
    }

    // Get full name from investigators map, fallback to username or ID
    let assigneeName: string | undefined;
    if (backendTask.assigned_user_id) {
      assigneeName = investigators[backendTask.assigned_user_id] ||
        backendTask.assignedUser?.username ||
        backendTask.assigned_user_id;
    }

    return {
      id: backendTask.task_id,
      taskId: backendTask.task_id,
      name: backendTask.name || 'Unnamed Task',
      description: backendTask.description,
      assignee: backendTask.assigned_user_id,
      assigneeName: backendTask.assignedUser?.username || backendTask.assigned_user_id,
      candidateGroup: backendTask.candidateGroup || 'investigations',
      status: mapTaskStatus(effectiveStatus),
      priority: 'NEW',
      createdAt: backendTask.created_at,
      dueDate: undefined,
      processInstanceId: '',
      caseId: backendTask.case_id,
      flowableData: undefined
    };
  };

  const mapTaskStatus = (status: string): 'UNASSIGNED' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'SUSPENDED' => {
    switch (status) {
      case 'STATUS_01_UNASSIGNED': return 'UNASSIGNED';
      case 'STATUS_10_ASSIGNED': return 'ASSIGNED';
      case 'STATUS_20_IN_PROGRESS': return 'IN_PROGRESS';
      case 'STATUS_30_COMPLETED': return 'COMPLETED';
      case 'STATUS_21_BLOCKED': return 'SUSPENDED';
      default: return 'UNASSIGNED';
    }
  };

  // Status options mapping for the filter dropdown
  const statusOptions = [
    { value: 'all', label: 'Status: All' },
    { value: TaskStatus.STATUS_01_UNASSIGNED, label: 'Unassigned' },
    { value: TaskStatus.STATUS_10_ASSIGNED, label: 'Assigned' },
    { value: TaskStatus.STATUS_20_IN_PROGRESS, label: 'In Progress' },
    { value: TaskStatus.STATUS_21_BLOCKED, label: 'Blocked' },
    { value: TaskStatus.STATUS_30_COMPLETED, label: 'Completed' },
  ];

  const canViewSupervisorQueue = hasSupervisorRole() || hasCMSAdminRole();

  const visibleTasks = useMemo(() => {
    if (canViewSupervisorQueue) {
      return tasks;
    }

    // Filter out supervisor-only tasks for investigators
    // Investigators should see their own tasks (Investigate Case, etc.) but not approval tasks
    const filtered = tasks.filter((task) => {
      const candidateGroup = (task.candidateGroup || '').toLowerCase();
      const taskName = (task.name || '').toLowerCase();
      const taskDescription = (task.description || '').toLowerCase();

      // Define patterns that identify supervisor-only tasks
      // Only filter based on candidate group and specific task names, not descriptions
      const supervisorTaskPatterns = [
        // Candidate group patterns
        candidateGroup === 'supervisors',
        candidateGroup === 'supervisor',

        // Specific supervisor task name patterns
        taskName.includes('approve case creation'),
        taskName.includes('approve case reopening'),
        taskName.includes('approve case closure'),
        taskName.includes('reject case creation'),
        taskName.includes('reject case reopening'),
        taskName.includes('review case closure'),
        taskName.includes('supervisor review'),
        taskName.includes('final approval'),

        // Task description patterns
        taskDescription.includes('supervisor'),
        taskDescription.includes('approval required'),

        // Legacy patterns
        taskName === 'approve case creation',
        taskName === 'review case closure',
        taskName === 'approve case reopening',
        taskName === 'approve case closure',
      ];

      const isSupervisorTask = supervisorTaskPatterns.some(pattern => pattern === true);

      return !isSupervisorTask;
    });

    return filtered;
  }, [tasks, canViewSupervisorQueue]);

  const filteredTasks = visibleTasks.filter(task => {
    const taskId = task.task_id || '';
    const taskName = task.name || '';
    const taskDescription = task.description || '';

    const matchesSearch = !searchTerm ||
      taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      taskDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      taskId.toString().toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const transformedTasks = filteredTasks.map(transformBackendTaskToWorkQueue);


  const handleAssign = (task: UnifiedWorkQueueTask) => {
    setSelectedTask(task);
    setAssignModalOpen(true);
  };



  const handleUnassign = (task: UnifiedWorkQueueTask) => {
    setSelectedTask(task);
    setUnassignModalOpen(true);
  };

  const handleReassign = (task: UnifiedWorkQueueTask) => {
    setSelectedTask(task);
    setReassignModalOpen(true);
  };

  const handleUpdateStatus = (task: UnifiedWorkQueueTask) => {
    setSelectedTask(task);
    setUpdateStatusModalOpen(true);
  };

  const handleCompleteTask = (task: UnifiedWorkQueueTask) => {
    setSelectedTask(task);
    setCompleteTaskModalOpen(true);
  };

  // Unified handler for all task operations with type checking
  type TaskOperation = 'assign' | 'reassign' | 'unassign' | 'updateStatus';

  interface TaskOperationParams {
    task: UnifiedWorkQueueTask;
    assignee?: string;
    newStatus?: string;
    reason?: string;
    notes?: string;
    justification?: string;
  }

  const handleTaskOperation = async (
    operation: TaskOperation,
    params: TaskOperationParams
  ): Promise<void> => {
    const { task, assignee, newStatus, reason, justification, notes } = params;

    try {
      // Validation based on operation type
      if ((operation === 'assign' || operation === 'reassign') && !assignee) {
        console.warn(`Cannot ${operation} task: missing assignee`, { task, assignee });
        toastError(`${operation === 'assign' ? 'Assign' : 'Reassign'} Task Failed`, 'Missing assignee');
        return;
      }

      if (operation === 'updateStatus' && !newStatus) {
        console.warn('Cannot update task status: missing status', { task, newStatus });
        toastError('Update Task Status Failed', 'Missing status');
        return;
      }

      if (operation === 'unassign' && !reason) {
        console.warn('Cannot unassign task: missing reason', { task, reason });
        toastError('Unassign Task Failed', 'Missing reason');
        return;
      }

      // Execute the appropriate operation
      switch (operation) {
        case 'assign':
          await taskService.assignTaskToInvestigator(task.id, assignee!, notes);
          break;
        case 'reassign':
          await taskService.reassignTask(task.id, assignee!, justification!);
          break;
        case 'unassign':
          await taskService.unassignTask(task.id, { reason: reason! });
          break;
        case 'updateStatus': {
          const statusMap: Record<string, TaskStatusType> = {
            'Unassigned': TaskStatus.STATUS_01_UNASSIGNED,
            'Assigned': TaskStatus.STATUS_10_ASSIGNED,
            'In Progress': TaskStatus.STATUS_20_IN_PROGRESS,
            'Blocked': TaskStatus.STATUS_21_BLOCKED,
            'Complete': TaskStatus.STATUS_30_COMPLETED
          };
          const backendStatus = statusMap[newStatus!];
          if (backendStatus) {
            await taskService.updateTaskForSupervisor(task.id, { status: backendStatus });
          }
          break;
        }
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      // Close modals and refresh tasks
      setAssignModalOpen(false);
      setReassignModalOpen(false);
      setUnassignModalOpen(false);
      setUpdateStatusModalOpen(false);
      setSelectedTask(null);

      const fetchedTasks = await taskService.getTasksByCaseId(caseId);
      setTasks(fetchedTasks);

      // Refresh the cases list to show updated case status/assignments
      if (onRefreshCases) {
        await onRefreshCases();
      }

      // Success message
      const operationMessages = {
        assign: 'Task Assigned Successfully',
        reassign: 'Task Reassigned Successfully',
        unassign: 'Task Unassigned Successfully',
        updateStatus: 'Task Status Updated Successfully'
      };

      success(operationMessages[operation], `Task ${task.id} has been ${operation === 'updateStatus' ? 'updated' : operation + 'ed'} successfully.`);
    } catch (error) {
      console.error(`Failed to ${operation} task:`, error);
      const operationLabels = {
        assign: 'Assign Task Failed',
        reassign: 'Reassign Task Failed',
        unassign: 'Unassign Task Failed',
        updateStatus: 'Update Task Status Failed'
      };
      toastError(operationLabels[operation], error instanceof Error ? error.message : `Failed to ${operation} task`);
    }
  };

  // Simplified handler functions that use the unified handler
  const handleModalAssign = (task: UnifiedWorkQueueTask, assignee: string, notes?: string) =>
    handleTaskOperation('assign', { task, assignee, notes });

  const handleModalReassign = (task: UnifiedWorkQueueTask, assignee: string, justification: string) =>
    handleTaskOperation('reassign', { task, assignee, justification });

  const handleUnassignTask = (_taskId: string, reason: string) => {
    if (selectedTask) {
      return handleTaskOperation('unassign', { task: selectedTask, reason });
    }
  };

  const handleModalUpdateStatus = (task: UnifiedWorkQueueTask, newStatus: string, notes?: string) =>
    handleTaskOperation('updateStatus', { task, newStatus, notes });

  const handleModalCompleteTask = async (task: UnifiedWorkQueueTask, notes?: string, recommendedOutcome?: string) => {
    try {
      const updateData: { status: TaskStatusType; recommendedOutcome?: string; finalNotes?: string } = {
        status: TaskStatus.STATUS_30_COMPLETED
      };

      // Add recommended outcome if provided (for AML/Fraud investigation tasks)
      if (recommendedOutcome) {
        updateData.recommendedOutcome = recommendedOutcome;
      }

      // Add final notes if provided
      if (notes && notes.trim()) {
        updateData.finalNotes = notes.trim();
      }

      await taskService.updateTaskForSupervisor(task.id, updateData);

      // Close modal and refresh tasks
      setCompleteTaskModalOpen(false);
      setSelectedTask(null);

      const fetchedTasks = await taskService.getTasksByCaseId(caseId);
      setTasks(fetchedTasks);

      // Refresh the cases list to show updated case status
      if (onRefreshCases) {
        await onRefreshCases();
      }

      success('Task Completed Successfully', `Task ${task.id} has been completed successfully.`);
    } catch (error) {
      toastError('Complete Task Failed', error instanceof Error ? error.message : 'Failed to complete task');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="text-sm text-gray-500">Loading tasks...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-md bg-red-50 p-4">
        <div className="text-sm text-red-700">
          Error loading tasks: {error}
        </div>
      </div>
    );
  }

  const handleViewTaskDetails = (task: UnifiedWorkQueueTask) => {
    setSelectedTask(task);

    // Check if this should open SAR/STR Filing modal instead of Task Details
    const hasRequiredRole = hasComplianceOfficerRole() || hasSupervisorRole();
    // const hasRequiredRole = hasSupervisorRole();
    const isClosedCase = caseStatus === 'STATUS_81_CLOSED_REFUTED' ||
      caseStatus === 'STATUS_82_CLOSED_CONFIRMED';
    const isUnassignedTask = task.status === 'UNASSIGNED';

    if (hasRequiredRole && isClosedCase && isUnassignedTask) {
      // Open SAR/STR Filing modal for closed cases with unassigned tasks
      setSarStrFilingModalOpen(true);
    } else {
      // Open regular Task Details modal
      setTaskDetailsModalOpen(true);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Search tasks..."
          />
        </div>
        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {transformedTasks.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-sm text-gray-500">
            {visibleTasks.length === 0 ? 'No tasks found for this case.' : 'No tasks match your search criteria.'}
          </div>
        </div>
      ) : (
        <CaseDetailTaskLogTable
          alertId={alertId}
          tasks={transformedTasks}
          onAssign={handleAssign}
          onReassign={handleReassign}
          onUnassign={handleUnassign}
          onUpdateStatus={handleUpdateStatus}
          onComplete={handleCompleteTask}
          onTaskClick={handleViewTaskDetails}
          onRefreshCases={onRefreshCases}
          canManageSupervisorActions={canManageSupervisorActions}
          caseData={caseData}
          onApproveCase={onApproveCase}
          onApproveCaseCreation={onApproveCaseCreation}
          onRejectCaseCreation={onRejectCaseCreation}
          onAbandonCase={onAbandonCase}
        />
      )}

      {/* Conditional modal rendering to prevent performance bottlenecks */}
      {assignModalOpen && (
        <Suspense fallback={<div>Loading...</div>}>
          <AssignTaskModal
            open={assignModalOpen}
            onClose={() => {
              setAssignModalOpen(false);
              setSelectedTask(null);
            }}
            onAssign={handleModalAssign}
            task={selectedTask}
          />
        </Suspense>
      )}

      {reassignModalOpen && (
        <Suspense fallback={<div>Loading...</div>}>
          <ReassignTaskModal
            open={reassignModalOpen}
            onClose={() => {
              setReassignModalOpen(false);
              setSelectedTask(null);
            }}
            onReassign={handleModalReassign}
            task={selectedTask}
          />
        </Suspense>
      )}

      {unassignModalOpen && (
        <Suspense fallback={<div>Loading...</div>}>
          <UnassignTaskModal
            open={unassignModalOpen}
            onClose={() => {
              setUnassignModalOpen(false);
              setSelectedTask(null);
            }}
            onUnassign={handleUnassignTask}
            task={selectedTask}
          />
        </Suspense>
      )}

      {updateStatusModalOpen && (
        <Suspense fallback={<div>Loading...</div>}>
          <UpdateTaskStatusModal
            open={updateStatusModalOpen}
            onClose={() => {
              setUpdateStatusModalOpen(false);
              setSelectedTask(null);
            }}
            onUpdateStatus={handleModalUpdateStatus}
            task={selectedTask}
          />
        </Suspense>
      )}

      {completeTaskModalOpen && (
        <Suspense fallback={<div>Loading...</div>}>
          <CompleteTaskModal
            open={completeTaskModalOpen}
            onClose={() => {
              setCompleteTaskModalOpen(false);
              setSelectedTask(null);
            }}
            onCompleteTask={handleModalCompleteTask}
            task={selectedTask}
          />
        </Suspense>
      )}

      {taskDetailsModalOpen && selectedTask && (
        <Suspense fallback={<div>Loading...</div>}>
          <TaskDetailsModal
            open={taskDetailsModalOpen}
            onClose={() => {
              setTaskDetailsModalOpen(false);
              setSelectedTask(null);
            }}
            row={caseData || undefined}
            onRefreshCases={onRefreshCases}
            onTaskUpdate={async () => {
              // Refresh tasks in TaskLogTab when investigation task is completed
              if (caseId) {
                try {
                  const fetchedTasks = await taskService.getTasksByCaseId(caseId);
                  setTasks(fetchedTasks);
                } catch (err) {
                  console.error('Failed to refresh tasks:', err);
                }
              }
            }}
          />
        </Suspense>
      )}

      {sarStrFilingModalOpen && selectedTask && (
        <Suspense fallback={<div>Loading...</div>}>
          <SarStrFilingModal
            open={sarStrFilingModalOpen}
            onClose={() => {
              setSarStrFilingModalOpen(false);
              setSelectedTask(null);
            }}
            taskId={selectedTask.id}
            caseId={selectedTask.caseId || caseId}
            caseName={selectedTask.name || 'Untitled Case'}
          />
        </Suspense>
      )}
    </div>
  );
};

export default TaskLogTab;