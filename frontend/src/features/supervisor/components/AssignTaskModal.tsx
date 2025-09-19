import React from 'react';
import type { TaskForSupervisor } from '../services/taskService';

interface AssignTaskModalProps {
  open: boolean;
  onClose: () => void;
  onAssign: (taskId: string, assignedUserId: string) => void;
  task?: TaskForSupervisor | null;
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

  const handleAssign = () => {
    if (assignee && task) {
      onAssign(task.task_id, assignee);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Assign Task</h3>
          <p className="text-sm text-gray-600 mt-1">Assign this task to an investigator</p>
        </div>
        
        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Task ID</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900 font-mono">
              {task.task_id}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Task Name</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
              {task.name || 'Unnamed Task'}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Current Status</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
              {task.status}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Current Assignee</label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
              {task.assignedUser?.username || 'Unassigned'}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Investigator User ID <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={assignee}
              onChange={(e) => setAssignee(e.target.value)}
              placeholder="Enter investigator user ID"
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            <p className="mt-1 text-xs text-gray-500">
              Enter the exact user ID of the investigator to assign this task to
            </p>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Assignment Notes (Optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any notes or instructions for the assignee..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button 
            onClick={onClose} 
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!canConfirm}
          >
            Assign Task
          </button>
        </div>
      </div>
    </div>
  );
};

export default AssignTaskModal;
