import React, { useState } from 'react';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';

interface ApproveCaseReopenModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  requesterRole?: 'ANALYST' | 'SUPERVISOR';
  onApprove: (caseId: string, comments?: string) => Promise<void>;
}

const ApproveCaseReopenModal: React.FC<ApproveCaseReopenModalProps> = ({
  open,
  onClose,
  caseId,
  requesterRole,
  onApprove
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [comments, setComments] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    try {
      await onApprove(caseId, comments.trim() || undefined);
      onClose();
      setComments('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to approve case reopening');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Approve Case Reopening</h3>
            <p className="text-sm text-gray-500">Case ID: {caseId}</p>
            {requesterRole && (
              <p className="text-xs text-blue-600 mt-1">Requested by: {requesterRole === 'ANALYST' ? 'Analyst' : 'Supervisor'}</p>
            )}
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6">
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Reopening Workflow</h4>
            <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
              <li>Case must be in "PENDING CASE REOPENING APPROVAL" status</li>
              <li>On approval, an "Investigate Case" task will be created</li>
              <li>Assignment depends on requester: Analyst → assigned to analyst; Supervisor → investigations group</li>
              <li>All actions are audit logged and notifications sent</li>
            </ul>
          </div>

          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Supervisor Comments (optional)</label>
            <textarea
              value={comments}
              onChange={(e) => setComments(e.target.value)}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              placeholder="Add any context for approving this reopening request"
            />
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Approving...
                </>
              ) : (
                <>
                  <CheckCircleIcon className="h-4 w-4" />
                  Approve Reopening
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApproveCaseReopenModal;

