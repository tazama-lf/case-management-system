import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { CaseForSupervisor, ApproveCaseClosureDto } from '../services/supervisorService';

interface ApproveCaseClosureModalProps {
  open: boolean;
  onClose: () => void;
  case: CaseForSupervisor | null;
  onSubmit: (data: ApproveCaseClosureDto) => Promise<void>;
}

const ApproveCaseClosureModal: React.FC<ApproveCaseClosureModalProps> = ({
  open,
  onClose,
  case: caseData,
  onSubmit
}) => {
  const [formData, setFormData] = useState<ApproveCaseClosureDto>({
    approved: true,
    supervisor_notes: '',
    final_outcome: undefined,
    rejection_reason: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form when case changes
  React.useEffect(() => {
    if (caseData) {
      setFormData({
        approved: true,
        supervisor_notes: '',
        final_outcome: caseData.recommended_outcome,
        rejection_reason: ''
      });
      setErrors({});
    }
  }, [caseData]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.final_outcome) {
      newErrors.final_outcome = 'Recommended outcome is required';
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
      // Reset form
      setFormData({
        approved: true,
        supervisor_notes: '',
        final_outcome: undefined,
        rejection_reason: ''
      });
      setErrors({});
    } catch (error) {
      console.error('Failed to process approval:', error);
      setErrors({ submit: 'Failed to process approval. Please try again.' });
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

  if (!open || !caseData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Review Case Closure</h3>
            <p className="text-sm text-gray-500">
              Case ID: {caseData.case_id} • {caseData.case_type}
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


        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6">
          {/* Recommended Outcome */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recommended Outcome <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.final_outcome || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                final_outcome: e.target.value as ApproveCaseClosureDto['final_outcome']
              }))}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              disabled={isSubmitting}
            >
              <option value="">Select outcome</option>
              <option value="STATUS_81_CLOSED_REFUTED">81 - Closed Refuted</option>
              <option value="STATUS_82_CLOSED_CONFIRMED">82 - Closed Confirmed</option>
              <option value="STATUS_83_CLOSED_INCONCLUSIVE">83 - Closed Inconclusive</option>
            </select>
            {errors.final_outcome && (
              <p className="mt-1 text-sm text-red-600">{errors.final_outcome}</p>
            )}
          </div>

          {/* Final Notes */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Final Notes (Optional)
            </label>
            <textarea
              value={formData.supervisor_notes || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                supervisor_notes: e.target.value
              }))}
              rows={4}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Final investigation notes or summary..."
              disabled={isSubmitting}
            />
          </div>

          {/* Recommendations */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recommendations (Optional)
            </label>
            <textarea
              value={formData.rejection_reason || ''}
              onChange={(e) => setFormData(prev => ({
                ...prev,
                rejection_reason: e.target.value
              }))}
              rows={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Any final recommendations for the case..."
              disabled={isSubmitting}
            />
          </div>

          {/* Submit Error */}
          {errors.submit && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
              <p className="text-sm text-red-600">{errors.submit}</p>
            </div>
          )}

          {/* Actions */}
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
              className="rounded-md px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed bg-blue-600 hover:bg-blue-700"
            >
              {isSubmitting ? 'Processing...' : 'Close Case'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApproveCaseClosureModal;
