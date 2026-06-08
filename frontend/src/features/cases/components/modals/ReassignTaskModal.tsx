import type { UnifiedWorkQueueTask } from '../../types/task.types';
import React, { useEffect, useState } from 'react';
import { useInvestigatorSupervisorList } from '../../../cases/hooks/useInvestigatorSupervisorList';
import type { User } from '../../../auth/types/auth.types';
import { useAuth } from '@/features/auth';
import authService from '../../../auth/services/authService';
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { hasComplianceOfficerRole } = useAuth();
  const {
    fetchInvestigatorsList,
    loadingInvestigators,
    investigators,
    fetchComplianceOfficersList,
    complianceOfficers,
    supervisors,
  } = useInvestigatorSupervisorList();
  const [currentUserInvestigator, setCurrentUserInvestigator] =
    useState<User | null>(null);

  useEffect(() => {
    setAssignee('');
    setJustification('');
  }, [task, open]);

  useEffect(() => {
    if (open) {
      const user = authService.getUser();
      setCurrentUserInvestigator(user);
      if (task?.name.toLowerCase().includes('sar')) {
        if (hasComplianceOfficerRole()) {
          if (complianceOfficers.length === 0) {
            fetchComplianceOfficersList();
          }
        }
      } else {
        fetchInvestigatorsList();
      }
    }
  }, [open]);

  const getAssigneeFullName = (assigneeName: string, assignee?: string) => {
    const compliance = complianceOfficers.find(
      (i) => i.id === assigneeName || i.id === assignee,
    );
    if (compliance) return `${compliance.firstName} ${compliance.lastName}`;

    const inv = investigators.find(
      (i) => i.id === assigneeName || i.id === assignee,
    );
    if (inv) return `${inv.firstName} ${inv.lastName}`;

    const sup = supervisors.find(
      (i) => i.id === assigneeName || i.id === assignee,
    );
    if (sup) return `${sup.firstName} ${sup.lastName}`;

    return assigneeName ?? assignee;
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
                ? `${getAssigneeFullName(task.assigneeName, task.assignee)} (${task.assignee})`
                : (task.assigneeName ?? task.assignee ?? 'Unassigned')}
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Reassign To
            </label>
            {loadingInvestigators ? (
              <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                Loading investigators...
              </div>
            ) : (
              <>
                {(() => {
                  const isSarTask = task?.name.toLowerCase().includes('sar');
                  const optionsList = isSarTask
                    ? complianceOfficers
                    : investigators;

                  const filteredList = optionsList.filter(
                    (user) =>
                      user.id !== task.assignee &&
                      user.id !== currentUserInvestigator?.userId,
                  );

                  const canAssignToSelf =
                    currentUserInvestigator?.userId !== task.assignee;

                  if (filteredList.length === 0 && !canAssignToSelf) {
                    return (
                      <div className="rounded-md border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-gray-500">
                        No other{' '}
                        {isSarTask ? 'compliance officers' : 'investigators'}{' '}
                        available for reassignment
                      </div>
                    );
                  }

                  return (
                    <select
                      value={assignee}
                      onChange={(e) => {
                        setAssignee(e.target.value);
                      }}
                      className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      disabled={isSubmitting}
                    >
                      <option value="">
                        Select{' '}
                        {isSarTask ? 'Compliance Officer' : 'Investigator'}
                      </option>

                      {canAssignToSelf && currentUserInvestigator && (
                        <option
                          key={`me-${currentUserInvestigator.userId}`}
                          value={currentUserInvestigator.userId}
                        >
                          {currentUserInvestigator.fullName} (Me)
                        </option>
                      )}

                      {isSarTask
                        ? filteredList.map((co) => (
                            <option key={co.id} value={co.id}>
                              {co.firstName} {co.lastName} ({co.name})
                            </option>
                          ))
                        : filteredList.map((investigator) => (
                            <option
                              key={investigator.id}
                              value={investigator.id}
                            >
                              {investigator.firstName} {investigator.lastName} (
                              {investigator.name})
                            </option>
                          ))}
                    </select>
                  );
                })()}
              </>
            )}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              Note <span className="text-red-500">*</span>
            </label>
            <textarea
              value={justification}
              onChange={(e) => {
                setJustification(e.target.value);
              }}
              rows={4}
              placeholder="Provide a reason for reassigning this task..."
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              disabled={isSubmitting}
            />
            <p className="mt-1 text-xs text-gray-500">
              This note will be recorded in the audit log and sent to both
              users.
            </p>
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
