import type { UnifiedWorkQueueTask } from '../../../workqueue/types/flowable.types';
import React, { useEffect, useState } from 'react';
import authService from '../../../auth/services/authService';
import type { Investigator } from '../../../auth/types/auth.types';

interface ReassignTaskModalProps {
  open: boolean;
  onClose: () => void;
  onReassign: (
    task: UnifiedWorkQueueTask,
    assignee: string,
    justification: string,
  ) => void | Promise<void>;
  task?: UnifiedWorkQueueTask | null;
}

const ReassignTaskModal: React.FC<ReassignTaskModalProps> = ({
  open,
  onClose,
  onReassign,
  task,
}) => {
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
      fetchInvestigators();
    }
  }, [open]);

  const fetchInvestigators = async () => {
    setLoading(true);
    try {
      const data = await authService.fetchAllInvestigators();

      if (data && data.length > 0) {
        setInvestigators(data);
      } else {
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
      {
        id: 'c0eb00c7-6f7c-444c-ab74-1c4223dbee02',
        username: 'cms_investigator_1',
        email: 'investigator1@example.com',
        firstName: 'John',
        lastName: 'Smith',
      },
      {
        id: 'd9c5a0a0-1395-4d81-ba8f-99efaa7dfaf5',
        username: 'cms_investigator_2',
        email: 'investigator2@example.com',
        firstName: 'Jane',
        lastName: 'Doe',
      },
      {
        id: '875e1911-fe1b-451d-877f-4f771ef85f58',
        username: 'cms_investigator_3',
        email: 'investigator3@example.com',
        firstName: 'Bob',
        lastName: 'Wilson',
      },
      {
        id: '36febe5b-49fe-4abd-b294-f7afc995574e',
        username: 'cms_investigator_4',
        email: 'investigator4@example.com',
        firstName: 'Alice',
        lastName: 'Johnson',
      },
      {
        id: 'acf06a8d-8cd1-4285-97a8-c4d16f7c8348',
        username: 'cms_investigator_5',
        email: 'investigator5@example.com',
        firstName: 'Charlie',
        lastName: 'Brown',
      },
    ];
    setInvestigators(mockInvestigators);
  };

  if (!open || !task) return null;

  const canConfirm = Boolean(assignee && justification.trim());

  const handleSubmit = async () => {
    if (!canConfirm || isSubmitting) {
      console.warn(
        'Cannot reassign task: form not valid or already submitting',
      );
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
      await Promise.resolve(onReassign(task, assignee, justification));
      onClose();
    } catch (error) {
      console.error('Failed to reassign task:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-lg max-h-[85vh] flex flex-col relative">
        <div className="px-6 py-4">
          <h3 className="text-lg font-semibold text-gray-900">Reassign Task</h3>
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
              Current Assignee
            </label>
            <div className="rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-900">
              {task.assigneeName && task.assignee
                ? `${task.assigneeName} (${task.assignee})`
                : task.assigneeName || task.assignee || 'Unassigned'}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Reassign To
            </label>
            {loading ? (
              <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                Loading investigators...
              </div>
            ) : (
              <>
                {investigators.filter(
                  (investigator) => investigator.id !== task.assignee,
                ).length > 0 ? (
                  <select
                    value={assignee}
                    onChange={(e) => {
                      setAssignee(e.target.value);
                    }}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    disabled={isSubmitting}
                  >
                    <option value="">Select Investigator</option>
                    {investigators
                      .filter(
                        (investigator) => investigator.id !== task.assignee,
                      )
                      .map((investigator) => {
                        return (
                          <option key={investigator.id} value={investigator.id}>
                            {investigator.firstName} {investigator.lastName} (
                            {investigator.username})
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
              This justification will be recorded in the audit log and sent to
              both users.
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
              {isSubmitting ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/80 border-t-transparent rounded-full animate-spin" />
                  Reassigning...
                </span>
              ) : (
                'Confirm Reassignment'
              )}
            </button>
          </div>
        </div>
        {isSubmitting && (
          <div className="absolute inset-0 bg-white/60 flex items-center justify-center rounded-lg">
            <div className="flex items-center gap-3 text-indigo-700">
              <span className="h-5 w-5 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium">Reassigning task...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReassignTaskModal;
