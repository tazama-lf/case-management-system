import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon, QueueListIcon } from '@heroicons/react/24/outline';
import { PageContainer, Card } from '../../../shared/components/ui';
import WorkQueueTable from '../components/WorkQueueTable';
import WorkQueueTableSkeleton from '../components/WorkQueueTableSkeleton';
import WorkQueueErrorBoundary, { useWorkQueueErrorHandler } from '../components/WorkQueueErrorBoundary';
import { flowableWorkQueueService } from '../services/flowableWorkQueueService';
import type { UnifiedWorkQueueTask, WorkQueueCandidateGroupType } from '../types/flowable.types';

const WorkQueueDashboard: React.FC = () => {
  // State for filters and search
  const [search, setSearch] = useState('');
  const [candidateGroupFilter, setCandidateGroupFilter] = useState<WorkQueueCandidateGroupType>('investigators');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // Data state
  const [tasks, setTasks] = useState<UnifiedWorkQueueTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Enhanced error handling
  const { error, handleError, clearError, getErrorDisplay } = useWorkQueueErrorHandler();

  // Available candidate groups for queue selection
  const candidateGroups = flowableWorkQueueService.getCandidateGroups();

  // Load work queue data
  useEffect(() => {
    const loadWorkQueue = async () => {
      setIsLoading(true);
      clearError();
      
      try {
        console.log('Loading work queue with candidate group:', candidateGroupFilter);
        const workQueueTasks = await flowableWorkQueueService.getWorkQueueByGroup(candidateGroupFilter);
        console.log('Work queue loaded:', workQueueTasks.length, 'tasks');
        setTasks(workQueueTasks);
      } catch (err) {
        console.error('Failed to load work queue:', err);
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

  const handleAssignTask = async (taskData: UnifiedWorkQueueTask) => {
    try {
      // TODO: Implement user selection dialog
      const assigneeUserId = 'placeholder-user-id'; // This should come from a user picker
      await flowableWorkQueueService.assignTask(taskData.id, assigneeUserId);
      
      // Refresh the work queue
      const updatedTasks = await flowableWorkQueueService.getWorkQueueByGroup(candidateGroupFilter);
      setTasks(updatedTasks);
      
      console.log('Task assigned successfully:', taskData.id);
    } catch (error) {
      console.error('Failed to assign task:', error);
      handleError(error);
    }
  };

  const handleViewTask = (taskData: UnifiedWorkQueueTask) => {
    // TODO: Implement task viewing modal
    console.log('View task:', taskData);
  };

  const handleCompleteTask = async (taskData: UnifiedWorkQueueTask) => {
    try {
      await flowableWorkQueueService.completeTask(taskData.id);
      
      // Refresh the work queue
      const updatedTasks = await flowableWorkQueueService.getWorkQueueByGroup(candidateGroupFilter);
      setTasks(updatedTasks);
      
      console.log('Task completed successfully:', taskData.id);
    } catch (error) {
      console.error('Failed to complete task:', error);
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

      {/* Work Queue Summary */}
      <Card className="mb-4">
        <div className="p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{filteredTasks.length}</div>
              <div className="text-sm text-gray-500">
                {candidateGroups.find(g => g.value === candidateGroupFilter)?.label} Tasks
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">
                {filteredTasks.filter(t => t.status === 'UNASSIGNED').length}
              </div>
              <div className="text-sm text-gray-500">Unassigned</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {filteredTasks.filter(t => t.status === 'ASSIGNED').length}
              </div>
              <div className="text-sm text-gray-500">Assigned</div>
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
            onView={handleViewTask}
            onComplete={handleCompleteTask}
          />
        )}
      </Card>
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