import React, { useState, useEffect } from 'react';
import { taskService, TaskStatus } from '../../services/taskService';
import type { TaskForSupervisor } from '../../services/taskService';
import TasksTable, { transformBackendTaskToUI, type TaskRow } from './TasksTable';
import AssignTaskModal from '../modals/AssignTaskModal';
import ReassignTaskModal from '../modals/ReassignTaskModal';
import CloseTaskModal from '../modals/CloseTaskModal';
import UpdateTaskStatusModal from '../modals/UpdateTaskStatusModal';

interface TaskLogTabProps {
  caseId: string;
}

const TaskLogTab: React.FC<TaskLogTabProps> = ({ caseId }) => {
  const [tasks, setTasks] = useState<TaskForSupervisor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [closeModalOpen, setCloseModalOpen] = useState(false);
  const [updateStatusModalOpen, setUpdateStatusModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TaskRow | null>(null);

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

  const filteredTasks = tasks.filter(task => {
    const taskId = (task as any).task_id || (task as any).id || '';
    const taskName = (task as any).name || '';
    const taskDescription = (task as any).description || '';
    
    const matchesSearch = !searchTerm || 
      taskName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      taskDescription.toLowerCase().includes(searchTerm.toLowerCase()) ||
      taskId.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || (task as any).status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const transformedTasks = filteredTasks.map(transformBackendTaskToUI);
  const handleAssign = (task: TaskRow) => {
    setSelectedTask(task);
    setAssignModalOpen(true);
  };

  const handleComplete = (task: TaskRow) => {
    console.log('Complete task:', task.id);
  };

  const handleReassign = (task: TaskRow) => {
    setSelectedTask(task);
    setReassignModalOpen(true);
  };

  const handleClose = (task: TaskRow) => {
    setSelectedTask(task);
    setCloseModalOpen(true);
  };

  const handleUpdateStatus = (task: TaskRow) => {
    setSelectedTask(task);
    setUpdateStatusModalOpen(true);
  };

  const handleBlock = (task: TaskRow) => {
    console.log('Block task:', task.id);
  };
  const handleAssignTask = async (task: TaskRow, assignee: string, notes?: string) => {
    try {
      console.log('Assigning task:', task.id, 'to:', assignee, 'notes:', notes);
      setAssignModalOpen(false);
      setSelectedTask(null);
      const fetchedTasks = await taskService.getTasksByCaseId(caseId);
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Failed to assign task:', error);
    }
  };

  const handleReassignTask = async (task: TaskRow, assignee: string, justification: string) => {
    try {
      console.log('Reassigning task:', task.id, 'to:', assignee, 'justification:', justification);
      setReassignModalOpen(false);
      setSelectedTask(null);
      const fetchedTasks = await taskService.getTasksByCaseId(caseId);
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Failed to reassign task:', error);
    }
  };

  const handleCloseTask = async (task: TaskRow, outcome: string, notes: string) => {
    try {
      console.log('Closing task:', task.id, 'outcome:', outcome, 'notes:', notes);
      setCloseModalOpen(false);
      setSelectedTask(null);
      const fetchedTasks = await taskService.getTasksByCaseId(caseId);
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Failed to close task:', error);
    }
  };

  const handleUpdateTaskStatus = async (task: TaskRow, newStatus: string, notes?: string) => {
    try {
      console.log('Updating task status:', task.id, 'to:', newStatus, 'notes:', notes);
      setUpdateStatusModalOpen(false);
      setSelectedTask(null);
      const fetchedTasks = await taskService.getTasksByCaseId(caseId);
      setTasks(fetchedTasks);
    } catch (error) {
      console.error('Failed to update task status:', error);
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
        <TasksTable
          rows={transformedTasks}
          onComplete={handleComplete}
          onAssign={handleAssign}
          onReassign={handleReassign}
          onClose={handleClose}
          onUpdateStatus={handleUpdateStatus}
          onBlock={handleBlock}
        />
      )}
      <AssignTaskModal
        open={assignModalOpen}
        onClose={() => {
          setAssignModalOpen(false);
          setSelectedTask(null);
        }}
        onAssign={handleAssignTask}
        task={selectedTask}
      />

      <ReassignTaskModal
        open={reassignModalOpen}
        onClose={() => {
          setReassignModalOpen(false);
          setSelectedTask(null);
        }}
        onReassign={handleReassignTask}
        task={selectedTask}
      />

      <CloseTaskModal
        open={closeModalOpen}
        onClose={() => {
          setCloseModalOpen(false);
          setSelectedTask(null);
        }}
        onCloseTask={handleCloseTask}
        task={selectedTask}
      />

      <UpdateTaskStatusModal
        open={updateStatusModalOpen}
        onClose={() => {
          setUpdateStatusModalOpen(false);
          setSelectedTask(null);
        }}
        onUpdateStatus={handleUpdateTaskStatus}
        task={selectedTask}
      />
    </div>
  );
};

export default TaskLogTab;
