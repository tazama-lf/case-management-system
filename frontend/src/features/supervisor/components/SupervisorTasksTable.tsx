import React from 'react';
import { EyeIcon, CheckIcon, UserPlusIcon } from '@heroicons/react/24/outline';
import type { TaskForSupervisor } from '../services/taskService';

interface SupervisorTasksTableProps {
  tasks: TaskForSupervisor[];
  onReview: (taskData: TaskForSupervisor) => void;
  onAssign: (taskData: TaskForSupervisor) => void;
  onComplete: (taskData: TaskForSupervisor) => void;
}

const SupervisorTasksTable: React.FC<SupervisorTasksTableProps> = ({
  tasks,
  onReview,
  onAssign,
  onComplete
}) => {
  return (
    <div className="bg-white shadow rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Task ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Name
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Case ID
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Assigned To
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Created
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.map((taskData) => (
              <tr key={taskData.task_id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  {taskData.task_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {taskData.name || 'Unnamed Task'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {taskData.case_id}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                    taskData.status === 'STATUS_30_COMPLETED' 
                      ? 'bg-green-100 text-green-800'
                      : taskData.status === 'STATUS_20_IN_PROGRESS'
                      ? 'bg-blue-100 text-blue-800'
                      : taskData.status === 'STATUS_21_BLOCKED'
                      ? 'bg-red-100 text-red-800'
                      : taskData.status === 'STATUS_10_ASSIGNED'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {taskData.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {taskData.assignedUser?.username || (taskData.assigned_user_id ? `User ${taskData.assigned_user_id.slice(0, 8)}` : 'Unassigned')}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {new Date(taskData.created_at).toLocaleDateString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex items-center justify-end space-x-2">
                    <button
                      onClick={() => onReview(taskData)}
                      className="inline-flex items-center px-3 py-1 border border-gray-300 rounded-md text-sm bg-white hover:bg-gray-50 focus:ring-2 focus:ring-blue-500"
                    >
                      <EyeIcon className="h-4 w-4 mr-1" />
                      View
                    </button>
                    
                    {/* Assign button - show for unassigned tasks */}
                    {taskData.status === 'STATUS_01_UNASSIGNED' && (
                      <button
                        onClick={() => onAssign(taskData)}
                        className="inline-flex items-center px-3 py-1 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 focus:ring-2 focus:ring-blue-500"
                      >
                        <UserPlusIcon className="h-4 w-4 mr-1" />
                        Assign
                      </button>
                    )}
                    
                    {/* Complete button - show for in progress tasks */}
                    {taskData.status === 'STATUS_20_IN_PROGRESS' && (
                      <button
                        onClick={() => onComplete(taskData)}
                        className="inline-flex items-center px-3 py-1 bg-green-600 text-white rounded-md text-sm hover:bg-green-700 focus:ring-2 focus:ring-green-500"
                      >
                        <CheckIcon className="h-4 w-4 mr-1" />
                        Complete
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      {tasks.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500">No tasks found</p>
        </div>
      )}
    </div>
  );
};

export default SupervisorTasksTable;
