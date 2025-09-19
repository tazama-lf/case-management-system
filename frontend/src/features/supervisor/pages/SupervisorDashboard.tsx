import React, { useState } from 'react';
import { MagnifyingGlassIcon, ChevronDownIcon, PlusIcon } from '@heroicons/react/24/outline';
import { PageContainer, Card } from '../../../shared/components/ui';
import SupervisorTasksTable from '../components/SupervisorTasksTable';
import SupervisorCasesTableSkeleton from '../components/SupervisorTableSkeleton';
import CreateCaseModal from '../components/CreateCaseModal';
import ViewCaseModal from '../components/ViewCaseModal';
import AssignTaskModal from '../components/AssignTaskModal';
import { type TaskForSupervisor, taskService } from '../services/taskService';


const SupervisorDashboard: React.FC = () => {
  // State for filters and search
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [sortBy] = useState<'recent' | 'oldest'>('recent');

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  
  // Selected task data
  const [selectedTask, setSelectedTask] = useState<TaskForSupervisor | null>(null);
  const [allTasks, setAllTasks] = useState<TaskForSupervisor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Load all tasks from API
  React.useEffect(() => {
    const loadAllTasks = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        console.log('Loading tasks with filter:', statusFilter || 'none');
        const tasks = await taskService.getAllTasks(statusFilter || undefined);
        console.log('Loaded tasks:', tasks.length, 'tasks');
        console.log('Task details:', tasks.map(t => ({ 
          id: t.task_id.slice(0, 8), 
          status: t.status, 
          name: t.name 
        })));
        setAllTasks(tasks);
      } catch (err) {
        console.error('Failed to load all tasks:', err);
        setError(err as Error);
        
        // Fallback to empty array on error
        setAllTasks([]);
      } finally {
        setIsLoading(false);
      }
    };

    loadAllTasks();
  }, [statusFilter, sortBy]);

  // Filter tasks based on search
  const filteredTasks = allTasks.filter((t: TaskForSupervisor) =>
    search === '' || [
      t.task_id,
      t.case_id,
      t.name || '',
      t.description || '',
      t.assignedUser?.username || '',
      t.status,
      t.candidateGroup || '',
    ]
      .join(' ')
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleCreateCase = () => {
    setShowCreateModal(true);
  };

  const handleReview = (taskData: TaskForSupervisor) => {
    setSelectedTask(taskData);
    setShowReviewModal(true);
  };

  const handleAssign = (taskData: TaskForSupervisor) => {
    setSelectedTask(taskData);
    setShowAssignModal(true);
  };

  const handleComplete = async (taskData: TaskForSupervisor) => {
    try {
      await taskService.completeTaskForSupervisor(taskData.task_id);
      console.log(`Task ${taskData.task_id} completed successfully`);
      
      // Update local state
      setAllTasks(prev => 
        prev.map(t => 
          t.task_id === taskData.task_id 
            ? { ...t, status: 'STATUS_30_COMPLETED', updated_at: new Date().toISOString() }
            : t
        )
      );
    } catch (error) {
      console.error('Failed to complete task:', error);
    }
  };

  const handleCreateCaseSubmit = (payload: any) => {
    console.log('Creating case:', payload);
    setShowCreateModal(false);
  };

  const handleAssignTaskSubmit = async (payload: { assignedUserId: string }) => {
    if (!selectedTask) return;
    
    try {
      const response = await taskService.assignTaskToInvestigator(selectedTask.task_id, payload.assignedUserId);
      console.log('Task assigned successfully:', response);
      
      // Update local state with response data or fallback to payload
      setAllTasks(prev => 
        prev.map(t => 
          t.task_id === selectedTask.task_id 
            ? { 
                ...t, 
                status: response.status || 'STATUS_10_ASSIGNED',
                assigned_user_id: response.assigned_user_id || payload.assignedUserId,
                updated_at: response.updated_at || new Date().toISOString()
              }
            : t
        )
      );
      
      setShowAssignModal(false);
      setSelectedTask(null);
      
      // Show success message
      console.log('Task assignment completed successfully');
    } catch (error) {
      console.error('Failed to assign task:', error);
      
      // More detailed error handling
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      } else if (error && typeof error === 'object' && 'message' in error) {
        errorMessage = (error as any).message;
      }
      
      console.error('Error details:', {
        taskId: selectedTask.task_id,
        assignedUserId: payload.assignedUserId,
        error: errorMessage
      });
    }
  };

  return (
    <PageContainer
      title="Supervisor Dashboard"
      subtitle="Manage and oversee all tasks in the system"
      actions={
        <button 
          onClick={handleCreateCase} 
          className="inline-flex items-center gap-2 rounded-md bg-indigo-600 px-4 py-2 text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        >
          <PlusIcon className="h-4 w-4" />
          Create Case
        </button>
      }
    >
      {/* Filters */}
      <Card className="bg-indigo-50/40" padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-1 flex-col items-stretch gap-3 sm:flex-row">
            <div className="flex items-center space-x-4">
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="appearance-none bg-white border border-gray-300 rounded-md px-3 py-2 pr-8 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="STATUS_01_UNASSIGNED">Unassigned</option>
                  <option value="STATUS_10_ASSIGNED">Assigned</option>
                  <option value="STATUS_20_IN_PROGRESS">In Progress</option>
                  <option value="STATUS_21_BLOCKED">Blocked</option>
                  <option value="STATUS_30_COMPLETED">Completed</option>
                </select>
                <ChevronDownIcon className="absolute right-2 top-2.5 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>

            <div className="relative w-full">
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search tasks..."
                className="w-full rounded-md border border-gray-300 bg-white px-10 py-2 text-sm text-gray-900 placeholder:text-gray-400 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              />
              <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-gray-400">
                <MagnifyingGlassIcon className="h-5 w-5" aria-hidden="true" />
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Tasks Table */}
      <Card className="mt-4">
        {isLoading ? (
          <SupervisorCasesTableSkeleton rows={8} />
        ) : error ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-red-600">Error loading tasks: {error.message}</div>
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-sm text-gray-500">No tasks found</div>
          </div>
        ) : (
          <SupervisorTasksTable 
            tasks={filteredTasks}
            onReview={handleReview}
            onAssign={handleAssign}
            onComplete={handleComplete}
          />
        )}
      </Card>

      {/* Modals */}
      <CreateCaseModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onCreate={handleCreateCaseSubmit}
      />

      {/* View Task Modal - reusing ViewCaseModal for now */}
      {showReviewModal && selectedTask && (
        <ViewCaseModal
          open={showReviewModal}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedTask(null);
          }}
          row={{
            id: selectedTask.task_id,
            type: selectedTask.case?.case_type || 'INVESTIGATION',
            typeColor: 'bg-blue-100 text-blue-800',
            status: selectedTask.status,
            statusColor: 'bg-yellow-100 text-yellow-800',
            typologyId: selectedTask.case_id,
            score: 0,
            createdOn: new Date(selectedTask.created_at).toLocaleDateString(),
            pickedOn: new Date(selectedTask.updated_at).toLocaleDateString(),
            action: 'View' as const,
            reassignEnabled: true,
            assignee: selectedTask.assignedUser?.username || 'Unassigned',
            priority: selectedTask.case?.priority || 'MEDIUM',
            userRole: 'owner' as const,
            totalTasks: 0
          }}
        />
      )}

      {/* Assign Task Modal */}
      {showAssignModal && selectedTask && (
        <AssignTaskModal
          open={showAssignModal}
          onClose={() => {
            setShowAssignModal(false);
            setSelectedTask(null);
          }}
          onAssign={(_taskId: string, assignedUserId: string) => {
            handleAssignTaskSubmit({ assignedUserId });
          }}
          task={selectedTask}
        />
      )}
    </PageContainer>
  );
};

export default SupervisorDashboard;
