import React, { useState, useEffect } from 'react';
import WorkQueueTable from '../../../workqueue/components/WorkQueueTable';
import UnassignTaskModal from '../modals/UnassignTaskModal';
import AssignTaskModal from '../modals/AssignTaskModal';
import ReassignTaskModal from '../modals/ReassignTaskModal';
import CloseTaskModal from '../modals/CloseTaskModal';
import UpdateTaskStatusModal from '../modals/UpdateTaskStatusModal';
import { taskService, TaskStatus } from '../../services/taskService';
import type { TaskForSupervisor } from '../../services/taskService';
import type { UnifiedWorkQueueTask } from '../../../workqueue/types/flowable.types';


interface TaskLogTabProps {
  caseId: string;
}
const TaskLogTab: React.FC<TaskLogTabProps> = ({ caseId }) => {
  const [tasks, setTasks] = useState<TaskForSupervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal state
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [unassignModalOpen, setUnassignModalOpen] = useState(false);
  const [closeTaskModalOpen, setCloseTaskModalOpen] = useState(false);
  const [updateStatusModalOpen, setUpdateStatusModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<UnifiedWorkQueueTask | null>(null);

  useEffect(() => {
    const fetchTasks = async () => {
      if (!caseId) return;
      
      try {
        setLoading(true);
        setError(null);
        const fetchedTasks = await taskService.getTasksByCaseId(caseId);
        setTasks(fetchedTasks);
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
    return {
      id: backendTask.task_id,
      taskId: backendTask.task_id,
      name: backendTask.name || 'Unnamed Task',
      description: backendTask.description,
      assignee: backendTask.assigned_user_id,
      assigneeName: backendTask.assignedUser?.username || backendTask.assigned_user_id,
      candidateGroup: backendTask.candidateGroup || 'investigations',
      status: mapTaskStatus(backendTask.status),
      priority: 'NEW', // Default priority 
      createdAt: backendTask.created_at,
      dueDate: undefined,
      processInstanceId: '',
      caseId: backendTask.case_id || '',
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

  const filteredTasks = tasks.filter(task => {
    const taskId = task.task_id || '';
    const taskName = task.name || '';
    const taskDescription = task.description || '';
    
    const matchesSearch = !searchTerm || 
      taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      taskDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      taskId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || task.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const transformedTasks = filteredTasks.map(transformBackendTaskToWorkQueue);
  

  const handleAssign = (task: UnifiedWorkQueueTask) => {
    setSelectedTask(task);
    setAssignModalOpen(true);
  };

  const handleComplete = (task: UnifiedWorkQueueTask) => {
    setSelectedTask(task);
    setCloseTaskModalOpen(true);
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

  const handleModalAssign = async (task: UnifiedWorkQueueTask, assignee: string, notes?: string) => {
    try {
      setAssignModalOpen(false);
      setSelectedTask(null);
      const fetchedTasks = await taskService.getTasksByCaseId(caseId);
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Failed to assign task:', error);
    }
  };

  const handleModalReassign = async (task: UnifiedWorkQueueTask, assignee: string, justification: string) => {
    try {
      setReassignModalOpen(false);
      setSelectedTask(null);
      const fetchedTasks = await taskService.getTasksByCaseId(caseId);
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Failed to reassign task:', error);
    }
  };

  const handleModalCloseTask = async (task: UnifiedWorkQueueTask, outcome: string, notes: string) => {
    try {
      setCloseTaskModalOpen(false);
      setSelectedTask(null);
      const fetchedTasks = await taskService.getTasksByCaseId(caseId);
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Failed to close task:', error);
    }
  };

  const handleModalUpdateStatus = async (task: UnifiedWorkQueueTask, newStatus: string, notes?: string) => {
    try {
      setUpdateStatusModalOpen(false);
      setSelectedTask(null);
      const fetchedTasks = await taskService.getTasksByCaseId(caseId);
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Failed to update task status:', error);
    }
  };

  const handleUnassignTask = async (taskId: string, reason: string) => {
    try {
      await taskService.unassignTask(taskId, { reason });
      setUnassignModalOpen(false);
      setSelectedTask(null);
      const fetchedTasks = await taskService.getTasksByCaseId(caseId);
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Failed to unassign task:', error);
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
            <option value="all">Status: All</option>
            <option value={TaskStatus.STATUS_01_UNASSIGNED}>Unassigned</option>
            <option value={TaskStatus.STATUS_10_ASSIGNED}>Assigned</option>
            <option value={TaskStatus.STATUS_20_IN_PROGRESS}>In Progress</option>
            <option value={TaskStatus.STATUS_21_BLOCKED}>Blocked</option>
            <option value={TaskStatus.STATUS_30_COMPLETED}>Completed</option>
          </select>
        </div>
      </div>

      {transformedTasks.length === 0 ? (
        <div className="text-center py-8">
          <div className="text-sm text-gray-500">
            {tasks.length === 0 ? 'No tasks found for this case.' : 'No tasks match your search criteria.'}
          </div>
        </div>
      ) : (
        <WorkQueueTable
          tasks={transformedTasks}
          onAssign={handleAssign}
          onReassign={handleReassign}
          onUnassign={handleUnassign}
          onComplete={handleComplete}
          onUpdateStatus={handleUpdateStatus}
        />
      )}
      
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
        onUnassign={handleUnassignTask}
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
    </div>
  );
};

export default TaskLogTab;
