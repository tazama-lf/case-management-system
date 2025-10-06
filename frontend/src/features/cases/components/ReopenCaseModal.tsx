import React, { useState } from 'react';
import { PlayIcon, XMarkIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from './CasesTable';

interface ReopenCaseModalProps {
  open: boolean;
  onClose: () => void;
  onReopen: (caseId: string, reason?: string) => void;
  caseData: CaseRow | null;
}

const ReopenCaseModal: React.FC<ReopenCaseModalProps> = ({
  open,
  onClose,
  onReopen,
  caseData
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseData) return;

    setIsSubmitting(true);
    try {
      await onReopen(caseData.id, reason.trim() || undefined);
      setReason('');
      onClose();
    } catch (error) {
      console.error('Failed to reopen case:', error);
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
          <div className="flex items-center justify-between px-6 py-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100">
                <PlayIcon className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">
                  Reopen Case
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
              This case will be moved back to "In Progress" status and assigned to an investigator for continued investigation.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3 mb-4">
              <p className="text-sm text-yellow-800">
                <strong>Note:</strong> Reopening this case will create new investigation tasks and notify the assigned team.
              </p>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="mb-6">
                <label htmlFor="reason" className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for reopening (optional)
                </label>
                <textarea
                  id="reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={3}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Provide additional context for reopening this case..."
                />
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
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Reopening...' : 'Reopen Case'}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
  );
};

export default ReopenCaseModal;
