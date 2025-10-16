import React, { useState } from 'react';
import { UserMinusIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { UnifiedWorkQueueTask } from '../../../workqueue/types/flowable.types';

interface UnassignTaskModalProps {
  open: boolean;
  onClose: () => void;
  onUnassign: (taskId: string, reason: string) => void;
  task?: UnifiedWorkQueueTask | null;
}

const UnassignTaskModal: React.FC<UnassignTaskModalProps> = ({
  open,
  onClose,
  onUnassign,
  task
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!task || !reason.trim()) return;

    setIsSubmitting(true);
    try {
      await onUnassign(task.id, reason.trim());
      setReason('');
      onClose();
    } catch (error) {
      console.error('Failed to unassign task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason('');
      onClose();
    }
  };

  if (!open || !task) return null;

  const canSubmit = reason.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100">
              <UserMinusIcon className="h-5 w-5 text-orange-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Unassign Task
              </h3>
              <p className="text-sm text-gray-600">
                Task ID: {task.id}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-4">
          <div className="mb-4">
            <div className="bg-gray-50 border border-gray-200 rounded-md p-3 mb-4">
              <div className="text-sm">
                <div className="font-medium text-gray-900 mb-1">Task Details:</div>
                <div className="text-gray-700">
                  <div><strong>Name:</strong> {task.name}</div>
                  <div><strong>Current Assignee:</strong> {task.assigneeName || task.assignee || 'Unassigned'}</div>
                  <div><strong>Status:</strong> {task.status}</div>
                </div>
              </div>
            </div>
          </div>

          <p className="text-sm text-gray-700 mb-4">
            This task will be unassigned and returned to the work queue. The current assignee will be notified of the unassignment.
          </p>
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <div className="text-sm text-blue-800">
              <strong>Workflow:</strong> Upon unassignment:
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Task status will change to "UNASSIGNED"</li>
                <li>Ownership will be removed from the task</li>
                <li>Task will remain available in the candidate group/work queue</li>
                <li>Action will be logged in the audit trail</li>
              </ul>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for unassignment <span className="text-red-500">*</span>
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500"
                placeholder="Explain why this task is being unassigned (e.g., workload redistribution, skill mismatch, etc.)"
              />
              {reason.trim().length === 0 && (
                <p className="text-xs text-gray-500 mt-1">
                  A reason is required for audit logging and notification purposes.
                </p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !canSubmit}
                className="px-4 py-2 text-sm font-medium text-white bg-orange-600 border border-transparent rounded-md hover:bg-orange-700 focus:outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Unassigning...' : 'Unassign Task'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UnassignTaskModal;