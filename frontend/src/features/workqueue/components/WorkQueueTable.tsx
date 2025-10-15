import React from 'react';
import { UserPlusIcon, UserMinusIcon, CheckIcon, ClockIcon, ArrowPathIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import type { UnifiedWorkQueueTask } from '../types/flowable.types';

interface WorkQueueTableProps {
  tasks: UnifiedWorkQueueTask[];
  onAssign: (task: UnifiedWorkQueueTask) => void;
  onUnassign?: (task: UnifiedWorkQueueTask) => void;
  onReassign?: (task: UnifiedWorkQueueTask) => void;
  onComplete: (task: UnifiedWorkQueueTask) => void;
  onUpdateStatus?: (task: UnifiedWorkQueueTask) => void;
}

const WorkQueueTable: React.FC<WorkQueueTableProps> = ({
  tasks,
  onAssign,
  onUnassign,
  onReassign,
  onComplete,
  onUpdateStatus,
}) => {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      UNASSIGNED: { color: 'bg-gray-100 text-gray-800', label: 'Unassigned' },
      ASSIGNED: { color: 'bg-blue-100 text-blue-800', label: 'Assigned' },
      IN_PROGRESS: { color: 'bg-yellow-100 text-yellow-800', label: 'In Progress' },
      COMPLETED: { color: 'bg-green-100 text-green-800', label: 'Completed' },
      SUSPENDED: { color: 'bg-red-100 text-red-800', label: 'Blocked' },
    };

    const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.UNASSIGNED;
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

  const getAvailableActions = (task: UnifiedWorkQueueTask) => {
    const actions = [];

    // Show Assign action only for unassigned tasks
    if (!task.assignee) {
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

    // Show Reassign action only for assigned tasks
    if (task.assignee && onReassign) {
      actions.push(
        <button
          key="reassign"
          onClick={() => onReassign(task)}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          title="Reassign task"
        >
          <ArrowPathIcon className="h-3 w-3 mr-1" />
          Reassign
        </button>
      );
    }

    // Show Unassign action only for assigned tasks
    if (task.assignee && onUnassign) {
      actions.push(
        <button
          key="unassign"
          onClick={() => onUnassign(task)}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          title="Unassign task"
        >
          <UserMinusIcon className="h-3 w-3 mr-1" />
          Unassign
        </button>
      );
    }

    // Show Complete action for assigned tasks
    if (task.assignee) {
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

    // Show Update Status action for all tasks if handler is provided
    if (onUpdateStatus) {
      actions.push(
        <button
          key="update-status"
          onClick={() => onUpdateStatus(task)}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          title="Update status"
        >
          <Cog6ToothIcon className="h-3 w-3 mr-1" />
          Status
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
            {tasks.map((task, index) => (
              <tr key={task.id || `task-${index}`} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex flex-col">
                    <div className="text-sm font-medium text-gray-900 truncate max-w-[150px]" title={task.id || 'No ID'}>
                      {task.id ? `${task.id.slice(0, 8)}...` : 'No ID'}
                    </div>
                    {task.name && (
                      <div className="text-xs text-gray-500 truncate max-w-[150px]" title={task.name}>
                        {task.name}
                      </div>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 truncate max-w-[120px]" title={task.caseId || ''}>
                    {task.caseId?.slice(0, 8)}...
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
                  <div className="flex items-center text-sm text-gray-500">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    {formatDate(task.createdAt)}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900">
                    {task.assignee ? (
                      <span className="text-blue-600">{task.assigneeName || task.assignee}</span>
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