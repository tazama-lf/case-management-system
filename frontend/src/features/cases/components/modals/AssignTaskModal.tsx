import type { UnifiedWorkQueueTask } from '../../../workqueue/types/flowable.types';
import React, { useEffect, useState } from 'react';
import authService from '../../../auth/services/authService';
import type { Investigator } from '../../../auth/types/auth.types';
import { useInvestigatorSupervisorList } from '../../../cases/hooks/useInvestigatorSupervisorList';

interface AssignTaskModalProps {
  open: boolean;
  onClose: () => void;
  onAssign: (
    task: UnifiedWorkQueueTask,
    assignee: string,
    notes?: string,
  ) => Promise<void>;
  task?: UnifiedWorkQueueTask | null;
}

const AssignTaskModal: React.FC<AssignTaskModalProps> = ({
  open,
  onClose,
  onAssign,
  task,
}) => {
  const [assignee, setAssignee] = React.useState('');
  const [notes, setNotes] = React.useState('');
  // const [investigators, setInvestigators] = useState<Investigator[]>([]);
  // const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [currentUserInvestigator, setCurrentUserInvestigator] = useState<Investigator | null>(null);
  const [isSupervisor, setIsSupervisor] = useState(false);

  useEffect(() => {
    setAssignee('');
    setNotes('');
  }, [task, open]);

  useEffect(() => {
    if (open) {
      const user = authService.getUser();
      const isSupervisor = user?.validatedClaims?.CMS_SUPERVISOR === true;
      setIsSupervisor(isSupervisor);

      if (isSupervisor) {
        fetchInvestigatorsList();
      }
      fetchCurrentUserAsInvestigator();
    }
  }, [open]);

  const { fetchInvestigatorsList, loadingInvestigators, investigators } = useInvestigatorSupervisorList();

  const fetchCurrentUserAsInvestigator = async () => {
    try {
      const user = authService.getUser();
      if (user && user.userId) {
        // Create an investigator object from the current user
        const investigator: Investigator = {
          id: user.userId,
          username: user.fullName || 'You',
          email: user.email || '',
          firstName: user.fullName?.split(' ')[0] || 'Current',
          lastName: user.fullName?.split(' ')[1] || 'User',
        };
        setCurrentUserInvestigator(investigator);
      }
    } catch (error) {
      console.error('Failed to fetch current user:', error);
    }
  };

  // const fetchInvestigators = async () => {
  //   setLoading(true);
  //   try {
  //     const data = await authService.fetchAllInvestigators();

  //     if (data && data.length > 0) {
  //       setInvestigators(data);
  //     }
  //   } catch (error) {
  //     console.error('Failed to fetch investigators:', error);
  //   } finally {
  //     setLoading(false);
  //   }
  // };



  const handleAssign = async () => {
    if (!canConfirm) {
      console.warn('Cannot assign task: assignee not selected');
      return;
    }

    if (!task) {
      console.warn('Cannot assign task: no task selected');
      return;
    }

    if (!task.id) {
      console.warn('Cannot assign task: task ID is missing', { task });
      return;
    }

    if (!assignee) {
      console.warn('Cannot assign task: assignee is empty');
      return;
    }

    setSubmitting(true);
    try {
      await onAssign(task, assignee, notes);

    } catch (error) {

    } finally {
      setSubmitting(false);
    }
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
              {task.status}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Assign To
            </label>
            {loadingInvestigators ? (
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
                {currentUserInvestigator && (
                  <option key={`me-${currentUserInvestigator.id}`} value={currentUserInvestigator.id}>
                    {currentUserInvestigator.firstName} {currentUserInvestigator.lastName} (Me)
                  </option>
                )}
                {isSupervisor && investigators.map((investigator) => {
                  return (
                    <option key={investigator.id} value={investigator.id}>
                      {investigator.firstName} {investigator.lastName} (
                      {investigator.name})
                    </option>
                  );
                })}
              </select>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any assignment notes or instructions..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              onClick={onClose}
              className="rounded-md border bg-white px-4 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50"
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              onClick={handleAssign}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!canConfirm || submitting}
            >
              {submitting ? 'Assigning...' : 'Assign Task'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AssignTaskModal;
