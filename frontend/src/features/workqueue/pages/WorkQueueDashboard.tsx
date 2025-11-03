import React, { useState, useEffect, Suspense, lazy } from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon, QueueListIcon } from '@heroicons/react/24/outline';
import { PageContainer, Card } from '@/shared/components/ui';
import WorkQueueTable from '@/features/workqueue/components/WorkQueueTable';
import WorkQueueTableSkeleton from '@/features/workqueue/components/WorkQueueTableSkeleton';
import WorkQueueErrorBoundary, { useWorkQueueErrorHandler } from '@/features/workqueue/components/WorkQueueErrorBoundary';
import { flowableWorkQueueService } from '@/features/workqueue/services/flowableWorkQueueService';
import type { UnifiedWorkQueueTask, WorkQueueCandidateGroupType } from '@/features/workqueue/types/flowable.types';
import { useDynamicRoute } from '@/shared/utils/routeUtils';

// Dynamic imports for modals
const AssignTaskModal = lazy(() => import('@/features/cases/components/modals/AssignTaskModal'));
const ReassignTaskModal = lazy(() => import('@/features/cases/components/modals/ReassignTaskModal'));
const UnassignTaskModal = lazy(() => import('@/features/cases/components/modals/UnassignTaskModal'));
const CloseTaskModal = lazy(() => import('@/features/cases/components/modals/CloseTaskModal'));
const UpdateTaskStatusModal = lazy(() => import('@/features/cases/components/modals/UpdateTaskStatusModal'));


const WorkQueueDashboard: React.FC = () => {
  const { params, navigate } = useDynamicRoute();
  const [search, setSearch] = useState('');
  const [candidateGroupFilter, setCandidateGroupFilter] = useState<WorkQueueCandidateGroupType>('investigations');
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

  const { error, handleError, clearError, getErrorDisplay } = useWorkQueueErrorHandler();

  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [unassignModalOpen, setUnassignModalOpen] = useState(false);
  const [closeTaskModalOpen, setCloseTaskModalOpen] = useState(false);
  const [updateStatusModalOpen, setUpdateStatusModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<UnifiedWorkQueueTask | null>(null);

  const candidateGroups = flowableWorkQueueService.getCandidateGroups();


  useEffect(() => {
    const loadWorkQueue = async () => {
      setIsLoading(true);
      clearError();

      try {
        const workQueueTasks = await flowableWorkQueueService.getWorkQueueByGroup(candidateGroupFilter);
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
      const taskToView = tasks.find(t => t.id === taskId);
      if (taskToView) {
        setSelectedTask(taskToView);
        // Auto-open the most relevant modal based on task status
        if (taskToView.status === 'UNASSIGNED') {
          setAssignModalOpen(true);
        } else if (taskToView.status === 'ASSIGNED' || taskToView.status === 'IN_PROGRESS') {
          setUpdateStatusModalOpen(true);
        }
      } else {
        // Task not found, redirect to work queue
        navigate('/work-queue');
      }
    }
  }, [tasks, params.taskId, navigate]);


  const filteredTasks = tasks.filter((task: UnifiedWorkQueueTask) => {
    const matchesSearch = search === '' || [
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


  const handleModalAssign = async (task: UnifiedWorkQueueTask, assignee: string, _notes?: string) => {

    if (!task || !task.id) {
      console.error('Cannot assign task: task or task ID is missing', { task });
      handleError(new Error('Task ID is required for assignment'));
      return;
    }

    if (!assignee) {
      console.error('Cannot assign task: assignee is missing', { task, assignee });
      handleError(new Error('Assignee is required for assignment'));
      return;
    }

    try {
      await flowableWorkQueueService.assignTask(task.id, assignee);

      const updatedTasks = await flowableWorkQueueService.getWorkQueueByGroup(candidateGroupFilter);
      setTasks(updatedTasks);

      setAssignModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      handleError(error);
    }
  };

  const handleModalReassign = async (task: UnifiedWorkQueueTask, assignee: string, _justification: string) => {
    try {
      await flowableWorkQueueService.assignTask(task.id, assignee);

      const updatedTasks = await flowableWorkQueueService.getWorkQueueByGroup(candidateGroupFilter);
      setTasks(updatedTasks);

      setReassignModalOpen(false);
      setSelectedTask(null);

    } catch (error) {
      handleError(error);
    }
  };

  const handleModalUnassign = async (taskId: string) => {
    try {
      await flowableWorkQueueService.unassignTask(taskId);

      const updatedTasks = await flowableWorkQueueService.getWorkQueueByGroup(candidateGroupFilter);
      setTasks(updatedTasks);

      setUnassignModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      handleError(error);
    }
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

  const handleModalCloseTask = async (task: UnifiedWorkQueueTask, notes: string) => {
    try {
      await flowableWorkQueueService.completeTask(task.id, { notes });

      const updatedTasks = await flowableWorkQueueService.getWorkQueueByGroup(candidateGroupFilter);
      setTasks(updatedTasks);

      setCloseTaskModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      handleError(error);
    }
  };

  const handleModalUpdateStatus = async (task: UnifiedWorkQueueTask, newStatus: string, notes?: string) => {
    try {
      const statusMapping = {
        'Unassigned': 'UNASSIGNED',
        'Assigned': 'ASSIGNED',
        'In Progress': 'IN_PROGRESS',
        'Blocked': 'SUSPENDED',
        'Complete': 'COMPLETED'
      };

      const mappedStatus = statusMapping[newStatus as keyof typeof statusMapping];

      if (mappedStatus === 'COMPLETED') {
        await flowableWorkQueueService.completeTask(task.id, { notes });
      }

      const updatedTasks = await flowableWorkQueueService.getWorkQueueByGroup(candidateGroupFilter);
      setTasks(updatedTasks);

      setUpdateStatusModalOpen(false);
      setSelectedTask(null);
    } catch (error) {
      handleError(error);
    }
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
                onChange={(e) => setCandidateGroupFilter(e.target.value as WorkQueueCandidateGroupType)}
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
                        const workQueueTasks = await flowableWorkQueueService.getWorkQueueByGroup(candidateGroupFilter);
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
                No tasks found in {candidateGroups.find(g => g.value === candidateGroupFilter)?.label}
              </div>
            </div>
          </div>
        ) : (
          <WorkQueueTable
            tasks={filteredTasks}
            onAssign={handleAssignTask}
            onReassign={handleReassignTask}
            onUnassign={handleUnassignTask}
            onComplete={handleCompleteTask}
            onUpdateStatus={handleUpdateTaskStatus}
          />
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
        <CloseTaskModal
          open={closeTaskModalOpen}
          onClose={() => {
            setCloseTaskModalOpen(false);
            setSelectedTask(null);
            // Clear task ID from URL when closing modal
            if (params.taskId) {
              navigate('/work-queue');
            }
          }}
          onCloseTask={handleModalCloseTask}
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