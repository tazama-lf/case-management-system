import React from 'react';
import { CheckIcon, ArrowPathIcon, PauseIcon, UserPlusIcon, XCircleIcon, Cog6ToothIcon } from '@heroicons/react/24/outline';
import { TaskStatus } from '../../services/taskService';

export type TaskRow = {
  id: string;
  name: string;
  description?: string;
  status: string;
  statusColor: string;
  assignee?: string;
  candidateGroup?: string;
  createdOn: string;
  updatedOn: string;
  caseId: string;
  action: 'View' | 'Start' | 'Complete';
  canReassign: boolean;
};

export const getTaskStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    'STATUS_01_UNASSIGNED': 'bg-blue-50 text-blue-700',
    'STATUS_10_ASSIGNED': 'bg-gray-100 text-gray-700',
    'STATUS_20_IN_PROGRESS': 'bg-yellow-50 text-yellow-700',
    'STATUS_21_BLOCKED': 'bg-red-50 text-red-700',
    'STATUS_30_COMPLETED': 'bg-green-50 text-green-700',
  };
  return statusColors[status] || 'bg-gray-100 text-gray-700';
};

export const formatTaskStatus = (status: string): string => {
  const statusMap: Record<string, string> = {
    'STATUS_01_UNASSIGNED': 'Unassigned',
    'STATUS_10_ASSIGNED': 'Assigned',
    'STATUS_20_IN_PROGRESS': 'In Progress',
    'STATUS_21_BLOCKED': 'Blocked',
    'STATUS_30_COMPLETED': 'Completed',
  };
  return statusMap[status] || status;
};

export const transformBackendTaskToUI = (backendTask: any): TaskRow => {
  const taskId = backendTask.task_id || backendTask.id;
  const taskName = backendTask.name || 'Unnamed Task';
  const taskStatus = backendTask.status;
  const createdAt = backendTask.created_at || backendTask.createdAt || new Date().toISOString();
  const updatedAt = backendTask.updated_at || backendTask.updatedAt || new Date().toISOString();
  const caseId = backendTask.case_id || backendTask.caseId || '';

  return {
    id: taskId,
    name: taskName,
    description: backendTask.description,
    status: formatTaskStatus(taskStatus),
    statusColor: getTaskStatusColor(taskStatus),
    assignee: backendTask.assignedUser?.username || backendTask.assignedUserName,
    candidateGroup: backendTask.candidateGroup,
    createdOn: new Date(createdAt).toLocaleDateString('en-GB'),
    updatedOn: new Date(updatedAt).toLocaleDateString('en-GB'),
    caseId: caseId,
    action: taskStatus === TaskStatus.STATUS_10_ASSIGNED ? 'Start' : 
            taskStatus === TaskStatus.STATUS_20_IN_PROGRESS ? 'Complete' : 'View',
    canReassign: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS].includes(taskStatus as any),
  };
};

interface TasksTableProps {
  rows: TaskRow[];
  onComplete?: (row: TaskRow) => void;
  onAssign?: (row: TaskRow) => void;
  onReassign?: (row: TaskRow) => void;
  onClose?: (row: TaskRow) => void;
  onUpdateStatus?: (row: TaskRow) => void;
  onBlock?: (row: TaskRow) => void;
}

const TasksTable: React.FC<TasksTableProps> = ({ 
  rows, 
  onComplete, 
  onAssign,
  onReassign, 
  onClose,
  onUpdateStatus,
  onBlock 
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Task ID</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Task Name</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Assignee</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Group</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Created</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Updated</th>
            <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows.map((task) => (
            <tr key={task.id} className="hover:bg-gray-50/50">
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{task.id}</td>
              <td className="px-4 py-3">
                <div className="text-sm font-medium text-gray-900">{task.name}</div>
                {task.description && (
                  <div className="text-xs text-gray-500 mt-1 max-w-xs truncate">
                    {task.description}
                  </div>
                )}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-gray-200 ${task.statusColor}`}>
                  {task.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                {task.assignee || 'Unassigned'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">
                {task.candidateGroup || '-'}
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{task.createdOn}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{task.updatedOn}</td>
              <td className="whitespace-nowrap px-2 py-3">
                <div className="flex justify-end gap-1">
                  {task.status === 'Unassigned' && onAssign && (
                    <button
                      onClick={() => onAssign(task)}
                      className="inline-flex items-center gap-1 rounded-md bg-purple-600 px-2 py-1 text-xs font-medium text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <UserPlusIcon className="h-3 w-3" />
                      Assign
                    </button>
                  )}


                  {task.action === 'Complete' && onComplete && (
                    <button
                      onClick={() => onComplete(task)}
                      className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-2 py-1 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <CheckIcon className="h-3 w-3" />
                      Complete
                    </button>
                  )}

                  {onReassign && task.canReassign && (
                    <button
                      onClick={() => onReassign(task)}
                      className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-1 text-xs font-medium text-gray-700 shadow-sm hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300"
                    >
                      <ArrowPathIcon className="h-3 w-3" />
                      Reassign
                    </button>
                  )}

                  {onClose && (task.status === 'In Progress' || task.status === 'Assigned') && (
                    <button
                      onClick={() => onClose(task)}
                      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-2 py-1 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <XCircleIcon className="h-3 w-3" />
                      Close
                    </button>
                  )}

                  {onUpdateStatus && task.status !== 'Complete' && (
                    <button
                      onClick={() => onUpdateStatus(task)}
                      className="inline-flex items-center gap-1 rounded-md bg-orange-600 px-2 py-1 text-xs font-medium text-white shadow-sm hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    >
                      <Cog6ToothIcon className="h-3 w-3" />
                      Status
                    </button>
                  )}

                  {onBlock && task.canReassign && task.status !== 'Blocked' && (
                    <button
                      onClick={() => onBlock(task)}
                      className="inline-flex items-center gap-1 rounded-md bg-yellow-600 px-2 py-1 text-xs font-medium text-white shadow-sm hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      <PauseIcon className="h-3 w-3" />
                      Block
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default TasksTable;
