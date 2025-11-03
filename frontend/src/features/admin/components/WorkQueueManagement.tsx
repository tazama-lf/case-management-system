import React, { useState, Suspense, lazy } from 'react';
import { PageContainer } from '@/shared/components/ui';
import { MagnifyingGlassIcon, FunnelIcon, PlusIcon, PencilIcon, TrashIcon, ArrowLeftIcon } from '@heroicons/react/24/outline';
import type { WorkQueue } from '@/features/admin/types/admindashboard.types';
const CreateWorkQueueModal = lazy(() => import('./CreateWorkQueueModal'));

interface WorkQueueManagementProps {
  className?: string;
  onNavigateBack?: () => void;
}

const WorkQueueManagement: React.FC<WorkQueueManagementProps> = ({ className = '', onNavigateBack }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Status');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  
  const initialWorkQueues: WorkQueue[] = [
    {
      id: '1',
      name: 'Unassigned Cases Queue',
      description: 'For cases that have not been assigned to an analyst',
      roles: ['Supervisor', 'Manager'],
      taskTypes: ['New Case', 'Reopened Case'],
      status: 'Active'
    },
    {
      id: '2',
      name: 'Investigations Work Queue',
      description: 'For active investigations in progress',
      roles: ['Fraud Analyst', 'Investigator', 'AML Specialist'],
      taskTypes: ['Fraud Alert', 'AML Alert', 'Customer Complaint'],
      status: 'Active'
    },
    {
      id: '3',
      name: 'Supervisor Work Queue',
      description: 'For cases requiring supervisor approval',
      roles: ['Supervisor', 'Manager'],
      taskTypes: ['Case Approval', 'Reopening Request'],
      status: 'Active'
    },
    {
      id: '4',
      name: 'Completed Work Queue',
      description: 'For closed and completed cases',
      roles: ['Fraud Analyst', 'Investigator', 'Supervisor'],
      taskTypes: ['Closed Case', 'Archived Case'],
      status: 'Active'
    }
  ];

  const [workQueues, setWorkQueues] = useState<WorkQueue[]>(initialWorkQueues);

  const handleCreateWorkQueue = (newWorkQueue: Omit<WorkQueue, 'id'>) => {
    const workQueueWithId: WorkQueue = {
      ...newWorkQueue,
      id: Date.now().toString(),
    };
    setWorkQueues(prev => [...prev, workQueueWithId]);
    setIsCreateModalOpen(false);
  };

  const roleColors: Record<string, string> = {
    'Supervisor': 'bg-blue-100 text-blue-800',
    'Manager': 'bg-green-100 text-green-800',
    'Fraud Analyst': 'bg-purple-100 text-purple-800',
    'Investigator': 'bg-orange-100 text-orange-800',
    'AML Specialist': 'bg-indigo-100 text-indigo-800'
  };

  const taskTypeColors: Record<string, string> = {
    'New Case': 'bg-blue-100 text-blue-800',
    'Reopened Case': 'bg-red-100 text-red-800',
    'Fraud Alert': 'bg-purple-100 text-purple-800',
    'AML Alert': 'bg-orange-100 text-orange-800',
    'Customer Complaint': 'bg-green-100 text-green-800',
    'Case Approval': 'bg-blue-100 text-blue-800',
    'Reopening Request': 'bg-yellow-100 text-yellow-800',
    'Closed Case': 'bg-gray-100 text-gray-800',
    'Archived Case': 'bg-gray-100 text-gray-800'
  };

  const filteredQueues = workQueues.filter(queue => {
    const matchesSearch = queue.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         queue.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'All Status' || queue.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <PageContainer
      subtitle="Manage work queues for different user groups"
      className={className}
    >
      {}
      <div className="flex justify-between items-center mb-6">
        {onNavigateBack && (
          <div className="absolute top-6 right-6">
            <button
              onClick={onNavigateBack}
              className="flex items-center px-3 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
            >
              <ArrowLeftIcon className="h-4 w-4 mr-2" />
              Back to Dashboard
            </button>
          </div>
        )}
        <div className="flex items-center space-x-4">
          {}
          <div className="relative">
            <MagnifyingGlassIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search work queues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-64"
            />
          </div>

          {}
          <div className="relative">
            <FunnelIcon className="h-5 w-5 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="pl-10 pr-8 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 appearance-none bg-white"
            >
              <option value="All Status">All Status</option>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>

        {}
        <button 
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        >
          <PlusIcon className="h-4 w-4 mr-2" />
          Create Work Queue
        </button>
      </div>

      {}
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
                Status
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {filteredQueues.map((queue) => (
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
                    <button className="text-blue-600 hover:text-blue-900 p-1 rounded">
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button className="text-red-600 hover:text-red-900 p-1 rounded">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {filteredQueues.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            No work queues found matching your search criteria.
          </div>
        )}
      </div>

      {}
      <Suspense fallback={<div>Loading modal...</div>}>
        <CreateWorkQueueModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSave={handleCreateWorkQueue}
        />
      </Suspense>
    </PageContainer>
  );
};

export default WorkQueueManagement;
