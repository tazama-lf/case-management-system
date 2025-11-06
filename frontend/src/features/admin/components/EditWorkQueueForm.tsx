import React, { useState } from 'react';
import type { WorkQueue } from '@/features/admin/types/admindashboard.types';

interface EditWorkQueueFormProps {
  queue: WorkQueue;
  onSave: (updatedQueue: WorkQueue) => void;
  onCancel: () => void;
}

const EditWorkQueueForm: React.FC<EditWorkQueueFormProps> = ({
  queue,
  onSave,
  onCancel,
}) => {
  const [formData, setFormData] = useState<WorkQueue>({
    ...queue,
    caseStatuses: queue.caseStatuses || [],
    caseTypes: queue.caseTypes || [],
    roles: queue.roles || [], 
    taskTypes: queue.taskTypes || [], 
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  const handleRoleAdd = (role: string) => {
    if (!formData.roles.includes(role)) {
      setFormData({ ...formData, roles: [...formData.roles, role] });
    }
  };

  const handleTaskTypeAdd = (taskType: string) => {
    if (!formData.taskTypes.includes(taskType)) {
      setFormData({ ...formData, taskTypes: [...formData.taskTypes, taskType] });
    }
};

  // const handleCaseTypeAdd = (caseType: string) => {
  //   if (!formData.caseTypes.includes(caseType)) {
  //     setFormData({ ...formData, caseTypes: [...formData.caseTypes, caseType] });
  //   }
  // };

  // const handleCaseStatusesAdd = (caseStatuses: string) => {
  //   if (!formData.caseStatuses.includes(caseStatuses)) {
  //     setFormData({ ...formData, caseStatuses: [...formData.caseStatuses, caseStatuses] });
  //   }
  // };

  return (
    <form onSubmit={handleSubmit} className="space-y-6 p-6">
      <div className="flex items-center justify-between border-b pb-4">
        <h2 className="text-lg font-semibold">Update work queue properties</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-gray-500 hover:text-gray-700"
        >
          ← Back to Work Queues
        </button>
      </div>

      {/* Basic Information */}
      <section>
        <h3 className="text-md font-medium mb-4">Basic Information</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Queue Name
            </label>
            <input
              type="text"
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">
              Description
            </label>
            <textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              rows={2}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as 'Active' | 'Inactive' })}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
        </div>
      </section>

      {/* Role Assignment */}
      <section>
        <h3 className="text-md font-medium mb-4">Role Assignment</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Assigned Roles*
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.roles.map((role) => (
              <span
                key={role}
                className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
              >
                {role}
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    roles: formData.roles.filter(r => r !== role)
                  })}
                  className="ml-1 text-blue-600 hover:text-blue-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              onChange={(e) => handleRoleAdd(e.target.value)}
              value=""
            >
              <option value="">Select a role to add...</option>
              <option value="AML Specialist">AML Specialist</option>
              <option value="Compliance Officer">Compliance Officer</option>
            </select>
            <button
              type="button"
              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              +
            </button>
          </div>
        </div>
      </section>

      {/* Task Types */}
      <section>
        <h3 className="text-md font-medium mb-4">Task Types</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Task Types*
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.taskTypes.map((type) => (
              <span
                key={type}
                className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-purple-100 text-purple-800"
              >
                {type}
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    taskTypes: formData.taskTypes.filter(t => t !== type)
                  })}
                  className="ml-1 text-purple-600 hover:text-purple-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              onChange={(e) => handleTaskTypeAdd(e.target.value)}
              value=""
            >
              <option value="">Select a task type to add...</option>
              <option value="AML Alert">AML Alert</option>
              <option value="Transaction Review">Transaction Review</option>
            </select>
            <button
              type="button"
              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              +
            </button>
          </div>
        </div>
      </section>

      {/* Case Types */}
      {/* <section>
        <h3 className="text-md font-medium mb-4">Case Types</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Case Types*
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.caseTypes.map((type) => (
              <span
                key={type}
                className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-green-100 text-green-800"
              >
                {type}
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    caseTypes: formData.caseTypes.filter(t => t !== type)
                  })}
                  className="ml-1 text-green-600 hover:text-green-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              onChange={(e) => handleCaseTypeAdd(e.target.value)}
              value=""
            >
              <option value="">Select a case type to add...</option>
              <option value="AML Investigation">AML Investigation</option>
              <option value="KYC Review">KYC Review</option>
              <option value="Customer Dispute">Customer Dispute</option>
              <option value="Transaction Monitoring">Transaction Monitoring</option>
              <option value="Identity Theft">Identity Theft</option>
              <option value="Regulatory Compliance">Regulatory Compliance</option>
              <option value="Internal Review">Internal Review</option>
            </select>
            <button
              type="button"
              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              +
            </button>
          </div>
        </div>
      </section> */}

      {/* Case Statuses */}
      {/* <section>
        <h3 className="text-md font-medium mb-4">Case Statuses</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Case Statuses*
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {formData.caseStatuses.map((type) => (
              <span
                key={type}
                className="inline-flex items-center px-2 py-1 rounded-full text-sm bg-orange-100 text-orange-800"
              >
                {type}
                <button
                  type="button"
                  onClick={() => setFormData({
                    ...formData,
                    caseStatuses: formData.caseStatuses.filter(t => t !== type)
                  })}
                  className="ml-1 text-orange-600 hover:text-orange-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <select
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              onChange={(e) => handleCaseStatusesAdd(e.target.value)}
              value=""
            >
              <option value="">Select status to add...</option>
              <option value="Pending">Pending</option>
              <option value="Pending Review">Pending Review</option>
              <option value="On Hold">On Hold</option>
              <option value="Escalated">Escalated</option>
              <option value="Resolved">Resolved</option>
              <option value="Closed">Closed</option>
              <option value="Cancelled">Cancelled</option>
            </select>
            <button
              type="button"
              className="px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600"
            >
              +
            </button>
          </div>
        </div>
      </section> */}

      {/* Bottom Buttons */}
      <div className="flex justify-end gap-2 pt-6 border-t">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
        >
          Save Changes
        </button>
      </div>
    </form>
  );
};

export default EditWorkQueueForm;