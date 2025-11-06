import React, { useState } from 'react';
import { XMarkIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import type { ReturnCaseForReviewDto } from '../services/caseService';
import type { CaseRow } from './casesTable.utils';

interface ReturnCaseForReviewModalProps {
  open: boolean;
  onClose: () => void;
  caseData: CaseRow | null;
  onSubmit: (caseId: string, data: ReturnCaseForReviewDto) => Promise<void>;
}

const ReturnCaseForReviewModal: React.FC<ReturnCaseForReviewModalProps> = ({
  open,
  onClose,
  caseData,
  onSubmit
}) => {
  const [reviewComments, setReviewComments] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const isCommentsValid = reviewComments.trim().length >= 10;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!caseData) return;

    if (!isCommentsValid) {
      setErrors({ comments: 'Review comments must be at least 10 characters' });
      return;
    }

    setIsSubmitting(true);
    setErrors({});

    try {
      await onSubmit(caseData.id, { reviewComments: reviewComments.trim() });
      onClose();
      setReviewComments('');
    } catch (error) {
      console.error('Failed to return case for review:', error);
      setErrors({ submit: 'Failed to return case for review. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setReviewComments('');
      setErrors({});
    }
  };

  if (!open || !caseData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Return Case for Additional Review</h3>
            <p className="text-sm text-gray-500">
              Case ID: {caseData.id} • {caseData.type}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              This will return the case to the investigator for additional work
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
            <h4 className="text-sm font-medium text-blue-800 mb-2">Supervisor Case Review Workflow</h4>
            <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
              <li>Only cases in "PENDING FINAL APPROVAL" can be acted on</li>
              <li>Supervisor may approve, reject, or return for additional review</li>
              <li>Return transitions case to "IN PROGRESS" status</li>
              <li>"Investigate Case" task will be reassigned to investigator</li>
              <li>All review actions must be logged</li>
            </ul>
          </div>

          {}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-700 mb-3">Case Details</h4>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Case Type</label>
                <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50">
                  <span className="text-sm">{caseData.type}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Current Status</label>
                <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50">
                  <span className="text-sm">{caseData.status}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Priority</label>
                <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50">
                  <span className="text-sm">{caseData.priority}</span>
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Created On</label>
                <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50">
                  <span className="text-sm">{caseData.createdOn}</span>
                </div>
              </div>
            </div>
          </div>

          {}
          {caseData.alertId && (
            <div className="mb-6">
              <h4 className="text-sm font-medium text-gray-700 mb-3">Associated Alert</h4>
              <div className="rounded-md border border-gray-300 p-3 bg-gray-50">
                <div className="flex justify-between">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Alert ID</label>
                    <span className="text-sm">{caseData.alertId}</span>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">Confidence Score</label>
                    <span className="text-sm">{caseData.confidencePercent}%</span>
                  </div>
                </div>
                {caseData.alertMessage && (
                  <div className="mt-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Alert Message</label>
                    <p className="text-sm text-gray-700">{caseData.alertMessage}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {}
          <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <p className="text-sm text-yellow-800">
              <strong>Important:</strong> When returning a case for additional review, please provide detailed feedback
              explaining what additional investigation or information is required. The case will be returned to the
              investigator for further work.
            </p>
          </div>

          {}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Review Comments <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reviewComments}
              onChange={(e) => {
                setReviewComments(e.target.value);
                if (e.target.value.trim().length >= 10) {
                  setErrors({});
                }
              }}
              rows={6}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Explain in detail what additional investigation or information is required for this case (minimum 10 characters)..."
              disabled={isSubmitting}
            />
            <div className="mt-1 flex justify-between">
              <p className="text-xs text-gray-500">
                {reviewComments.length}/10 characters minimum
              </p>
              <p className="text-xs text-gray-500">
                {reviewComments.length}/1000 characters
              </p>
            </div>
            {errors.comments && (
              <p className="mt-1 text-sm text-red-600">{errors.comments}</p>
            )}
            {!isCommentsValid && reviewComments.length > 0 && (
              <p className="mt-1 text-sm text-red-600">Review comments must be at least 10 characters</p>
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
              disabled={isSubmitting || !isCommentsValid}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent"></div>
                  Returning...
                </>
              ) : (
                <>
                  <ArrowPathIcon className="h-4 w-4" />
                  Return for Review
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReturnCaseForReviewModal;