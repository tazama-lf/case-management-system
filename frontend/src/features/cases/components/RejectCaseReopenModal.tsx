import React, { useState } from 'react';
import { XMarkIcon, XCircleIcon } from '@heroicons/react/24/outline';

interface RejectCaseReopenModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  onReject: (caseId: string, reason: string) => Promise<void>;
}

const RejectCaseReopenModal: React.FC<RejectCaseReopenModalProps> = ({
  open,
  onClose,
  caseId,
  onReject
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reason.trim().length < 4) {
      setError('Reason must be at least 4 characters');
      return;
    }
    setIsSubmitting(true);
    setError(null);
    try {
      await onReject(caseId, reason.trim());
      onClose();
      setReason('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reject case reopening');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Reject Case Reopening</h3>
            <p className="text-sm text-gray-500">Case ID: {caseId}</p>
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
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason for rejection</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={4}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="Provide a clear reason for rejecting the reopening (minimum 10 characters)"
            />
            <p className="mt-1 text-xs text-gray-500">{reason.length}/10 characters minimum</p>
          </div>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-600">{error || 'An error occurred'}</p>
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
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Rejecting...
                </>
              ) : (
                <>
                  <XCircleIcon className="h-4 w-4" />
                  Reject Reopening
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectCaseReopenModal;


