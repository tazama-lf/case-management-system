import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface RejectCaseModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  caseName?: string;
  onSubmit: (rejectionReason: string) => Promise<void>;
}

const RejectCaseModal: React.FC<RejectCaseModalProps> = ({
  open,
  onClose,
  caseId,
  caseName,
  onSubmit
}) => {
  const [rejectionReason, setRejectionReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isReasonValid = rejectionReason.trim().length >= 15;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isReasonValid) {
      setError('Rejection reason must be at least 15 characters');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await onSubmit(rejectionReason.trim());
      onClose();
      setRejectionReason('');
    } catch (err) {
      console.error('Failed to reject case:', err);
      setError('Failed to reject case. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setRejectionReason('');
      setError(null);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Reject Case Closure</h3>
            <p className="text-sm text-gray-500">
              Case ID: {caseId} {caseName && `• ${caseName}`}
            </p>
            <p className="text-xs text-red-600 mt-1">
              This will return the case for additional investigation
            </p>
          </div>
          <button
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
          >
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        {}
        <form onSubmit={handleSubmit} className="p-6">
          {}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">Supervisor Case Closure Approval Workflow</h4>
            <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
              <li>Only cases in "PENDING FINAL APPROVAL" can be acted on</li>
              <li>Supervisor may approve or reject with a detailed reason</li>
              <li>Approval transitions case to "CLOSED [Confirmed/Refuted/Inconclusive]"</li>
              <li>Rejection reopens the "Investigate Case" task and reassigns it to the user</li>
              <li>All approval actions must be logged</li>
            </ul>
          </div>

          {}
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              <strong>Important:</strong> When rejecting a case closure, please provide detailed feedback
              explaining what additional investigation or information is required. The case will be
              returned to the investigator for further work.
            </p>
          </div>

          {}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              rows={6}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="Explain in detail why this case closure is being rejected and what additional investigation is required (minimum 15 characters)..."
              disabled={isSubmitting}
            />
            <div className="mt-1 flex justify-between">
              <p className="text-xs text-gray-500">
                {rejectionReason.length}/15 characters minimum
              </p>
              <p className="text-xs text-gray-500">
                {rejectionReason.length}/1000 characters
              </p>
            </div>
            {!isReasonValid && rejectionReason.length > 0 && (
              <p className="mt-1 text-sm text-red-600">Rejection reason must be at least 15 characters</p>
            )}
          </div>

          {}
          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {}
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || !isReasonValid}
              className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Rejecting Case...' : 'Reject Case Closure'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectCaseModal;