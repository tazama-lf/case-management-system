import React, { useState, useEffect, Suspense, lazy } from 'react';
import {
  MagnifyingGlassIcon,
  ChevronDownIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import { PageContainer, Card } from '@/shared/components/ui';
import ResultsSummary from '@/shared/components/ui/ResultsSummary';
import WorkQueueTable from '@/features/workqueue/components/WorkQueueTable';
import WorkQueueTableSkeleton from '@/features/workqueue/components/WorkQueueTableSkeleton';
import WorkQueueErrorBoundary, {
  useWorkQueueErrorHandler,
} from '@/features/workqueue/components/WorkQueueErrorBoundary';
import { flowableWorkQueueService } from '@/features/workqueue/services/flowableWorkQueueService';
import { useWorkQueuePagination } from '@/features/workqueue/hooks/useWorkQueuePagination';
import { useToast } from '@/shared/providers/ToastProvider';
import {
  taskService,
  TaskStatus,
  type TaskStatusType,
} from '@/features/cases/services/taskService';
import type {
  UnifiedWorkQueueTask,
  WorkQueueCandidateGroupType,
} from '@/features/workqueue/types/flowable.types';
import { useDynamicRoute } from '@/shared/utils/routeUtils';
import { useAuth } from '@/features/auth';

// Dynamic imports for modals
const AssignTaskModal = lazy(
  () => import('@/features/cases/components/modals/AssignTaskModal'),
);
const ReassignTaskModal = lazy(
  () => import('@/features/cases/components/modals/ReassignTaskModal'),
);
const UnassignTaskModal = lazy(
  () => import('@/features/cases/components/modals/UnassignTaskModal'),
);
const CompleteTaskModal = lazy(
  () => import('@/features/cases/components/modals/CompleteTaskModal'),
);
const UpdateTaskStatusModal = lazy(
  () => import('@/features/cases/components/modals/UpdateTaskStatusModal'),
);

const WorkQueueDashboard: React.FC = () => {
  const { params, navigate } = useDynamicRoute();
  const { user, hasInvestigatorRole, hasSupervisorRole, hasCMSAdminRole } =
    useAuth();
  const { success, error: toastError } = useToast();
  const [search, setSearch] = useState('');
  const [candidateGroupFilter, setCandidateGroupFilter] =
    useState<WorkQueueCandidateGroupType>('investigations');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const [tasks, setTasks] = useState<UnifiedWorkQueueTask[]>([]);

  const statusOptions = [
    { value: '', label: 'All Statuses' },
    { value: 'UNASSIGNED', label: 'Unassigned' },
    { value: 'ASSIGNED', label: 'Assigned' },
    { value: 'IN_PROGRESS', label: 'In Progress' },
    { value: 'COMPLETED', label: 'Completed' },
    { value: 'SUSPENDED', label: 'Suspended' },
  ];
  const [isLoading, setIsLoading] = useState(true);

  const { error, handleError, clearError, getErrorDisplay } =
    useWorkQueueErrorHandler();

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [unassignModalOpen, setUnassignModalOpen] = useState(false);
  const [closeTaskModalOpen, setCloseTaskModalOpen] = useState(false);
  const [updateStatusModalOpen, setUpdateStatusModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<UnifiedWorkQueueTask | null>(
    null,
  );

  // Check if user is investigator only (no supervisor or admin role)
  const isInvestigatorOnly =
    hasInvestigatorRole() && !hasSupervisorRole() && !hasCMSAdminRole();
  const isSupervisor = hasSupervisorRole() && !hasCMSAdminRole();
  const candidateGroups = flowableWorkQueueService.getCandidateGroups(
    isInvestigatorOnly,
    isSupervisor,
  );

  useEffect(() => {
    const loadWorkQueue = async () => {
      setIsLoading(true);
      clearError();

      try {
        const workQueueTasks =
          await flowableWorkQueueService.getWorkQueueByGroup(
            candidateGroupFilter,
          );
        setTasks(workQueueTasks);
      } catch (err) {
        handleError(err);
        setTasks([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkQueue();
  }, [candidateGroupFilter, clearError, handleError]);

  // Handle URL-based task viewing
  useEffect(() => {
    const taskId = params.taskId;
    if (taskId && tasks.length > 0) {
      const taskToView = tasks.find((t) => t.id === taskId);
      if (taskToView) {
        setSelectedTask(taskToView);
        // Auto-open the most relevant modal based on task status
        if (taskToView.status === 'UNASSIGNED') {
          setAssignModalOpen(true);
        } else if (
          taskToView.status === 'ASSIGNED' ||
          taskToView.status === 'IN_PROGRESS'
        ) {
          setUpdateStatusModalOpen(true);
        }
      } else {
        // Task not found, redirect to work queue
        navigate('/work-queue');
      }
    }
  }, [tasks, params.taskId, navigate]);

  const filteredTasks = tasks.filter((task: UnifiedWorkQueueTask) => {
    const matchesSearch =
      search === '' ||
      [
        task.id,
        task.name || '',
        task.description || '',
        task.candidateGroup || '',
        task.caseId || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(search.toLowerCase());

    const matchesStatus = statusFilter === '' || task.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  // Use pagination hook with filtered tasks
  const { pagination, paginatedTasks, setPageSize } =
    useWorkQueuePagination(filteredTasks);

  const handleAssignTask = (taskData: UnifiedWorkQueueTask) => {
    setSelectedTask(taskData);
    setAssignModalOpen(true);
    // Update URL to include task ID for deep linking
    navigate(`/work-queue/${taskData.id}`);
  };

  const handleReassignTask = (taskData: UnifiedWorkQueueTask) => {
    setSelectedTask(taskData);
    setReassignModalOpen(true);
    // Update URL to include task ID for deep linking
    navigate(`/work-queue/${taskData.id}`);
  };

  const handleUnassignTask = (taskData: UnifiedWorkQueueTask) => {
    setSelectedTask(taskData);
    setUnassignModalOpen(true);
    // Update URL to include task ID for deep linking
    navigate(`/work-queue/${taskData.id}`);
  };

  const handleCompleteTask = (taskData: UnifiedWorkQueueTask) => {
    setSelectedTask(taskData);
    setCloseTaskModalOpen(true);
    // Update URL to include task ID for deep linking
    navigate(`/work-queue/${taskData.id}`);
  };

  const handleUpdateTaskStatus = (taskData: UnifiedWorkQueueTask) => {
    setSelectedTask(taskData);
    setUpdateStatusModalOpen(true);
    // Update URL to include task ID for deep linking
    navigate(`/work-queue/${taskData.id}`);
  };

  // Unified handler for all task operations with type checking
  type TaskOperation =
    | 'assign'
    | 'reassign'
    | 'unassign'
    | 'updateStatus'
    | 'complete';

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
    operationParams: TaskOperationParams,
  ): Promise<void> => {
    const { task, assignee, newStatus, reason } = operationParams;

    try {
      // Validation based on operation type
      if ((operation === 'assign' || operation === 'reassign') && !assignee) {
        console.warn(`Cannot ${operation} task: missing assignee`, {
          task,
          assignee,
        });
        toastError(
          `${operation === 'assign' ? 'Assign' : 'Reassign'} Task Failed`,
          'Missing assignee',
        );
        return;
      }

      if (operation === 'updateStatus' && !newStatus) {
        console.warn('Cannot update task status: missing status', {
          task,
          newStatus,
        });
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
        case 'reassign': {
          await flowableWorkQueueService.assignTask(task.id, assignee!, {
            currentUserId: user?.userId,
            isInvestigator: hasInvestigatorRole(),
          });
          break;
        }
        case 'unassign':
          await flowableWorkQueueService.unassignTask(task.id);
          break;
        case 'complete':
          await flowableWorkQueueService.completeTask(task.id, {
            notes: operationParams.notes || '',
          });
          break;
        case 'updateStatus': {
          const statusMap: Record<string, TaskStatusType> = {
            Unassigned: TaskStatus.STATUS_01_UNASSIGNED,
            Assigned: TaskStatus.STATUS_10_ASSIGNED,
            'In Progress': TaskStatus.STATUS_20_IN_PROGRESS,
            Blocked: TaskStatus.STATUS_21_BLOCKED,
            Complete: TaskStatus.STATUS_30_COMPLETED,
          };
          const backendStatus = statusMap[newStatus!];
          if (backendStatus) {
            await taskService.updateTaskForSupervisor(task.id, {
              status: backendStatus,
            });
          }
          break;
        }
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      // Close modals and clear URL params first (before refresh to prevent re-opening)
      setAssignModalOpen(false);
      setReassignModalOpen(false);
      setUnassignModalOpen(false);
      setUpdateStatusModalOpen(false);
      setCloseTaskModalOpen(false);
      setSelectedTask(null);

      // Clear task ID from URL if present
      if (params.taskId) {
        navigate('/work-queue', { replace: true });
      }

      const updatedTasks =
        await flowableWorkQueueService.getWorkQueueByGroup(
          candidateGroupFilter,
        );
      setTasks(updatedTasks);

      // Success message
      const operationMessages = {
        assign: 'Task Assigned Successfully',
        reassign: 'Task Reassigned Successfully',
        unassign: 'Task Unassigned Successfully',
        complete: 'Task Completed Successfully',
        updateStatus: 'Task Status Updated Successfully',
      };

      success(
        operationMessages[operation],
        `Task ${task.id} has been ${operation === 'updateStatus' ? 'updated' : operation === 'complete' ? 'completed' : operation + 'ed'} successfully.`,
      );
    } catch (error) {
      console.error(`Failed to ${operation} task:`, error);
      const operationLabels = {
        assign: 'Assign Task Failed',
        reassign: 'Reassign Task Failed',
        unassign: 'Unassign Task Failed',
        complete: 'Complete Task Failed',
        updateStatus: 'Update Task Status Failed',
      };
      toastError(
        operationLabels[operation],
        error instanceof Error ? error.message : `Failed to ${operation} task`,
      );
    }
  };

  // Simplified handler functions that use the unified handler
  const handleModalAssign = async (
    task: UnifiedWorkQueueTask,
    assignee: string,
    notes?: string,
  ) => {
    await handleTaskOperation('assign', { task, assignee, notes });
  };

  const handleModalReassign = async (
    task: UnifiedWorkQueueTask,
    assignee: string,
    justification: string,
  ) => {
    await handleTaskOperation('reassign', { task, assignee, justification });
  };

  const handleModalUnassign = async (_taskId: string, reason: string) => {
    if (selectedTask) {
      await handleTaskOperation('unassign', { task: selectedTask, reason });
    }
  };

  const handleModalCloseTask = async (
    task: UnifiedWorkQueueTask,
    _notes?: string,
  ) => {
    await handleTaskOperation('complete', { task });
  };

  const handleModalUpdateStatus = async (
    task: UnifiedWorkQueueTask,
    newStatus: string,
    notes?: string,
  ) => {
    await handleTaskOperation('updateStatus', { task, newStatus, notes });
  };

  return (
    <PageContainer
      title="Work Queue"
      subtitle="View and manage tasks in various work queues"
    >
      {}
      <Card className="mb-4">
        <div className="p-4">
          <div className="flex flex-col space-y-4 lg:flex-row lg:space-y-0 lg:space-x-4">
            {}
            <div className="flex items-center space-x-2">
              <QueueListIcon className="h-5 w-5 text-gray-400" />
              <span className="text-sm font-medium text-gray-700">Queue:</span>
            </div>
            <div className="relative w-full lg:max-w-[200px]">
              <select
                aria-label="Select queue"
                value={candidateGroupFilter}
                onChange={(e) =>
                  setCandidateGroupFilter(
                    e.target.value as WorkQueueCandidateGroupType,
                  )
                }
                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {candidateGroups.map((group) => (
                  <option key={group.value} value={group.value}>
                    {group.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>

            {}
            <div className="relative w-full lg:max-w-[160px]">
              <select
                aria-label="Status filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                {statusOptions.map((option) => (
                  <option key={option.value || 'all'} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>

            {}
            <div className="relative w-full">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks, cases, descriptions..."
                className="w-full rounded-md border border-gray-300 bg-white px-10 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {}
      <Card>
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-md mb-4">
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <p className="text-red-600 text-sm font-medium">
                  {getErrorDisplay()?.message || 'Error loading work queue'}
                </p>
                {getErrorDisplay()?.actionSuggestion && (
                  <p className="text-red-500 text-xs mt-1">
                    {getErrorDisplay()?.actionSuggestion}
                  </p>
                )}
              </div>
              {getErrorDisplay()?.canRetry && (
                <button
                  onClick={() => {
                    clearError();
                    const loadWorkQueue = async () => {
                      setIsLoading(true);
                      try {
                        const workQueueTasks =
                          await flowableWorkQueueService.getWorkQueueByGroup(
                            candidateGroupFilter,
                          );
                        setTasks(workQueueTasks);
                      } catch (err) {
                        handleError(err);
                      } finally {
                        setIsLoading(false);
                      }
                    };
                    loadWorkQueue();
                  }}
                  className="ml-4 px-3 py-1 text-xs font-medium text-red-600 bg-red-100 rounded hover:bg-red-200 transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {isLoading ? (
          <WorkQueueTableSkeleton rows={10} />
        ) : filteredTasks.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <QueueListIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <div className="text-sm text-gray-500">
                No tasks found in{' '}
                {
                  candidateGroups.find((g) => g.value === candidateGroupFilter)
                    ?.label
                }
              </div>
            </div>
          </div>
        ) : (
          <>
            <ResultsSummary
              pagination={pagination}
              loading={isLoading}
              lastUpdated={null}
              onPageSizeChange={setPageSize}
              sort={{ column: 'id', direction: 'asc' }}
              itemType="work queue tasks"
            />
            <WorkQueueTable
              tasks={paginatedTasks}
              pagination={pagination}
              onAssign={handleAssignTask}
              onReassign={handleReassignTask}
              onUnassign={handleUnassignTask}
              onComplete={handleCompleteTask}
              onUpdateStatus={handleUpdateTaskStatus}
            />
          </>
        )}
      </Card>

      {/* Task Modals */}
      <Suspense fallback={<div>Loading modal...</div>}>
        <AssignTaskModal
          open={assignModalOpen}
          onClose={() => {
            setAssignModalOpen(false);
            setSelectedTask(null);
            // Clear task ID from URL when closing modal
            if (params.taskId) {
              navigate('/work-queue');
            }
          }}
          onAssign={handleModalAssign}
          task={selectedTask}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <ReassignTaskModal
          open={reassignModalOpen}
          onClose={() => {
            setReassignModalOpen(false);
            setSelectedTask(null);
            // Clear task ID from URL when closing modal
            if (params.taskId) {
              navigate('/work-queue');
            }
          }}
          onReassign={handleModalReassign}
          task={selectedTask}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <UnassignTaskModal
          open={unassignModalOpen}
          onClose={() => {
            setUnassignModalOpen(false);
            setSelectedTask(null);
            // Clear task ID from URL when closing modal
            if (params.taskId) {
              navigate('/work-queue');
            }
          }}
          onUnassign={handleModalUnassign}
          task={selectedTask}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <CompleteTaskModal
          open={closeTaskModalOpen}
          onClose={() => {
            setCloseTaskModalOpen(false);
            setSelectedTask(null);
            // Clear task ID from URL when closing modal
            if (params.taskId) {
              navigate('/work-queue');
            }
          }}
          onCompleteTask={handleModalCloseTask}
          task={selectedTask}
        />
      </Suspense>

      <Suspense fallback={<div>Loading modal...</div>}>
        <UpdateTaskStatusModal
          open={updateStatusModalOpen}
          onClose={() => {
            setUpdateStatusModalOpen(false);
            setSelectedTask(null);
            // Clear task ID from URL when closing modal
            if (params.taskId) {
              navigate('/work-queue');
            }
          }}
          onUpdateStatus={handleModalUpdateStatus}
          task={selectedTask}
        />
      </Suspense>
    </PageContainer>
  );
};

const WorkQueueDashboardWithErrorBoundary: React.FC = () => (
  <WorkQueueErrorBoundary>
    <WorkQueueDashboard />
  </WorkQueueErrorBoundary>
);

export default WorkQueueDashboardWithErrorBoundary;
