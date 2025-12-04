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
  const [activeTab, setActiveTab] = useState<DecisionType>('approve');
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
  }, [taskList]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (activeTab === 'reject') {
      if (formData.rejectionReason.trim().length < 4) {
        newErrors.rejectionReason = 'Rejection reason must be at least 4 characters';
      }
    }
    if (activeTab === 'approve') {
      if (formData.supervisorComments.trim().length < 4) {
        newErrors.supervisorComments = 'Supervisor comment must be at least 4 characters';
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
      setActiveTab('approve');
      setFormData({
        finalOutcome: (recommendedOutcome as ApproveCaseClosureDto['finalOutcome']) || 'STATUS_83_CLOSED_INCONCLUSIVE',
        supervisorComments: '',
        rejectionReason: ''
      });
      setErrors({});
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-4xl max-h-[90vh] rounded-lg bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Case Closure Review
            </h3>
            <p className="text-sm text-gray-500">
              Case ID: {caseId} {caseName && caseName !== 'NONE' ? `• ${caseName}` : ''}
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

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-200 px-6 flex-shrink-0">
          <button
            onClick={() => setActiveTab('approve')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'approve'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <CheckCircleIcon className="h-4 w-4" />
              Approve Case Closure
            </div>
          </button>
          <button
            onClick={() => setActiveTab('reject')}
            className={`py-3 px-4 text-sm font-medium border-b-2 transition-colors ${activeTab === 'reject'
              ? 'border-red-500 text-red-600'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
          >
            <div className="flex items-center gap-2">
              <XCircleIcon className="h-4 w-4" />
              Reject Case Closure
            </div>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Approve Tab Content */}
          {activeTab === 'approve' && (
            <form onSubmit={handleApproveSubmit} className="space-y-6">
              {/* Info Box */}
              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <p className="text-sm text-green-800">
                  <strong>Approval:</strong> You are about to finalize this case with the selected outcome. This action cannot be easily reversed.
                </p>
              </div>

              {/* Recommended Outcome */}
              {/* <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Investigator's Recommended Outcome
                </label>
                <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50">
                  <span className="font-medium">
                    {recommendedOutcome ? formatOutcome(recommendedOutcome) : 'Not provided'}
                  </span>
                </div>
              </div> */}

              {/* Investigator's Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Investigator's Notes
                </label>
                {!tasks.length ? (
                  <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50 max-h-32 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">No notes provided.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-40 overflow-y-auto">
                    {tasks.map((c) => (
                      <div key={c.comment_id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="font-medium text-gray-900 whitespace-pre-line">
                          {c.note}
                        </div>
                      </div>
                    ))}
                  </div>
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
                  Supervisor Comments <span className="text-red-500">*</span><span className="text-xs text-gray-500 ml-2">(minimum 4 characters)</span>
                </label>
                <textarea
                  value={formData.supervisorComments || ''}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    supervisorComments: e.target.value
                  }))}
                  rows={4}
                  maxLength={500}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
                  placeholder="Provide any additional comments about your approval decision..."
                  disabled={isSubmitting}
                />
                <div className="mt-1 flex justify-between">
                  <p className="text-xs text-gray-500">
                    {formData.supervisorComments.length}/4 characters minimum
                  </p>
                  <p className="text-xs text-gray-500">
                    {formData.supervisorComments.length}/500 characters
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
            </form>
          )}

          {/* Reject Tab Content */}
          {activeTab === 'reject' && (
            <form onSubmit={handleRejectSubmit} className="space-y-6">
              {/* Info Box */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Important:</strong> When rejecting a case closure, provide detailed feedback explaining what additional investigation or information is required. The case will be returned to the investigator for further work.
                </p>
              </div>

              {/* Investigator's Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Investigator's Notes
                </label>
                {!tasks.length ? (
                  <div className="rounded-md border border-gray-300 px-3 py-2 bg-gray-50 max-h-32 overflow-y-auto">
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">No notes provided.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-40 overflow-y-auto">
                    {tasks.map((c) => (
                      <div key={c.comment_id} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                        <div className="font-medium text-gray-900 whitespace-pre-line">
                          {c.note}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Rejection Reason */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Rejection Reason <span className="text-red-500">*</span><span className="text-xs text-gray-500 ml-2">(minimum 4 characters)</span>
                </label>
                <textarea
                  value={formData.rejectionReason}
                  onChange={(e) => setFormData(prev => ({
                    ...prev,
                    rejectionReason: e.target.value
                  }))}
                  rows={4}
                  maxLength={500}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                  placeholder="Explain in detail why this case closure is being rejected and what additional investigation is required (minimum 20 characters)..."
                  disabled={isSubmitting}
                />
                <div className="mt-1 flex justify-between">
                  <p className="text-xs text-gray-500">
                    {formData.rejectionReason.length}/4 characters minimum
                  </p>
                  <p className="text-xs text-gray-500">
                    {formData.rejectionReason.length}/500 characters
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
            </form>
          )}
        </div>

        {/* Footer with Action Buttons */}
        <div className="px-6 py-4 border-t border-gray-200 flex justify-end gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={handleClose}
            disabled={isSubmitting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Cancel
          </button>

          {activeTab === 'approve' && (
            <button
              type="button"
              onClick={handleApproveSubmit}
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
          )}

          {activeTab === 'reject' && (
            <button
              type="button"
              onClick={handleRejectSubmit}
              disabled={isSubmitting || formData.rejectionReason.trim().length < 4}
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
          )}
        </div>
      </div>
    </div>
  );
};

export default CaseClosureDecisionModal;
