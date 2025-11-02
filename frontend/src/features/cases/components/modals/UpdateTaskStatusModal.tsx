import type { UnifiedWorkQueueTask } from '../../../workqueue/types/flowable.types';
import React from 'react';


interface UpdateTaskStatusModalProps {
  open: boolean;
  onClose: () => void;
  onUpdateStatus: (task: UnifiedWorkQueueTask, newStatus: string, notes?: string) => void;
  task?: UnifiedWorkQueueTask | null;
}

const UpdateTaskStatusModal: React.FC<UpdateTaskStatusModalProps> = ({ open, onClose, onUpdateStatus, task }) => {
  const [newStatus, setNewStatus] = React.useState('');
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    setNewStatus('');
    setNotes('');
  }, [task, open]);

  if (!open || !task) return null;

  const canConfirm = Boolean(newStatus && newStatus !== task.status);

  const statusOptions = [
    { value: 'Unassigned', label: 'Unassigned', color: 'text-blue-700' },
    { value: 'Assigned', label: 'Assigned', color: 'text-gray-700' },
    { value: 'In Progress', label: 'In Progress', color: 'text-yellow-700' },
    { value: 'Blocked', label: 'Blocked', color: 'text-red-700' },
    { value: 'Complete', label: 'Complete', color: 'text-green-700' },
  ];

  const getStatusDescription = (status: string) => {
    const descriptions = {
      'Unassigned': 'Task is available for assignment',
      'Assigned': 'Task has been assigned but not started',
      'In Progress': 'Task is actively being worked on',
      'Blocked': 'Task is blocked and cannot proceed',
      'Complete': 'Task has been completed successfully',
    };
    return descriptions[status as keyof typeof descriptions] || '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
        <div className="px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Update Task Status</h3>
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
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
              <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-gray-200">
                {task.status}
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">New Status</label>
            <select
              value={newStatus}
              onChange={(e) => setNewStatus(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">Select New Status</option>
              {statusOptions.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={option.value === task.status}
                >
                  {option.label} {option.value === task.status ? '(Current)' : ''}
                </option>
              ))}
            </select>
            {newStatus && (
              <div className="mt-1 text-xs text-gray-600">
                {getStatusDescription(newStatus)}
              </div>
            )}
          </div>

          {newStatus === 'Blocked' && (
            <div className="rounded-md bg-red-50 p-3">
              <div className="text-sm text-red-800">
                <strong>Note:</strong> Blocking this task will prevent further progress. Please provide detailed notes about the blocking issue.
              </div>
            </div>
          )}

          {newStatus === 'Complete' && (
            <div className="rounded-md bg-green-50 p-3">
              <div className="text-sm text-green-800">
                <strong>Note:</strong> Marking this task as complete will close it. Consider using the "Close Task" action for more detailed completion tracking.
              </div>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-md border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50">Cancel</button>
            <button
              onClick={() => onUpdateStatus(task, newStatus, notes || undefined)}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
              disabled={!canConfirm}
            >
              Update Status
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default UpdateTaskStatusModal;