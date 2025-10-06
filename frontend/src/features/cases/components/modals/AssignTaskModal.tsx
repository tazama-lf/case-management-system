import React from 'react';
import type { TaskRow } from '../view/TasksTable';

interface AssignTaskModalProps {
  open: boolean;
  onClose: () => void;
  onAssign: (task: TaskRow, assignee: string, notes?: string) => void;
  task?: TaskRow | null;
}

const AssignTaskModal: React.FC<AssignTaskModalProps> = ({ open, onClose, onAssign, task }) => {
  const [assignee, setAssignee] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    setAssignee('');
    setNotes('');
  }, [task, open]);

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
            <select
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select Investigator</option>
              <option value="John Smith">John Smith</option>
              <option value="Sarah Johnson">Sarah Johnson</option>
              <option value="Michael Brown">Michael Brown</option>
              <option value="Emily Davis">Emily Davis</option>
              <option value="David Wilson">David Wilson</option>
            </select>
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
              onClick={() => onAssign(task, assignee, notes)}
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
