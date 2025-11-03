import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { WorkQueue } from '../types/admindashboard.types';

interface CreateWorkQueueModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (workQueue: Omit<WorkQueue, 'id'>) => void;
}

const CreateWorkQueueModal: React.FC<CreateWorkQueueModalProps> = ({
  isOpen,
  onClose,
  onSave,
}) => {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    status: 'Active' as 'Active' | 'Inactive',
    assignedRoles: [] as string[],
    taskTypes: [] as string[],
    caseTypes: [] as string[],
    caseStatuses: [] as string[],
  });

  const availableRoles = [
    'Supervisor',
    'Manager', 
    'Fraud Analyst',
    'Investigator',
    'AML Specialist',
    'Senior Analyst',
    'Team Lead'
  ];

  const availableTaskTypes = [
    'New Case',
    'Reopened Case',
    'Fraud Alert',
    'AML Alert',
    'Customer Complaint',
    'Case Approval',
    'Reopening Request',
    'Investigation Review'
  ];

  const availableCaseTypes = [
    'Fraud Investigation',
    'AML Investigation',
    'Customer Dispute',
    'Transaction Review',
    'Account Review',
    'Compliance Check'
  ];

  const availableCaseStatuses = [
    'New',
    'In Progress',
    'Under Review',
    'Pending Approval',
    'Closed',
    'Reopened',
    'Escalated'
  ];

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleMultiSelectChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field as keyof typeof prev].includes(value)
        ? (prev[field as keyof typeof prev] as string[]).filter(item => item !== value)
        : [...(prev[field as keyof typeof prev] as string[]), value]
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name: formData.name,
      description: formData.description,
      status: formData.status,
      roles: formData.assignedRoles,
      taskTypes: formData.taskTypes
    });
    
    setFormData({
      name: '',
      description: '',
      status: 'Active',
      assignedRoles: [],
      taskTypes: [],
      caseTypes: [],
      caseStatuses: [],
    });
  };

  const handleCancel = () => {
    setFormData({
      name: '',
      description: '',
      status: 'Active',
      assignedRoles: [],
      taskTypes: [],
      caseTypes: [],
      caseStatuses: [],
    });
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20">
        {/* Background overlay */}
        <div 
          className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        ></div>

        {/* Modal */}
        <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all w-full max-w-2xl mx-auto z-10">
          {/* Header */}
          <div className="bg-white px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Create Work Queue</h3>
                <p className="text-sm text-gray-500">Configure a new work queue</p>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 focus:outline-none"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="bg-white px-6 py-4 space-y-6">
            {/* Basic Information */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-4">Basic Information</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Queue Name*
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter queue name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Status
                  </label>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange('status', e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                  </select>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  rows={3}
                  className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Enter queue description"
                />
              </div>
            </div>

            {/* Role Assignment */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-2">Role Assignment</h4>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assigned Roles*
                </label>
                <p className="text-xs text-gray-500 mb-2">No roles assigned</p>
              </div>
              <div className="border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
                {availableRoles.map((role) => (
                  <label key={role} className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={formData.assignedRoles.includes(role)}
                      onChange={() => handleMultiSelectChange('assignedRoles', role)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{role}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Task Types */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-2">Task Types</h4>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Task Types*
                </label>
                <p className="text-xs text-gray-500 mb-2">No task type selected</p>
              </div>
              <div className="border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
                {availableTaskTypes.map((taskType) => (
                  <label key={taskType} className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={formData.taskTypes.includes(taskType)}
                      onChange={() => handleMultiSelectChange('taskTypes', taskType)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{taskType}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Case Types */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-2">Case Types</h4>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Case Types*
                </label>
                <p className="text-xs text-gray-500 mb-2">No case type selected</p>
              </div>
              <div className="border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
                {availableCaseTypes.map((caseType) => (
                  <label key={caseType} className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={formData.caseTypes.includes(caseType)}
                      onChange={() => handleMultiSelectChange('caseTypes', caseType)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{caseType}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Case Statuses */}
            <div>
              <h4 className="text-md font-medium text-gray-900 mb-2">Case Statuses</h4>
              <div className="mb-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Case Statuses*
                </label>
                <p className="text-xs text-gray-500 mb-2">No statuses selected</p>
              </div>
              <div className="border border-gray-300 rounded-md p-3 max-h-32 overflow-y-auto">
                {availableCaseStatuses.map((status) => (
                  <label key={status} className="flex items-center space-x-2 mb-2">
                    <input
                      type="checkbox"
                      checked={formData.caseStatuses.includes(status)}
                      onChange={() => handleMultiSelectChange('caseStatuses', status)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="text-sm text-gray-700">{status}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="bg-gray-50 px-6 py-3 flex justify-end space-x-3 -mx-6 -mb-4 mt-6">
              <button
                type="button"
                onClick={handleCancel}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                Create Work Queue
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateWorkQueueModal;
