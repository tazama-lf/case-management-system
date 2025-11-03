import type { UnifiedWorkQueueTask } from '../../../workqueue/types/flowable.types';
import React from 'react';

interface CloseTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCloseTask: (task: UnifiedWorkQueueTask, notes: string) => void;
  task?: UnifiedWorkQueueTask | null;
}

const CloseTaskModal: React.FC<CloseTaskModalProps> = ({ open, onClose, onCloseTask, task }) => {
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    setNotes('');
  }, [task, open]);

  if (!open || !task) return null;

  const canConfirm = Boolean(notes.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
        <div className="px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Close Task</h3>
          <p className="text-sm text-gray-500 mt-1">Mark this task as complete with notes</p>
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
            <label className="mb-1 block text-sm font-medium text-gray-700">Completion Notes <span className="text-red-500">*</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Provide details about the task completion, findings, or next steps..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
            {!notes.trim() && (
              <p className="mt-1 text-sm text-red-600">Completion notes are required</p>
            )}
            <p className="mt-1 text-xs text-gray-500">
              {notes.length}/1000 characters
            </p>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
            <div className="text-xs text-blue-800">
              <strong>Note:</strong> Closing this task will:
              <ul className="list-disc list-inside mt-1 space-y-1">
                <li>Mark the task as completed</li>
                <li>Record the notes in the audit trail</li>
                <li>Update the task status to "30-COMPLETED"</li>
                <li>Notify relevant stakeholders</li>
              </ul>
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button onClick={onClose} className="rounded-md border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50">Cancel</button>
            <button
              onClick={() => onCloseTask(task, notes)}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 disabled:opacity-50"
              disabled={!canConfirm}
            >
              Close Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CloseTaskModal;