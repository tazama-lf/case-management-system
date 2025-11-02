import React, { useState } from 'react';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { ApproveCaseClosureDto } from '../services/caseService';

interface ApproveCaseModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  caseName?: string;
  recommendedOutcome?: string;
  finalNotes?: string;
  recommendations?: string;
  onSubmit: (data: ApproveCaseClosureDto) => Promise<void>;
}

const ApproveCaseModal: React.FC<ApproveCaseModalProps> = ({
  open,
  onClose,
  caseId,
  caseName,
  recommendedOutcome,
  finalNotes,
  recommendations,
  onSubmit
}) => {
  const [formData, setFormData] = useState<ApproveCaseClosureDto>({
    finalOutcome: recommendedOutcome as ApproveCaseClosureDto['finalOutcome'] || 'STATUS_83_CLOSED_INCONCLUSIVE',
    supervisorComments: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(formData);
      onClose();
      setFormData({
        finalOutcome: recommendedOutcome as ApproveCaseClosureDto['finalOutcome'] || 'STATUS_83_CLOSED_INCONCLUSIVE',
        supervisorComments: ''
      });
    } catch (error) {
      console.error('Failed to approve case:', error);
      setErrors({ submit: 'Failed to approve case closure. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setErrors({});
    }
  };

  const formatOutcome = (outcome: string): string => {
    return outcome
      .replace('STATUS_', '')
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Approve Case Closure</h3>
            <p className="text-sm text-gray-500">
              Case ID: {caseId} {caseName && `• ${caseName}`}
            </p>
            <p className="text-xs text-green-600 mt-1">
              This will finalize the case with the selected outcome
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
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-green-800 mb-2">Supervisor Case Closure Approval Workflow</h4>
            <ul className="text-xs text-green-700 list-disc list-inside space-y-1">
              <li>Only cases in "PENDING FINAL APPROVAL" can be acted on</li>
              <li>Supervisor may approve or reject with a detailed reason</li>
              <li>Approval transitions case to "CLOSED [Confirmed/Refuted/Inconclusive]"</li>
              <li>All approval actions must be logged</li>
            </ul>
          </div>

          {}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Investigator's Recommended Outcome
            </label>
            <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50">
              <span className="font-medium">
                {recommendedOutcome ? formatOutcome(recommendedOutcome) : 'Not provided'}
              </span>
            </div>
          </div>

          {}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Final Outcome <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.finalOutcome}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                finalOutcome: e.target.value as ApproveCaseClosureDto['finalOutcome']
              }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              disabled={isSubmitting}
            >
              <option value="STATUS_83_CLOSED_INCONCLUSIVE">83 - Closed Inconclusive</option>
              <option value="STATUS_81_CLOSED_REFUTED">81 - Closed Refuted</option>
              <option value="STATUS_82_CLOSED_CONFIRMED">82 - Closed Confirmed</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              You may change the outcome from the investigator's recommendation
            </p>
          </div>

          {}
          {finalNotes && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Investigator's Final Notes
              </label>
              <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50 max-h-32 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{finalNotes}</p>
              </div>
            </div>
          )}

          {}
          {recommendations && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Investigator's Recommendations
              </label>
              <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50 max-h-32 overflow-y-auto">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">{recommendations}</p>
              </div>
            </div>
          )}

          {}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Supervisor Comments
            </label>
            <textarea
              value={formData.supervisorComments || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                supervisorComments: e.target.value
              }))}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
              placeholder="Provide any additional comments about your approval decision..."
              disabled={isSubmitting}
            />
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
                  Approve Case Closure
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApproveCaseModal;