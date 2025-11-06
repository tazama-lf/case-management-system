import React, { useState } from 'react';
import { PencilIcon, TrashIcon } from '@heroicons/react/24/outline';
import type { WorkQueue } from '@/features/admin/types/admindashboard.types';
import EditWorkQueueForm from './EditWorkQueueForm';

interface WorkQueuesTableProps {
  queues: WorkQueue[];
  roleColors: Record<string, string>;
  taskTypeColors: Record<string, string>;
  onEdit: (queue: WorkQueue) => void;
  onDelete: (queueId: string) => void;
}

const WorkQueuesTable: React.FC<WorkQueuesTableProps> = ({
  queues,
  roleColors,
  taskTypeColors,
  onEdit,
  onDelete,
}) => {
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [selectedQueue, setSelectedQueue] = useState<WorkQueue | null>(null);

  const handleEdit = (queue: WorkQueue) => {
    setSelectedQueue(queue);
    setEditModalOpen(true);
  };

  const handleDelete = (queue: WorkQueue) => {
    setSelectedQueue(queue);
    setDeleteModalOpen(true);
  };

  const confirmDelete = () => {
    if (selectedQueue) {
      onDelete(selectedQueue.id);
      setDeleteModalOpen(false);
      setSelectedQueue(null);
    }
  };
  return (
    <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Name
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Description
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Roles
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Task Types
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Task Count
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Status
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Actions
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {queues.map((queue) => (
            <tr key={queue.id} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-gray-900">{queue.name}</div>
              </td>
              <td className="px-6 py-4">
                <div className="text-sm text-gray-600 max-w-xs">{queue.description}</div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  {queue.roles.map((role) => (
                    <span
                      key={role}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        roleColors[role] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {role}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-6 py-4">
                <div className="flex flex-wrap gap-1">
                  {queue.taskTypes.map((taskType) => (
                    <span
                      key={taskType}
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        taskTypeColors[taskType] || 'bg-gray-100 text-gray-800'
                      }`}
                    >
                      {taskType}
                    </span>
                  ))}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-gray-900">
                  {queue.taskCount !== undefined ? queue.taskCount : '-'}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                  queue.status === 'Active' 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {queue.status}
                </span>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                <div className="flex items-center space-x-2">
                  <button 
                    className="text-blue-600 hover:text-blue-900 p-1 rounded"
                    onClick={() => handleEdit(queue)}>
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button 
                    className="text-red-600 hover:text-red-900 p-1 rounded"
                    onClick={() => handleDelete(queue)}>
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {editModalOpen && selectedQueue && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border max-w-4xl shadow-lg rounded-md bg-white">
            <EditWorkQueueForm
              queue={selectedQueue}
              onSave={(updatedQueue) => {
                onEdit(updatedQueue);
                setEditModalOpen(false);
              }}
              onCancel={() => setEditModalOpen(false)}
            />
          </div>
        </div>
      )}

      {deleteModalOpen && selectedQueue && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
          <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
            <div className="mt-3 text-center">
              <h3 className="text-lg leading-6 font-medium text-gray-900">Delete Work Queue</h3>
              <div className="mt-2 px-7 py-3">
                <p className="text-sm text-gray-500">
                  Are you sure you want to delete this work queue? This action cannot be undone.
                </p>
              </div>
              <div className="items-center px-4 py-3">
                <button
                  className="px-4 py-2 bg-red-500 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-600 focus:outline-none focus:ring-2 focus:ring-red-300"
                  onClick={confirmDelete}
                >
                  Delete
                </button>
                <button
                  className="ml-2 px-4 py-2 bg-gray-200 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-300"
                  onClick={() => setDeleteModalOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {queues.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No work queues found matching your search criteria.
        </div>
      )}
    </div>
  );
};

export default WorkQueuesTable;