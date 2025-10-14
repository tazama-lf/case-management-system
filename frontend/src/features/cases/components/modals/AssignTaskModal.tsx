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
        setInvestigators(data);
      } else {
        console.log('API returned empty data, using mock data');
        useMockData();
      }
    } catch (error) {
      console.error('Failed to fetch investigators:', error);
      useMockData();
    } finally {
      setLoading(false);
    }
  };

  const useMockData = () => {
    const mockInvestigators: Investigator[] = [
      { id: '1', username: 'john.smith', email: 'john.smith@example.com', firstName: 'John', lastName: 'Smith' },
      { id: '2', username: 'sarah.johnson', email: 'sarah.johnson@example.com', firstName: 'Sarah', lastName: 'Johnson' },
      { id: '3', username: 'michael.brown', email: 'michael.brown@example.com', firstName: 'Michael', lastName: 'Brown' },
      { id: '4', username: 'emily.davis', email: 'emily.davis@example.com', firstName: 'Emily', lastName: 'Davis' },
      { id: '5', username: 'david.wilson', email: 'david.wilson@example.com', firstName: 'David', lastName: 'Wilson' },
    ];
    setInvestigators(mockInvestigators);
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
                {investigators.map((investigator) => (
                  <option key={investigator.id} value={investigator.id}>
                    {investigator.firstName} {investigator.lastName} ({investigator.username})
                  </option>
                ))}
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
              onClick={() => {
                // Find the selected investigator to get their name
                const selectedInvestigator = investigators.find(inv => inv.id === assignee);
                const assigneeName = selectedInvestigator 
                  ? `${selectedInvestigator.firstName} ${selectedInvestigator.lastName}` 
                  : assignee;
                onAssign(task, assigneeName, notes);
              }}
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