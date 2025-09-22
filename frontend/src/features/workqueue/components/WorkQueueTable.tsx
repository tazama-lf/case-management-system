import React from 'react';
import { EyeIcon, UserPlusIcon, CheckIcon, ClockIcon } from '@heroicons/react/24/outline';
import type { TaskForSupervisor } from '../../supervisor/services/taskService';

interface WorkQueueTableProps {
  tasks: TaskForSupervisor[];
  onAssign: (task: TaskForSupervisor) => void;
  onView: (task: TaskForSupervisor) => void;
  onComplete: (task: TaskForSupervisor) => void;
}

const WorkQueueTable: React.FC<WorkQueueTableProps> = ({
  tasks,
  onAssign,
  onView,
  onComplete,
}) => {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      STATUS_01_UNASSIGNED: { color: 'bg-gray-100 text-gray-800', label: 'Unassigned' },
      STATUS_10_ASSIGNED: { color: 'bg-blue-100 text-blue-800', label: 'Assigned' },
      STATUS_20_IN_PROGRESS: { color: 'bg-yellow-100 text-yellow-800', label: 'In Progress' },
      STATUS_30_COMPLETED: { color: 'bg-green-100 text-green-800', label: 'Completed' },
      STATUS_21_BLOCKED: { color: 'bg-red-100 text-red-800', label: 'Blocked' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.STATUS_01_UNASSIGNED;
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const getPriorityBadge = (priority?: string) => {
    if (!priority) return null;
    
    const priorityConfig = {
      CRITICAL: { color: 'bg-red-100 text-red-800', label: 'Critical' },
      HIGH: { color: 'bg-orange-100 text-orange-800', label: 'High' },
      MEDIUM: { color: 'bg-yellow-100 text-yellow-800', label: 'Medium' },
      LOW: { color: 'bg-gray-100 text-gray-800', label: 'Low' },
      NEW: { color: 'bg-blue-100 text-blue-800', label: 'New' },
    };

    const config = priorityConfig[priority as keyof typeof priorityConfig];
    if (!config) return null;

    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAvailableActions = (task: TaskForSupervisor) => {
    const actions = [];
    
    // View action is always available
    actions.push(
      <button
        key="view"
        onClick={() => onView(task)}
        className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-indigo-700 bg-indigo-100 hover:bg-indigo-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        title="View details"
      >
        <EyeIcon className="h-3 w-3 mr-1" />
        View
      </button>
    );

    // Assign action for unassigned tasks
    if (task.status === 'STATUS_01_UNASSIGNED') {
      actions.push(
        <button
          key="assign"
          onClick={() => onAssign(task)}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          title="Assign task"
        >
          <UserPlusIcon className="h-3 w-3 mr-1" />
          Assign
        </button>
      );
    }

    // Complete action for assigned or in-progress tasks
    if (task.status === 'STATUS_10_ASSIGNED' || task.status === 'STATUS_20_IN_PROGRESS') {
      actions.push(
        <button
          key="complete"
          onClick={() => onComplete(task)}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
          title="Mark complete"
        >
          <CheckIcon className="h-3 w-3 mr-1" />
          Complete
        </button>
      );
    }

    return actions;
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Task
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Case
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Queue
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Priority
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assigned To
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.map((task) => (
              <tr key={task.task_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]" title={task.task_id}>
                      {task.task_id.slice(0, 8)}...
                    </div>
                    {task.name && (
                      <div className="text-xs text-gray-500 truncate max-w-[150px]" title={task.name}>
                        {task.name}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 truncate max-w-[120px]" title={task.case_id}>
                    {task.case_id?.slice(0, 8)}...
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {task.candidateGroup || 'General'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {getStatusBadge(task.status)}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  {/* Priority from related case would be shown here */}
                  {getPriorityBadge('MEDIUM')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center text-sm text-gray-500">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    {formatDate(task.created_at)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {task.assigned_user_id ? (
                      <span className="text-blue-600">Assigned</span>
                    ) : (
                      <span className="text-gray-400">Unassigned</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    {getAvailableActions(task)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">No tasks found in work queue</p>
        </div>
      )}
    </div>
  );
};

export default WorkQueueTable;