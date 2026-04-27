import React, { useState } from 'react';
import { XMarkIcon, XCircleIcon } from '@heroicons/react/24/outline';
import type { RejectCaseCreationDto } from '../services/caseService';
import type { CaseRow } from './casesTable.utils';
import type { Alert } from '@/features/alerts/types/triage.types';
import { triageService } from '@/features/alerts';
import { formatDate } from '@/shared/utils/dateUtils';

interface RejectCaseCreationModalProps {
  open: boolean;
  onClose: () => void;
  caseData: CaseRow | null;
  onSubmit: (caseId: number, data: RejectCaseCreationDto) => Promise<void>;
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
  const [loadingAlert, setLoadingAlert] = useState(false);
  const [alertDetails, setAlertDetails] = useState<Alert | null>(null);

  const isReasonValid = reason.trim().length >= 4;

  React.useEffect(() => {
    const fetchAlertDetails = async () => {
      if (open && caseData?.alertId) {
        setLoadingAlert(true);
        try {
          const alert = await triageService.getAlertById(caseData.alertId);
          setAlertDetails(alert);
        } catch (error) {
          console.error('Failed to fetch alert details:', error);
        } finally {
          setLoadingAlert(false);
        }
      }
    };

    fetchAlertDetails();
  }, [open, caseData?.alertId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!caseData) return;

    if (!isReasonValid) {
      setErrors({ reason: 'Rejection reason must be at least 4 characters' });
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

  const transactionData =
    alertDetails?.transaction &&
    typeof alertDetails.transaction === 'object' &&
    alertDetails.transaction !== null
      ? alertDetails.transaction
      : null;

  if (!open || !caseData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
      <div className="w-full max-w-3xl max-h-[90vh] rounded-lg bg-white shadow-xl flex flex-col my-8">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 flex-shrink-0">
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
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto">
          <div className="p-6">
            {/* Workflow Information */}
            <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
              <h4 className="text-sm font-medium text-red-800 mb-2">
                Case Creation Rejection
              </h4>
              <p className="text-xs text-red-700">
                Rejecting this case will return it to draft status for the
                creator to revise with your feedback.
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
                    <span className="text-sm break-words">
                      {caseData.status}
                    </span>
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
                {loadingAlert ? (
                  <div className="rounded-md border border-gray-300 p-4 bg-gray-50">
                    <div className="flex items-center justify-center">
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-gray-400 border-t-transparent"></div>
                      <span className="ml-2 text-sm text-gray-500">
                        Loading alert details...
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-md border border-gray-300 p-3 bg-gray-50 max-h-64 overflow-y-auto space-y-3">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Alert ID
                        </label>
                        <span className="text-sm break-words">
                          {caseData.alertId}
                        </span>
                      </div>
                      {alertDetails && (
                        <>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Confidence Score
                            </label>
                            <span className="text-sm">
                              {alertDetails.confidence_per?.toFixed(2)}%
                            </span>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Alert Type
                            </label>
                            <span className="text-sm">
                              {alertDetails.alert_type ?? 'N/A'}
                            </span>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Source
                            </label>
                            <span className="text-sm">
                              {alertDetails.source ?? 'N/A'}
                            </span>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Priority
                            </label>
                            <span className="text-sm">
                              {alertDetails.priority}
                            </span>
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-gray-500 mb-1">
                              Created At
                            </label>
                            <span className="text-sm">
                              {formatDate(alertDetails.created_at)}
                            </span>
                          </div>
                          {alertDetails.prediction_outcome && (
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">
                                Prediction Outcome
                              </label>
                              <span className="text-sm">
                                {alertDetails.prediction_outcome}
                              </span>
                            </div>
                          )}
                          {alertDetails.txtp && (
                            <div>
                              <label className="block text-xs font-medium text-gray-500 mb-1">
                                Transaction Type
                              </label>
                              <span className="text-sm">
                                {alertDetails.txtp}
                              </span>
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    {alertDetails?.message && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Alert Message
                        </label>
                        <p className="text-sm text-gray-700 break-words">
                          {alertDetails.message}
                        </p>
                      </div>
                    )}
                    {transactionData && (
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">
                          Transaction Data
                        </label>
                        <div className="rounded bg-gray-100 p-2">
                          <pre className="text-xs text-gray-700 whitespace-pre-wrap break-words">
                            {JSON.stringify(transactionData, null, 2)}
                          </pre>
                        </div>
                      </div>
                    )}
                    {!alertDetails && !loadingAlert && (
                      <div className="text-sm text-gray-500">
                        Unable to load alert details
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Rejection Reason */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Rejection Reason <span className="text-red-500">*</span>
                <span className="text-xs text-gray-500 ml-2">
                  (minimum 4 characters)
                </span>
              </label>
              <textarea
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value);
                  if (e.target.value.trim().length >= 4) {
                    setErrors({});
                  }
                }}
                rows={3}
                maxLength={500}
                className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
                placeholder="Provide feedback on what needs to be corrected..."
                disabled={isSubmitting}
              />
              <div className="mt-1 flex justify-between">
                <p className="text-xs text-gray-500">
                  {reason.length}/4 characters minimum
                </p>
                <p className="text-xs text-gray-500">
                  {reason.length}/500 characters
                </p>
              </div>
              {errors.reason && (
                <p className="mt-1 text-sm text-red-600">{errors.reason}</p>
              )}
              {!isReasonValid && reason.length > 0 && (
                <p className="mt-1 text-sm text-red-600">
                  Rejection reason must be at least 4 characters
                </p>
              )}
            </div>

            {}
            {errors.submit && (
              <div className="mb-4 rounded-md bg-red-50 border border-red-200 p-3">
                <p className="text-sm text-red-600">{errors.submit}</p>
              </div>
            )}
          </div>
        </form>

        {}
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-200 bg-gray-50 flex-shrink-0">
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
            onClick={handleSubmit}
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
      </div>
    </div>
  );
};

export default RejectCaseCreationModal;
