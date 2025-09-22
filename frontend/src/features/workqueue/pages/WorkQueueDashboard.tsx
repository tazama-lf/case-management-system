import React, { useState, useEffect } from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon, QueueListIcon } from '@heroicons/react/24/outline';
import { PageContainer, Card } from '../../../shared/components/ui';
import WorkQueueTable from '../components/WorkQueueTable';
import WorkQueueTableSkeleton from '../components/WorkQueueTableSkeleton';
import { taskService, type TaskForSupervisor, type WorkQueueFilters } from '../../supervisor/services/taskService';

const WorkQueueDashboard: React.FC = () => {
  // State for filters and search
  const [search, setSearch] = useState('');
  const [candidateGroupFilter, setCandidateGroupFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  
  // Data state
  const [tasks, setTasks] = useState<TaskForSupervisor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Available candidate groups for queue selection
  const candidateGroups = [
    { value: '', label: 'All Queues' },
    { value: 'Investigations', label: 'Investigations Queue' },
    { value: 'Triage', label: 'Triage Queue' },
    { value: 'Supervisors', label: 'Supervisor Queue' },
    { value: 'Analysts', label: 'Analyst Queue' },
  ];

  // Load work queue data
  useEffect(() => {
    const loadWorkQueue = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const filters: WorkQueueFilters = {
          candidateGroup: candidateGroupFilter || undefined,
          page: 1,
          limit: 50,
        };
        
        console.log('Loading work queue with filters:', filters);
        const response = await taskService.getWorkQueue(filters);
        console.log('Work queue loaded:', response.tasks?.length || 0, 'tasks');
        setTasks(response.tasks || []);
      } catch (err) {
        console.error('Failed to load work queue:', err);
        setError(err as Error);
        setTasks([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadWorkQueue();
  }, [candidateGroupFilter, statusFilter]);

  // Filter tasks based on search and status
  const filteredTasks = tasks.filter((task: TaskForSupervisor) => {
    const matchesSearch = search === '' || [
      task.task_id,
      task.case_id,
      task.name || '',
      task.description || '',
      task.candidateGroup || '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase());

    const matchesStatus = statusFilter === '' || task.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const handleAssignTask = (taskData: TaskForSupervisor) => {
    // TODO: Implement task assignment
    console.log('Assign task:', taskData.task_id);
  };

  const handleViewTask = (taskData: TaskForSupervisor) => {
    // TODO: Implement task viewing
    console.log('View task:', taskData.task_id);
  };

  const handleCompleteTask = (taskData: TaskForSupervisor) => {
    // TODO: Implement task completion
    console.log('Complete task:', taskData.task_id);
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
                onChange={(e) => setCandidateGroupFilter(e.target.value)}
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
                <option value="STATUS_01_UNASSIGNED">Unassigned</option>
                <option value="STATUS_10_ASSIGNED">Assigned</option>
                <option value="STATUS_20_IN_PROGRESS">In Progress</option>
                <option value="STATUS_30_COMPLETED">Completed</option>
                <option value="STATUS_21_BLOCKED">Blocked</option>
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
                {candidateGroupFilter ? `${candidateGroups.find(g => g.value === candidateGroupFilter)?.label} Tasks` : 'Total Tasks'}
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">
                {filteredTasks.filter(t => t.status === 'STATUS_01_UNASSIGNED').length}
              </div>
              <div className="text-sm text-gray-500">Unassigned</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {filteredTasks.filter(t => t.status === 'STATUS_10_ASSIGNED').length}
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
            <p className="text-red-600 text-sm">Error loading work queue: {error.message}</p>
          </div>
        )}
        
        {isLoading ? (
          <WorkQueueTableSkeleton rows={10} />
        ) : filteredTasks.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <QueueListIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <div className="text-sm text-gray-500">
                {candidateGroupFilter ? `No tasks found in ${candidateGroups.find(g => g.value === candidateGroupFilter)?.label}` : 'No tasks found in work queue'}
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

export default WorkQueueDashboard;