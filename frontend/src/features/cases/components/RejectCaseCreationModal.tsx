import React, { useState } from 'react';
import { XMarkIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { RejectCaseCreationDto } from '../services/caseService';
import type { CaseRow } from './casesTable.utils';

interface RejectCaseCreationModalProps {
  open: boolean;
  onClose: () => void;
  caseData: CaseRow | null;
  onSubmit: (caseId: string, data: RejectCaseCreationDto) => Promise<void>;
}

const RejectCaseCreationModal: React.FC<RejectCaseCreationModalProps> = ({
  open,
  onClose,
  caseData,
  onSubmit,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isReasonValid = reason.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!caseData) return;

    if (!isReasonValid) {
      setErrors({ reason: 'Rejection reason must be at least 10 characters' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await onSubmit(caseData.id, { reason: reason.trim() });
      onClose();
      setReason('');
    } catch (error) {
      console.error('Failed to reject case creation:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to reject case creation. Please try again.';
      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setReason('');
      setErrors({});
    }
  };

  if (!open || !caseData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Reject Case Creation
            </h3>
            <p className="text-sm text-gray-500">
              Case ID: {caseData.id} • {caseData.type}
            </p>
            <p className="text-xs text-red-600 mt-1">
              This will reject the manual case creation request and return it to
              draft status
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

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Workflow Information */}
          <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-red-800 mb-2">
              Case Creation Rejection
            </h4>
            <p className="text-xs text-red-700">
              Rejecting this case will return it to draft status for the creator
              to revise with your feedback.
            </p>
          </div>

          {/* Case Details */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Case Details
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Case Type
                </label>
                <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50">
                  <span className="text-sm break-words">{caseData.type}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Current Status
                </label>
                <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50">
                  <span className="text-sm break-words">{caseData.status}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Priority
                </label>
                <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50">
                  <span className="text-sm">{caseData.priority}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Created On
                </label>
                <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50">
                  <span className="text-sm">{caseData.createdOn}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Alert Information */}
          {caseData.alertId && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">
                Associated Alert
              </h4>
              <div className="rounded-md border border-gray-300 p-3 bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Alert ID
                    </label>
                    <span className="text-sm break-words">
                      {caseData.alertId}
                    </span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Confidence Score
                    </label>
                    <span className="text-sm">
                      {caseData.confidencePercent}%
                    </span>
                  </div>
                </div>
                {caseData.alertMessage && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">
                      Alert Message
                    </label>
                    <p className="text-sm text-gray-700 break-words">
                      {caseData.alertMessage}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Rejection Reason */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Rejection Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => {
                setReason(e.target.value);
                if (e.target.value.trim().length >= 10) {
                  setErrors({});
                }
              }}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
              placeholder="Provide feedback on what needs to be corrected (minimum 10 characters)..."
              disabled={isSubmitting}
            />
            <div className="mt-1 flex justify-between">
              <p className="text-xs text-gray-500">
                {reason.length}/10 characters minimum
              </p>
              <p className="text-xs text-gray-500">
                {reason.length}/1000 characters
              </p>
            </div>
            {errors.reason && (
              <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
            )}
            {!isReasonValid && reason.length > 0 && (
              <p className="mt-1 text-sm text-red-600">
                Rejection reason must be at least 10 characters
              </p>
            )}
          </div>

          {}
          {errors.submit && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-600">{errors.submit}</p>
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
                  Reject Case Creation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RejectCaseCreationModal;
