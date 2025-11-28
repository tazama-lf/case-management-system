import React, { useState } from 'react';
import { XMarkIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { ApproveCaseClosureDto, TaskDTO } from '../services/caseService';
import { commentService } from '../services/commentService';
import type { CommentsByCaseId } from '../services/commentService';

interface CaseClosureDecisionModalProps {
  open: boolean;
  onClose: () => void;
  caseId: string;
  caseName?: string;
  recommendedOutcome?: string;
  finalNotes?: string;
  taskList?: TaskDTO[] | '';
  recommendations?: string;
  onApprove: (data: ApproveCaseClosureDto) => Promise<void>;
  onReject: (rejectionReason: string) => Promise<void>;
}

type DecisionType = 'approve' | 'reject';

const CaseClosureDecisionModal: React.FC<CaseClosureDecisionModalProps> = ({
  open,
  onClose,
  caseId,
  caseName,
  recommendedOutcome,
  finalNotes,
  taskList,
  recommendations,
  onApprove,
  onReject
}) => {
  const [decision, setDecision] = useState<DecisionType | null>(null);
  const [tasks, setTasks] = useState<CommentsByCaseId[]>([]);
  const [formData, setFormData] = useState<{
    finalOutcome: ApproveCaseClosureDto['finalOutcome'];
    supervisorComments: string;
    rejectionReason: string;
  }>({
    finalOutcome: (recommendedOutcome as ApproveCaseClosureDto['finalOutcome']) || 'STATUS_83_CLOSED_INCONCLUSIVE',
    supervisorComments: '',
    rejectionReason: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  React.useEffect(() => {

    if (decision === 'approve' || decision === 'reject') return;

    const approveClosureTask = Array.isArray(taskList)
      ? taskList.find(t => t.name === "Approve Case Closure")
      : undefined;

    const taskId = approveClosureTask?.task_id || '';
    if (!taskId) return;

    async function loadTasks() {
      try {
        const data = await commentService.getCommentsByTaskId(taskId);
        setTasks(data);
      } catch (error) {
        console.error('Failed to load comments', error);
      }
    }

    loadTasks();
  }, [decision, taskList]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (decision === 'reject') {
      if (formData.rejectionReason.trim().length < 20) {
        newErrors.rejectionReason = 'Rejection reason must be at least 20 characters';
      }
    }
    if (decision === 'approve') {
      if (formData.supervisorComments.trim().length < 20) {
        newErrors.supervisorComments = 'Supervisor comment must be at least 20 characters';
      }
    }


    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleApproveSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onApprove({
        finalOutcome: formData.finalOutcome,
        supervisorComments: formData.supervisorComments
      });
      handleClose();
    } catch (error) {
      console.error('Failed to approve case:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to approve case closure. Please try again.';
      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onReject(formData.rejectionReason.trim());
      handleClose();
    } catch (error) {
      console.error('Failed to reject case:', error);
      const errorMessage = error instanceof Error ? error.message : 'Failed to reject case closure. Please try again.';
      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setDecision(null);
      setFormData({
        finalOutcome: (recommendedOutcome as ApproveCaseClosureDto['finalOutcome']) || 'STATUS_83_CLOSED_INCONCLUSIVE',
        supervisorComments: '',
        rejectionReason: ''
      });
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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              {decision === 'approve' && 'Approve Case Closure'}
              {decision === 'reject' && 'Reject Case Closure'}
              {!decision && 'Case Closure Review'}
            </h3>
            <p className="text-sm text-gray-500">
              Case ID: {caseId} {caseName && `• ${caseName}`}
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

        {/* Body */}
        <div className="p-6">
          {/* Decision Selection Step */}
          {!decision && (
            <div className="space-y-4">
              <p className="text-sm text-gray-600 mb-6">
                Select how you would like to proceed with this case closure:
              </p>

              {/* Approve Option */}
              <button
                onClick={() => setDecision('approve')}
                className="w-full p-4 border-2 border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-left"
              >
                <div className="flex items-start gap-3">
                  <CheckCircleIcon className="h-6 w-6 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-gray-900">Approve Case Closure</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Finalize the case with the investigator's recommended or modified outcome. Case will be moved to CLOSED status.
                    </p>
                  </div>
                </div>
              </button>

              {/* Reject Option */}
              <button
                onClick={() => setDecision('reject')}
                className="w-full p-4 border-2 border-gray-300 rounded-lg hover:border-red-500 hover:bg-red-50 transition-colors text-left"
              >
                <div className="flex items-start gap-3">
                  <XCircleIcon className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <h4 className="font-medium text-gray-900">Reject Case Closure</h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Send the case back for additional investigation. The investigator will need to provide more information.
                    </p>
                  </div>
                </div>
              </button>

              {/* Workflow Info */}
              {/* <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
                <h4 className="text-sm font-medium text-blue-800 mb-2">Supervisor Case Closure Approval Workflow</h4>
                <ul className="text-xs text-blue-700 list-disc list-inside space-y-1">
                  <li>Only cases in "PENDING FINAL APPROVAL" can be acted on</li>
                  <li>Supervisor may approve or reject with comments/reason</li>
                  <li>Approval transitions case to "CLOSED [Confirmed/Refuted/Inconclusive]"</li>
                  <li>Rejection reopens the "Investigate Case" task for further work</li>
                  <li>All approval actions are logged for audit trails</li>
                </ul>
              </div> */}
            </div>
          )}

          {/* Approve Form */}
          {decision === 'approve' && (
            <form onSubmit={handleApproveSubmit} className="space-y-6">
              {/* Info Box */}
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-800">
                  <strong>Approval:</strong> You are about to finalize this case with the selected outcome. This action cannot be easily reversed.
                </p>
              </div>

              {/* Recommended Outcome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Investigator's Recommended Outcome
                </label>
                <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50">
                  <span className="font-medium">
                    {recommendedOutcome ? formatOutcome(recommendedOutcome) : 'Not provided'}
                  </span>
                </div>
              </div>
              <div>
                {/*Investigator's Notes*/}
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Investigator's Notes
                </label>
                {!tasks.length ? (
                  <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50 max-h-32 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">No notes provided.</p>
                  </div>
                ) : (
                  tasks.map((c) => (
                    <div key={c.comment_id} className="space-y-3 mb-2">
                      <div className="w-full rounded-lg border border-gray-200 bg-gray-50 p-4 min-h-[80px] max-h-40 overflow-y-auto">
                        <div className="font-medium text-gray-900 mt-1 whitespace-pre-line">
                          {c.note}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>


              {/* Final Outcome */}
              <div>
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

              {/* Final Notes */}
              {finalNotes && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Investigator's Final Notes
                  </label>
                  <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50 max-h-32 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{finalNotes}</p>
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {recommendations && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Investigator's Recommendations
                  </label>
                  <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50 max-h-32 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{recommendations}</p>
                  </div>
                </div>
              )}

              {/* Supervisor Comments */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Supervisor Comments <span className="text-red-500">*</span>
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
                <div className="mt-1 flex justify-between">
                  <p className="text-xs text-gray-500">
                    {formData.supervisorComments.length}/20 characters minimum
                  </p>
                  <p className="text-xs text-gray-500">
                    {formData.supervisorComments.length}/1000 characters
                  </p>
                </div>
                {errors.supervisorComments && (
                  <p className="mt-1 text-sm text-red-600">{errors.supervisorComments}</p>
                )}
              </div>

              {/* Error */}
              {errors.submit && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDecision(null)}
                  disabled={isSubmitting}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Back
                </button>
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
          )}

          {/* Reject Form */}
          {decision === 'reject' && (
            <form onSubmit={handleRejectSubmit} className="space-y-6">
              {/* Info Box */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> When rejecting a case closure, provide detailed feedback explaining what additional investigation or information is required. The case will be returned to the investigator for further work.
                </p>
              </div>
              <div>
                {/*Investigator's Notes*/}
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Investigator's Notes
                </label>
                {!tasks.length ? (
                  <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50 max-h-32 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">No notes provided.</p>
                  </div>
                ) : (
                  tasks.map((c) => (
                    <div key={c.comment_id} className="space-y-3 mb-2">
                      <div className="w-full rounded-lg border border-gray-200 bg-gray-50 p-4 min-h-[80px] max-h-40 overflow-y-auto">
                        <div className="font-medium text-gray-900 mt-1 whitespace-pre-line">
                          {c.note}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Rejection Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={formData.rejectionReason}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    rejectionReason: e.target.value
                  }))}
                  rows={6}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Explain in detail why this case closure is being rejected and what additional investigation is required (minimum 15 characters)..."
                  disabled={isSubmitting}
                />
                <div className="mt-1 flex justify-between">
                  <p className="text-xs text-gray-500">
                    {formData.rejectionReason.length}/20 characters minimum
                  </p>
                  <p className="text-xs text-gray-500">
                    {formData.rejectionReason.length}/1000 characters
                  </p>
                </div>
                {errors.rejectionReason && (
                  <p className="mt-1 text-sm text-red-600">{errors.rejectionReason}</p>
                )}
              </div>

              {/* Error */}
              {errors.submit && (
                <div className="rounded-md bg-red-50 border border-red-200 p-3">
                  <p className="text-sm text-red-600">{errors.submit}</p>
                </div>
              )}

              {/* Buttons */}
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setDecision(null)}
                  disabled={isSubmitting}
                  className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Back
                </button>
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
                  disabled={isSubmitting || formData.rejectionReason.trim().length < 20}
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
                      Reject Case Closure
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseClosureDecisionModal;
