import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { CloseCaseDto } from '../services/caseService';

interface CloseCaseModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  caseName?: string;
  onSubmit: (data: CloseCaseDto) => Promise<void>;
}

const CloseCaseModal: React.FC<CloseCaseModalProps> = ({
  open,
  onClose,
  caseId,
  caseName,
  onSubmit
}) => {
  const [formData, setFormData] = useState<CloseCaseDto>({
    recommendedOutcome: 'STATUS_83_CLOSED_INCONCLUSIVE',
    finalNotes: '',
    recommendations: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.finalNotes?.trim()) {
      newErrors.finalNotes = 'Final investigation notes are required';
    }

    if (!formData.recommendations?.trim()) {
      newErrors.recommendations = 'Recommendations are required';
    }

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
        recommendedOutcome: 'STATUS_83_CLOSED_INCONCLUSIVE',
        finalNotes: '',
        recommendations: ''
      });
      setErrors({});
    } catch (error) {
      console.error('Failed to close case:', error);
      setErrors({ submit: 'Failed to close case. Please try again.' });
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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
        {}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Complete Case Investigation</h3>
            <p className="text-sm text-gray-500">
              Case ID: {caseId} {caseName && `• ${caseName}`}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              This will submit the case for supervisor approval
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
            <h4 className="text-sm font-medium text-blue-800 mb-2">Case Closure Workflow</h4>
            <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
              <li>"Investigate Case" task will be marked as "COMPLETED"</li>
              <li>Outcome will be recorded: Confirmed, Refuted, or Inconclusive</li>
              <li>A closure task will be created and routed to the supervisor</li>
              <li>Case will transition to "PENDING FINAL APPROVAL"</li>
              <li>All actions will be logged in audit, system, and structured logs</li>
            </ul>
          </div>

          {}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recommended Outcome <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.recommendedOutcome}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                recommendedOutcome: e.target.value as CloseCaseDto['recommendedOutcome']
              }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isSubmitting}
            >
              <option value="STATUS_83_CLOSED_INCONCLUSIVE">83 - Closed Inconclusive</option>
              <option value="STATUS_81_CLOSED_REFUTED">81 - Closed Refuted</option>
              <option value="STATUS_82_CLOSED_CONFIRMED">82 - Closed Confirmed</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              This outcome will be reviewed by the supervisor during approval
            </p>
          </div>

          {}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Final Investigation Notes <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.finalNotes || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                finalNotes: e.target.value
              }))}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Provide detailed notes about your investigation findings..."
              disabled={isSubmitting}
            />
            {errors.finalNotes && (
              <p className="mt-1 text-sm text-red-600">{errors.finalNotes}</p>
            )}
          </div>

          {}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recommendations <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.recommendations || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                recommendations: e.target.value
              }))}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Provide recommendations based on your investigation..."
              disabled={isSubmitting}
            />
            {errors.recommendations && (
              <p className="mt-1 text-sm text-red-600">{errors.recommendations}</p>
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
              disabled={isSubmitting}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Submitting for Approval...' : 'Submit for Supervisor Approval'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CloseCaseModal;