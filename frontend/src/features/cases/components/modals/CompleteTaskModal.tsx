import type { UnifiedWorkQueueTask } from '../../../workqueue/types/flowable.types';
import React from 'react';
import { CheckIcon } from '@heroicons/react/24/outline';

interface CompleteTaskModalProps {
  open: boolean;
  onClose: () => void;
  onCompleteTask: (task: UnifiedWorkQueueTask, notes?: string) => void;
  task?: UnifiedWorkQueueTask | null;
  loading?: boolean;
}

const CompleteTaskModal: React.FC<CompleteTaskModalProps> = ({
  open,
  onClose,
  onCompleteTask,
  task,
  loading = false,
}) => {
  const [notes, setNotes] = React.useState('');

  React.useEffect(() => {
    setNotes('');
  }, [task, open]);

  if (!open || !task) return null;

  const handleComplete = () => {
    onCompleteTask(task, notes || undefined);
    setNotes('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <CheckIcon className="h-6 w-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">
              Complete Task
            </h3>
          </div>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Task ID
            </label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
              {task.id}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Task Name
            </label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
              {task.name}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Current Status
            </label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
              <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ring-1 ring-gray-200">
                {task.status}
              </span>
            </div>
          </div>

          <div className="rounded-md bg-green-50 p-3">
            <div className="text-sm text-green-800">
              <strong>Action:</strong> This task will be marked as{' '}
              <strong>Complete</strong>.
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Completion Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about the task completion..."
              rows={4}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={loading}
              className="rounded-md border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleComplete}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckIcon className="h-4 w-4" />
              Complete Task
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompleteTaskModal;
