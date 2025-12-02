import React, { useState } from 'react';
import { PauseIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from './casesTable.utils';

interface SuspendCaseModalProps {
  open: boolean;
  onClose: () => void;
  onSuspend: (caseId: string, reason: string) => void;
  caseData: CaseRow | null;
}

const SuspendCaseModal: React.FC<SuspendCaseModalProps> = ({
  open,
  onClose,
  onSuspend,
  caseData
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isReasonValid = reason.trim().length >= 4;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseData || !isReasonValid) return;

    setIsSubmitting(true);
    try {
      await onSuspend(caseData.id, reason.trim());
      setReason('');
      onClose();
    } catch (error) {
      console.error('Failed to suspend case:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason('');
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-yellow-100">
              <PauseIcon className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Suspend Case
              </h3>
              <p className="text-sm text-gray-600">
                Case ID: {caseData?.id}
              </p>
            </div>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 pb-4">
          <p className="text-sm text-gray-700 mb-4">
            Temporarily pause a case due to blocked progress or pending information.
          </p>

          {/* <div className="bg-blue-50 border border-blue-200 rounded-md p-3 mb-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Suspension Workflow</h4>
            <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
              <li>Task status becomes "BLOCKED", case status becomes "SUSPENDED"</li>
              <li>User must provide a reason for suspension (minimum 10 characters)</li>
              <li>Notifications will be sent to the supervisor</li>
              <li>Suspension will be recorded in event, system, and audit logs</li>
            </ul>
          </div> */}

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                Reason for suspension <span className="text-red-500">*</span><span className="text-xs text-gray-500 ml-2">(minimum 4 characters)</span>
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={4}
                maxLength={500}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-yellow-500 focus:outline-none focus:ring-1 focus:ring-yellow-500"
                placeholder="Explain why this case needs to be suspended..."
              />
              <div className="mt-1 flex justify-between">
                <p className="text-xs text-gray-500">
                  {reason.length}/4 characters minimum
                </p>
                <span className={`text-xs ${reason.length >= 500 ? 'text-red-500' : 'text-gray-500'}`}>
                  {reason.length}/500
                </span>

              </div>

              {!isReasonValid && reason.length > 0 && (
                <p className="mt-1 text-sm text-red-600">Reason must be at least 4 characters</p>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-500"
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting || !isReasonValid}
                className="px-4 py-2 text-sm font-medium text-white bg-yellow-600 border border-transparent rounded-md hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Suspending...' : 'Suspend Case'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default SuspendCaseModal;