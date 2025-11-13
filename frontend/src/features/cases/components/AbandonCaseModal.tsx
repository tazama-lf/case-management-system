import React, { useState } from 'react';
import {
  TrashIcon,
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import type { CaseRow } from './casesTable.utils';

interface AbandonCaseModalProps {
  open: boolean;
  onClose: () => void;
  onAbandon: (caseId: string, reason: string) => void;
  caseData: CaseRow | null;
}

const AbandonCaseModal: React.FC<AbandonCaseModalProps> = ({
  open,
  onClose,
  onAbandon,
  caseData,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isReasonValid = reason.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!caseData || !isReasonValid) return;

    setIsSubmitting(true);
    setErrors({});

    try {
      await onAbandon(caseData.id, reason.trim());
      setReason('');
      onClose();
    } catch (error) {
      console.error('Failed to abandon case:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to abandon case. Please try again.';
      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setReason('');
      setErrors({});
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-xl">
        <div className="flex items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100">
              <TrashIcon className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Abandon Case
              </h3>
              <p className="text-sm text-gray-600">Case ID: {caseData?.id}</p>
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
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="flex items-start gap-3">
              <ExclamationTriangleIcon className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-red-800 mb-1">
                  Warning: This action cannot be undone
                </h4>
                <p className="text-sm text-red-700">
                  Abandoning this case will permanently remove it from active
                  investigation. All associated tasks will be cancelled and the
                  case will be marked as abandoned.
                </p>
              </div>
            </div>
          </div>

          {}
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <p className="text-sm text-yellow-800">
              <strong>Note:</strong> Only cases in DRAFT status can be
              abandoned. The case must have a "Complete New Case" task
              associated with it.
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                htmlFor="reason"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Reason for abandoning <span className="text-red-500">*</span>
              </label>
              <textarea
                id="reason"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (e.target.value.trim().length >= 10) {
                    setErrors({});
                  }
                }}
                rows={3}
                required
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="Provide a detailed reason for abandoning this case (minimum 10 characters)..."
              />
              <div className="mt-1 flex justify-between">
                <p className="text-xs text-gray-500">
                  {reason.length}/10 characters minimum
                </p>
              </div>
              {errors.reason && (
                <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
              )}
              {!isReasonValid && reason.length > 0 && (
                <p className="mt-1 text-sm text-red-600">
                  Reason must be at least 10 characters
                </p>
              )}
            </div>

            {}
            {errors.submit && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

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
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 border border-transparent rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? 'Abandoning...' : 'Abandon Case'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AbandonCaseModal;
