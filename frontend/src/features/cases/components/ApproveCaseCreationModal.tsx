import React, { useState, useEffect } from 'react';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from './casesTable.utils';
import { getCaseStatusBadge } from '@/shared/constants/case.constant';
import triageService from '@/features/alerts/services/triageservice';
import type { Alert } from '@/features/alerts/types/triage.types';

interface ApproveCaseCreationModalProps {
  open: boolean;
  onClose: () => void;
  caseData: CaseRow | null;
  onSubmit: (caseId: number) => Promise<void>;
}

const ApproveCaseCreationModal: React.FC<ApproveCaseCreationModalProps> = ({
  open,
  onClose,
  caseData,
  onSubmit,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [alertDetails, setAlertDetails] = useState<Alert | null>(null);
  const [loadingAlert, setLoadingAlert] = useState(false);

  useEffect(() => {
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

    setIsSubmitting(true);
    try {
      await onSubmit(caseData.id);
      onClose();
    } catch (error) {
      console.error('Failed to approve case creation:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to approve case creation. Please try again.';
      setErrors({ submit: errorMessage });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      onClose();
      setErrors({});
      setAlertDetails(null);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
        { }
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">
              Approve Case Creation
            </h3>
            <p className="text-sm text-gray-500">
              Case ID: {caseData.id} • {caseData.type}
            </p>
            <p className="text-xs text-green-600 mt-1">
              This will approve the manual case creation request
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

        { }
        <form onSubmit={handleSubmit} className="p-6">
          { }

          { }
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
                    {getCaseStatusBadge(caseData.status)}
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

          { }
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
                <div className="rounded-md border border-gray-300 p-3 bg-gray-50 max-h-96 overflow-y-auto space-y-3">
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
                            {alertDetails.alert_type || 'N/A'}
                          </span>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-500 mb-1">
                            Source
                          </label>
                          <span className="text-sm">
                            {alertDetails.source || 'N/A'}
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
                            {new Date(alertDetails.created_at).toLocaleString()}
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
                            <span className="text-sm">{alertDetails.txtp}</span>
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
                  Approve Case Creation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ApproveCaseCreationModal;