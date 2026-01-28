import React, { useEffect, useState, Suspense } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { CloseCaseDto } from '../services/caseService';
import { authService } from '@/features/auth';
import { DocumentTextIcon } from '@heroicons/react/24/solid';
import GenerateInvestigationReportModal from '../components/modals/GenerateInvestigationReportModal';
import type { CaseRow } from './casesTable.utils';


interface CloseCaseModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  caseName?: string;
  onSubmit: (data: CloseCaseDto) => Promise<void>;
  caseData?: CaseRow | null;
}

const CloseCaseModal: React.FC<CloseCaseModalProps> = ({
  open,
  onClose,
  caseId,
  caseName,
  onSubmit,
  caseData
}) => {
  const [formData, setFormData] = useState<CloseCaseDto>({
    recommendedOutcome: 'STATUS_83_CLOSED_INCONCLUSIVE',
    finalNotes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isSupervisor, setIsSupervisor] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportApproved, setReportApproved] = useState(false);

  useEffect(() => {
    if (open) {
      setShowReportModal(false);
      setReportApproved(false);
    }
  }, [open]);

  useEffect(() => {
    const user = authService.getUser();
    const isSupervisor = user?.validatedClaims?.CMS_SUPERVISOR === true;
    setIsSupervisor(isSupervisor);
  }, []);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    const trimmed = formData.finalNotes.trim() ?? '';

    if (!trimmed) {
      newErrors.finalNotes = 'Final investigation notes are required';
    } else if (trimmed.length < 4) {
      newErrors.finalNotes = 'Final notes must be at least 4 characters';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    closeCase();
  };

  const closeCase = async () => {
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
        recommendations: '',
      });
      setErrors({});
    } catch (error) {
      console.error('Failed to close case:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to close case. Please try again.';
      setErrors({ submit: errorMessage });
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
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
        <div className="w-full max-w-2xl rounded-lg bg-white shadow-xl">
          { }
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Complete Case Investigation
              </h3>
              <p className="text-sm text-gray-500">
                Case ID: {caseId} {caseName && `• ${caseName}`}
              </p>
              {isSupervisor ? (
                <p className="text-xs text-green-600 mt-1">
                  As a supervisor, you can directly close this case.
                </p>
              ) : (
                <p className="text-xs text-blue-600 mt-1">
                  This will submit the case for supervisor approval
                </p>
              )}
            </div>
            <button
              onClick={handleClose}
              disabled={isSubmitting}
              className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>

          { }
          <form onSubmit={handleSubmit} className="p-6">
            { }

            {/* Recommended Outcome / Final Outcome */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {isSupervisor ? 'Final Outcome' : 'Recommended Outcome'} <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.recommendedOutcome}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    recommendedOutcome: e.target.value as CloseCaseDto['recommendedOutcome'],
                  }))
                }
                disabled={isSubmitting || reportApproved}
                className="w-full rounded-md border border-gray-300 px-3 py-2
             disabled:bg-gray-100 disabled:cursor-not-allowed"
              >
                <option value="STATUS_83_CLOSED_INCONCLUSIVE">
                  83 - Closed Inconclusive
                </option>
                <option value="STATUS_81_CLOSED_REFUTED">
                  81 - Closed Refuted
                </option>
                <option value="STATUS_82_CLOSED_CONFIRMED">
                  82 - Closed Confirmed
                </option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {isSupervisor
                  ? 'This is the final outcome that will be applied to the case'
                  : 'This outcome will be reviewed by the supervisor during approval'
                }
              </p>
            </div>

            { }
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Final Investigation Notes <span className="text-red-500">*</span><span className="text-xs text-gray-500 ml-2">(minimum 4 characters)</span>
              </label>
              <textarea
                value={formData.finalNotes || ''}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    finalNotes: e.target.value,
                  }))
                }
                rows={4}
                maxLength={500}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:bg-gray-100 disabled:cursor-not-allowed"
                placeholder="Provide detailed notes about your investigation findings..."
                disabled={isSubmitting || reportApproved}
              />
              <div className="mt-1 flex justify-between">
                <p className="text-xs text-gray-500">
                  {formData.finalNotes.length}/4 characters minimum
                </p>
                <span className={`text-xs ${formData.finalNotes.length >= 500 ? 'text-red-500' : 'text-gray-500'}`}>
                  {formData.finalNotes.length}/500
                </span>
              </div>
              {errors.finalNotes && (
                <p className="mt-1 text-sm text-red-600">{errors.finalNotes}</p>
              )}
            </div>

            { }
            { }
            {errors.submit && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}

            { }
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={handleClose}
                disabled={isSubmitting}
                className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              {/* INVESTIGATOR → Submit for Approval */}
              {!isSupervisor && (
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Submitting for Approval...' : 'Submit for Approval'}
                </button>
              )}

              {/* SUPERVISOR → Generate Report */}
              {isSupervisor && !reportApproved && (
                <button
                  type="button"
                  disabled={isSubmitting || formData.finalNotes.trim().length < 4}
                  onClick={() => setShowReportModal(true)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white text-sm font-medium rounded-md hover:from-blue-700 hover:to-blue-800 shadow-sm disabled:from-blue-400 disabled:to-blue-400 disabled:shadow-none disabled:cursor-not-allowed "

                >
                  <DocumentTextIcon className="h-5 w-5" />
                  Generate Investigation Report
                </button>
              )}

              {/* SUPERVISOR → Close Case (AFTER report) */}
              {/* {isSupervisor && reportApproved && (
                <button
                  type="submit"
                  disabled={isSubmitting || !reportApproved}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? 'Closing Case...' : 'Close Case'}
                </button>
              )} */}
            </div>
          </form>
        </div>
      </div>
      <Suspense fallback={<div>Loading modal...</div>}>
        {/* Generate Report Modal */}
        <GenerateInvestigationReportModal
          open={showReportModal}
          onClose={() => setShowReportModal(false)}
          caseId={caseData?.id || Number(caseId)}
          caseStatus={caseData?.status}
          caseTitle={`Case ${caseData?.id || caseId} - ${caseData?.type || 'Investigation'}`}
          tasks={caseData?.tasks || undefined}
          caseData={caseData || undefined}
          selectedFinalNotes={formData.finalNotes}
          selectedOutcome={formData.recommendedOutcome}
          onApproved={async () => {
            await closeCase();
            setReportApproved(true);
            setShowReportModal(false);
          }}
        />
      </Suspense>
    </>
  );
};

export default CloseCaseModal;
