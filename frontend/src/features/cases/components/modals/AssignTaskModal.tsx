import type { UnifiedWorkQueueTask } from '../../../workqueue/types/flowable.types';
import React, { useEffect, useState } from 'react';
import authService from '../../../auth/services/authService';
import type { Investigator } from '../../../auth/types/auth.types';

interface AssignTaskModalProps {
  open: boolean;
  onClose: () => void;
  onAssign: (task: UnifiedWorkQueueTask, assignee: string, notes?: string) => void;
  task?: UnifiedWorkQueueTask | null;
}

const AssignTaskModal: React.FC<AssignTaskModalProps> = ({ open, onClose, onAssign, task }) => {
  const [assignee, setAssignee] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [investigators, setInvestigators] = useState<Investigator[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAssignee('');
    setNotes('');
  }, [task, open]);

  useEffect(() => {
    if (open) {
      console.log('AssignTaskModal opened, fetching investigators');
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

  const handleAssign = () => {
    if (!canConfirm) {
      console.warn('Cannot assign task: assignee not selected');
      return;
    }
    
    if (!task) {
      console.warn('Cannot assign task: no task selected');
      return;
    }
    
    if (!assignee) {
      console.warn('Cannot assign task: assignee is empty');
      return;
    }
    
    console.log('Assigning task:', { taskId: task.id, assignee, notes });
    onAssign(task, assignee, notes);
  };

  if (!open || !task) return null;

  const canConfirm = Boolean(assignee);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
        <div className="px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Assign Task</h3>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Current Status</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">{task.status}</div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Assign To</label>
            {loading ? (
              <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                Loading investigators...
              </div>
            ) : (
              <select
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="">Select Investigator</option>
                {investigators.map((investigator) => {
                  // Display only the assignedUserId (UUID)
                  return (
                    <option key={investigator.id} value={investigator.id}>
                      {investigator.id}
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any assignment notes or instructions..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-md border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50">Cancel</button>
            <button
              onClick={handleAssign}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              disabled={!canConfirm}
            >
              Assign Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignTaskModal;