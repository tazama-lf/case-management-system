import React, { useState } from 'react';
import { XMarkIcon, CheckCircleIcon } from '@heroicons/react/24/outline';
import type { CaseRow } from './casesTable.utils';

interface ApproveCaseCreationModalProps {
  open: boolean;
  onClose: () => void;
  caseData: CaseRow | null;
  onSubmit: (caseId: string) => Promise<void>;
}

const ApproveCaseCreationModal: React.FC<ApproveCaseCreationModalProps> = ({
  open,
  onClose,
  caseData,
  onSubmit,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

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
    }
  };

  if (!open || !caseData) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-xl">
        {}
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

        {}
        <form onSubmit={handleSubmit} className="p-6">
          {}
          <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-green-800 mb-2">
              Supervisor Case Creation Approval Workflow
            </h4>
            <ul className="text-xs text-green-700 list-disc list-inside space-y-1">
              <li>
                Only cases in "PENDING CASE CREATION APPROVAL" can be acted on
              </li>
              <li>Supervisor may approve or reject with a detailed reason</li>
              <li>Approval transitions case to "READY FOR ASSIGNMENT"</li>
              <li>
                "Investigate Case" task will be created in Flowable
                investigations queue
              </li>
              <li>All approval actions must be logged</li>
            </ul>
          </div>

          {}
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

          {}
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

          {}
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-blue-800 mb-2">
              Approval Confirmation
            </h4>
            <p className="text-xs text-blue-700">
              By approving this case creation request, you confirm that:
            </p>
            <ul className="text-xs text-blue-700 list-disc list-inside space-y-1 mt-2">
              <li>The case information is complete and accurate</li>
              <li>The associated alert information is valid</li>
              <li>The case priority is appropriate</li>
              <li>The case will be assigned to an investigator</li>
            </ul>
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
