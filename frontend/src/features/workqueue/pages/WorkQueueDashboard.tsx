import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon, QueueListIcon } from '@heroicons/react/24/outline';
import { PageContainer, Card } from '../../../shared/components/ui';
import WorkQueueTable from '../components/WorkQueueTable';
import WorkQueueTableSkeleton from '../components/WorkQueueTableSkeleton';
import WorkQueueErrorBoundary, { useWorkQueueErrorHandler } from '../components/WorkQueueErrorBoundary';
import { flowableWorkQueueService } from '../services/flowableWorkQueueService';
import type { UnifiedWorkQueueTask, WorkQueueCandidateGroupType } from '../types/flowable.types';
import AssignTaskModal from '../../cases/components/modals/AssignTaskModal';
import ReassignTaskModal from '../../cases/components/modals/ReassignTaskModal';
import UnassignTaskModal from '../../cases/components/modals/UnassignTaskModal';
import CloseTaskModal from '../../cases/components/modals/CloseTaskModal';
import UpdateTaskStatusModal from '../../cases/components/modals/UpdateTaskStatusModal';


const WorkQueueDashboard: React.FC = () => {
  // State for filters and search
  const [search, setSearch] = useState('');
  const [candidateGroupFilter, setCandidateGroupFilter] = useState<WorkQueueCandidateGroupType>('investigations');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // Data state
  const [tasks, setTasks] = useState<UnifiedWorkQueueTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Enhanced error handling
  const { error, handleError, clearError, getErrorDisplay } = useWorkQueueErrorHandler();

  // Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [unassignModalOpen, setUnassignModalOpen] = useState(false);
  const [closeTaskModalOpen, setCloseTaskModalOpen] = useState(false);
  const [updateStatusModalOpen, setUpdateStatusModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<UnifiedWorkQueueTask | null>(null);

  // Available candidate groups for queue selection
  const candidateGroups = flowableWorkQueueService.getCandidateGroups();


  // Load work queue data
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

  // Filter tasks based on search and status
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
  };

  const handleReassignTask = (taskData: UnifiedWorkQueueTask) => {
    setSelectedTask(taskData);
    setReassignModalOpen(true);
  };

  const handleUnassignTask = (taskData: UnifiedWorkQueueTask) => {
    setSelectedTask(taskData);
    setUnassignModalOpen(true);
  };

  // Modal action handlers
  const handleModalAssign = async (task: UnifiedWorkQueueTask, assignee: string,) => {
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

  const handleModalReassign = async (task: UnifiedWorkQueueTask, assignee: string, justification: string) => {
    try {
      // For work queue dashboard, we need to use the flowable service for reassignment
      await flowableWorkQueueService.assignTask(task.id, assignee);
      
      // Refresh the task list
      const updatedTasks = await flowableWorkQueueService.getWorkQueueByGroup(candidateGroupFilter);
      setTasks(updatedTasks);
      
      // Close the modal and clear selected task
      setReassignModalOpen(false);
      setSelectedTask(null);
      
      // Show success message (in a real implementation, you might want to use a toast notification)
      console.log(`Task ${task.id} successfully reassigned to user ${assignee}`);
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
  };

  const handleUpdateTaskStatus = (taskData: UnifiedWorkQueueTask) => {
    setSelectedTask(taskData);
    setUpdateStatusModalOpen(true);
  };

  // Modal action handlers for new modals
  const handleModalCloseTask = async (task: UnifiedWorkQueueTask, outcome: string, notes: string) => {
    try {
      await flowableWorkQueueService.completeTask(task.id, { outcome, notes });
      
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
        await flowableWorkQueueService.completeTask(task.id, { status: newStatus, notes });
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
      {/* Queue Selection and Filters */}
      <Card className="mb-4">
        <div className="p-4">
          <div className="flex flex-col space-y-4 lg:flex-row lg:space-y-0 lg:space-x-4">
            {/* Queue Selection */}
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

            {/* Status Filter */}
            <div className="relative w-full lg:max-w-[160px]">
              <select
                aria-label="Status filter"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full appearance-none rounded-md border border-gray-300 bg-white px-3 py-2 pr-8 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">All Statuses</option>
                <option value="UNASSIGNED">Unassigned</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="SUSPENDED">Suspended</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-gray-400">
                <ChevronDownIcon className="h-4 w-4" aria-hidden="true" />
              </div>
            </div>

            {/* Search */}
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

    

      {/* Work Queue Table */}
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
                    // Trigger a refresh
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

      {/* Task Management Modals */}
      <AssignTaskModal
        open={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setSelectedTask(null);
        }}
        onAssign={handleModalAssign}
        task={selectedTask}
      />

      <ReassignTaskModal
        open={reassignModalOpen}
        onClose={() => {
          setReassignModalOpen(false);
          setSelectedTask(null);
        }}
        onReassign={handleModalReassign}
        task={selectedTask}
      />

      <UnassignTaskModal
        open={unassignModalOpen}
        onClose={() => {
          setUnassignModalOpen(false);
          setSelectedTask(null);
        }}
        onUnassign={handleModalUnassign}
        task={selectedTask}
      />

      <CloseTaskModal
        open={closeTaskModalOpen}
        onClose={() => {
          setCloseTaskModalOpen(false);
          setSelectedTask(null);
        }}
        onCloseTask={handleModalCloseTask}
        task={selectedTask}
      />

      <UpdateTaskStatusModal
        open={updateStatusModalOpen}
        onClose={() => {
          setUpdateStatusModalOpen(false);
          setSelectedTask(null);
        }}
        onUpdateStatus={handleModalUpdateStatus}
        task={selectedTask}
      />
    </PageContainer>
  );
};

// Wrap with error boundary for additional protection
const WorkQueueDashboardWithErrorBoundary: React.FC = () => (
  <WorkQueueErrorBoundary>
    <WorkQueueDashboard />
  </WorkQueueErrorBoundary>
);

export default WorkQueueDashboardWithErrorBoundary;