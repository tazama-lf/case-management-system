import type { UnifiedWorkQueueTask } from '../../../workqueue/types/flowable.types';
import React, { useEffect, useState } from 'react';
import authService from '../../../auth/services/authService';
import type { Investigator } from '../../../auth/types/auth.types';

interface ReassignTaskModalProps {
  open: boolean;
  onClose: () => void;
  onReassign: (task: UnifiedWorkQueueTask, assignee: string, justification: string) => void;
  task?: UnifiedWorkQueueTask | null;
}

const ReassignTaskModal: React.FC<ReassignTaskModalProps> = ({ open, onClose, onReassign, task }) => {
  const [assignee, setAssignee] = React.useState('');
  const [justification, setJustification] = React.useState('');
  const [investigators, setInvestigators] = useState<Investigator[]>([]);
  const [loading, setLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setAssignee('');
    setJustification('');
  }, [task, open]);

  useEffect(() => {
    if (open) {
      console.log('ReassignTaskModal opened, fetching investigators');
      fetchInvestigators();
    }
  }, [open]);

  const fetchInvestigators = async () => {
    setLoading(true);
    try {
      const data = await authService.fetchAllInvestigators();
      console.log('Fetched investigators from API:', data);
      
      // Use API data if it's not empty, otherwise use mock data
      if (data && data.length > 0) {
        console.log('Using API data for investigators');
        setInvestigators(data);
      } else {
        console.log('API returned empty data, using mock data');
        useMockData();
      }
    } catch (error) {
      console.error('Failed to fetch investigators:', error);
      console.log('Using mock data due to API error');
      useMockData();
    } finally {
      setLoading(false);
    }
  };

  const useMockData = () => {
    // Using the specific UUID provided by the user for testing
    const mockInvestigators: Investigator[] = [
      { id: '0e6d70a0-7e4c-41c4-bdd1-50336ea6020f', username: 'john.smith', email: 'john.smith@example.com', firstName: 'John', lastName: 'Smith' },
      { id: '1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d', username: 'jane.doe', email: 'jane.doe@example.com', firstName: 'Jane', lastName: 'Doe' },
      { id: '2b3c4d5e-6f7a-8b9c-0d1e-2f3a4b5c6d7e', username: 'bob.wilson', email: 'bob.wilson@example.com', firstName: 'Bob', lastName: 'Wilson' },
      { id: '3c4d5e6f-7a8b-9c0d-1e2f-3a4b5c6d7e8f', username: 'alice.johnson', email: 'alice.johnson@example.com', firstName: 'Alice', lastName: 'Johnson' },
    ];
    console.log('Setting mock investigators:', mockInvestigators);
    setInvestigators(mockInvestigators);
  };

  if (!open || !task) return null;

  const canConfirm = Boolean(assignee && justification.trim());
  console.log('ReassignTaskModal canConfirm:', canConfirm, 'assignee:', assignee, 'justification:', justification);

  const handleSubmit = async () => {
    if (!canConfirm || isSubmitting) {
      console.warn('Cannot reassign task: form not valid or already submitting');
      return;
    }
    
    if (!task) {
      console.warn('Cannot reassign task: no task selected');
      return;
    }
    
    if (!assignee) {
      console.warn('Cannot reassign task: assignee is empty');
      return;
    }
    
    if (!justification.trim()) {
      console.warn('Cannot reassign task: justification is empty');
      return;
    }
    
    setIsSubmitting(true);
    try {
      console.log('Reassigning task:', { taskId: task.id, assignee, justification });
      console.log('Calling onReassign callback with:', { task, assignee, justification });
      onReassign(task, assignee, justification);
    } catch (error) {
      console.error('Failed to reassign task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
        <div className="px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Reassign Task</h3>
        </div>
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Task ID</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">{task.id}</div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Task Name</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">{task.name}</div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Current Assignee</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
              {task.assigneeName && task.assignee ? (
                `${task.assigneeName} (${task.assignee})`
              ) : task.assigneeName || task.assignee || 'Unassigned'}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Reassign To</label>
            {loading ? (
              <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                Loading investigators...
              </div>
            ) : (
              <>
                {investigators.filter(investigator => investigator.id !== task.assignee).length > 0 ? (
                  <select
                    value={assignee}
                    onChange={(e) => {
                      console.log('Assignee selected:', e.target.value);
                      setAssignee(e.target.value);
                    }}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    disabled={isSubmitting}
                  >
                    <option value="">Select Investigator</option>
                    {investigators
                      .filter(investigator => investigator.id !== task.assignee) // Don't show current assignee in the list
                      .map((investigator) => {
                        console.log('Rendering investigator option:', investigator);
                        // Display only the assignedUserId (UUID)
                        return (
                          <option key={investigator.id} value={investigator.id}>
                            {investigator.id}
                          </option>
                        );
                      })}
                  </select>
                ) : (
                  <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                    No other investigators available for reassignment
                  </div>
                )}
              </>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Justification <span className="text-red-500">*</span>
            </label>
            <textarea
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              rows={4}
              placeholder="Provide a reason for reassigning this task..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              This justification will be recorded in the audit log and sent to both users.
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> Upon reassignment:
            </p>
            <ul className="list-disc list-inside mt-1 space-y-1 text-xs text-blue-800">
              <li>The task will be assigned to the selected user</li>
              <li>Task status will be updated to "10-ASSIGNED"</li>
              <li>Both the original and new assignee will be notified</li>
              <li>The reassignment will be logged in the audit trail</li>
            </ul>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button 
              onClick={onClose} 
              className="rounded-md border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
              disabled={isSubmitting}
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              disabled={!canConfirm || isSubmitting}
            >
              {isSubmitting ? 'Reassigning...' : 'Confirm Reassignment'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReassignTaskModal;