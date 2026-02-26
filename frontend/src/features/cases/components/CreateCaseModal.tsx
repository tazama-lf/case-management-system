import React from 'react';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
} from '@heroicons/react/24/outline';
import triageService from '@/features/alerts/services/triageservice';
import type { Alert } from '@/features/alerts/types/triage.types';
import LinkExistingAlertsTab from './LinkExistingAlerts';
import authService from '../../auth/services/authService';

export type PredictionOutcome =
  | 'FALSE_POSITIVE'
  | 'TRUE_POSITIVE'
  | 'FALSE_NEGATIVE'
  | 'TRUE_NEGATIVE';
export type Priority = 'NEW' | 'URGENT' | 'CRITICAL' | 'BREACH';
export type AlertType = 'FRAUD' | 'AML' | 'FRAUD_AND_AML';
export type CaseStatus =
  | 'STATUS_00_DRAFT'
  | 'STATUS_01_PENDING_CASE_CREATION_APPROVAL'
  | 'STATUS_02_READY_FOR_ASSIGNMENT'
  | 'STATUS_03_RETURNED'
  | 'STATUS_10_ASSIGNED'
  | 'STATUS_20_IN_PROGRESS'
  | 'STATUS_21_SUSPENDED'
  | 'STATUS_22_PENDING_FINAL_APPROVAL'
  | 'STATUS_30_PENDING_REOPENING'
  | 'STATUS_31_REOPENED'
  | 'STATUS_71_AUTOCLOSED_CONFIRMED'
  | 'STATUS_72_AUTOCLOSED_REFUTED'
  | 'STATUS_81_CLOSED_REFUTED'
  | 'STATUS_82_CLOSED_CONFIRMED'
  | 'STATUS_83_CLOSED_INCONCLUSIVE'
  | 'STATUS_99_ABANDONED';

interface CreateCaseModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: {
    alertId?: number;
    priority: Priority;
    priorityScore: number;
    alertType: AlertType;
    assignee?: string;
    draft?: boolean;
  }) => void;
  onUpdate?: (
    caseId: number,
    payload: {
      priority: Priority;
      priorityScore: number;
      alertType: AlertType;
      assignee?: string;
      confidence: number;
      predictionOutcome?: PredictionOutcome;
      note: string;
      status: CaseStatus;
    },
  ) => void;
  onCompleteCase: (
    caseId: number,
    payload: {
      priority: Priority;
      priorityScore: number;
      alertType: AlertType;
      assignee?: string;
      confidence: number;
      predictionOutcome?: PredictionOutcome;
      note: string;
      status: CaseStatus;
    },
  ) => void;
  onSaveDraft?: (payload: {
    alertId?: number;
    priority: Priority;
    priorityScore: number;
    alertType: AlertType;
    assignee?: string;
    draft?: boolean;
  }) => void;
  loading?: boolean;
  error?: string;
  mode?: 'create' | 'edit';
  existingCaseId?: number;
  initial?: {
    alertId?: number;
    priority?: Priority;
    priorityScore?: number;
    alertType?: AlertType;
    assignee?: string;
    confidence?: number;
    predictionOutcome?: PredictionOutcome;
    note?: string;
    status?: CaseStatus;
  };
}

const CreateCaseModal: React.FC<CreateCaseModalProps> = ({
  open,
  onClose,
  onCreate,
  onSaveDraft = () => {},
  onUpdate,
  onCompleteCase,
  loading,
  error,
  mode = 'create',
  existingCaseId,
  initial,
}) => {
  const [availableAlerts, setAvailableAlerts] = React.useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = React.useState<Alert | null>(null);
  const [alertSearchTerm, setAlertSearchTerm] = React.useState('');
  const [alertsPagination, setAlertsPagination] = React.useState({
    currentPage: 1,
    totalPages: 0,
    totalItems: 0,
    pageSize: 10,
  });

  const [status, setStatus] = React.useState<CaseStatus>(
    'STATUS_02_READY_FOR_ASSIGNMENT',
  );
  const [predictionOutcome, setPredictionOutcome] = React.useState<
    'FALSE_POSITIVE' | 'TRUE_POSITIVE' | 'FALSE_NEGATIVE' | 'TRUE_NEGATIVE'
  >('FALSE_POSITIVE');
  const [note, setNote] = React.useState('');
  const [priority, setPriority] = React.useState<Priority>('NEW');
  const [confidence, setConfidence] = React.useState<number>(0);
  const [priorityScore, setPriorityScore] = React.useState<number>(0.33);
  const [alertType, setAlertType] = React.useState<AlertType>('FRAUD');
  const [assignee, setAssignee] = React.useState('');
  const [validationErrors, setValidationErrors] = React.useState<
    Record<string, string>
  >({});

  const calculatePriority = (score: number): Priority => {
    if (score >= 1.0) return 'BREACH';
    if (score >= 0.66) return 'CRITICAL';
    if (score >= 0.33) return 'URGENT';
    return 'NEW';
  };

  React.useEffect(() => {
    const newPriority = calculatePriority(priorityScore);
    setPriority(newPriority);
  }, [priorityScore]);

  React.useEffect(() => {
    if (!open) return;

    const loadNALTAlerts = async () => {
      try {
        const response = await triageService.getNALTAlerts(undefined, {
          page: alertsPagination.currentPage,
          limit: alertsPagination.pageSize,
          sortBy: 'created_at',
          sortOrder: 'desc',
        });
        setAvailableAlerts(response.alerts);
        setAlertsPagination(response.pagination);
      } catch (error) {
        console.error('Failed to load NALT alerts:', error);
      }
    };

    loadNALTAlerts();
  }, [open]);

  React.useEffect(() => {
    if (!open) return;

    setSelectedAlert(null);
    setPriorityScore(initial?.priorityScore || 0.33);
    setConfidence(initial?.confidence || 0);
    setStatus('STATUS_02_READY_FOR_ASSIGNMENT');
    setAlertType(initial?.alertType || 'FRAUD');
    setAssignee(initial?.assignee || '');
    setValidationErrors({});
    setNote('');
    setAlertSearchTerm('');
  }, [open, initial]);

  React.useEffect(() => {
    if (
      initial?.alertId &&
      availableAlerts.length > 0 &&
      !selectedAlert &&
      open
    ) {
      const alert = availableAlerts.find((a) => a.alert_id === initial.alertId);
      if (alert) {
        setSelectedAlert(alert);
        setAlertSearchTerm(alert.alert_id.toString());
      }
    }
  }, [availableAlerts, initial?.alertId, selectedAlert, open]);

  React.useEffect(() => {
    if (!open) return;

    const timeoutId = setTimeout(async () => {
      if (alertSearchTerm.length === 0) {
        try {
          const response = await triageService.getNALTAlerts(undefined, {
            page: 1,
            limit: alertsPagination.pageSize,
            sortBy: 'created_at',
            sortOrder: 'desc',
          });
          setAvailableAlerts(response.alerts);
          setAlertsPagination(response.pagination);
        } catch (error) {
          console.error('Failed to load alerts:', error);
        }
      } else if (alertSearchTerm.length >= 1) {
        try {
          const response = await triageService.getNALTAlerts(alertSearchTerm, {
            page: 1,
            limit: alertsPagination.pageSize,
            sortBy: 'created_at',
            sortOrder: 'desc',
          });
          setAvailableAlerts(response.alerts);
          setAlertsPagination(response.pagination);
        } catch (error) {
          console.error('Failed to search alerts:', error);
        }
      }
    }, 300);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [alertSearchTerm, open]);

  // React.useEffect(() => {
  //   const handleClickOutside = (event: MouseEvent) => {
  //     const target = event.target as Element;
  //     if (target && !target.closest('[data-alert-dropdown]')) {
  //       setShowAlertDropdown(false);
  //     }
  //   };

  //   document.addEventListener('mousedown', handleClickOutside);
  //   return () => {
  //     document.removeEventListener('mousedown', handleClickOutside);
  //   };
  // }, []);

  const isStatusLocked = alertType === 'AML' || alertType === 'FRAUD_AND_AML';

  React.useEffect(() => {
    if (isStatusLocked) {
      setStatus('STATUS_02_READY_FOR_ASSIGNMENT');
    }
  }, [alertType]);

  if (!open) return null;

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (mode === 'create' && !selectedAlert) {
      errors.alertId = 'Please select an alert to create a case';
    }
    if ((mode === 'edit' && confidence < 0) || confidence > 100) {
      errors.confidence = 'Confidence must be between 0 and 100';
    }
    if (!alertType) {
      errors.alertType = 'Alert Type is required';
    }
    if (!priority) {
      errors.priority = 'Priority is required';
    }
    if (priorityScore < 0 || priorityScore > 1) {
      errors.priorityScore = 'Priority Score must be between 0 and 1';
    }

    if (!note.trim() && mode === 'edit') {
      errors.note = 'Note is required for manual triage';
    } else if (note.trim().length < 4 && mode === 'edit') {
      errors.note = 'Note must be at least 4 characters long';
    }

    return errors;
  };

  const canSubmit = Boolean(
    priority && alertType && (mode === 'edit' || selectedAlert),
  );

  const saveAsDraft = (draft = false) => {
    const errors = validateForm();

    if (Object.keys(errors).length > 0 && !draft) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    if (mode === 'edit' && onUpdate && existingCaseId) {
      onUpdate(existingCaseId, {
        priority,
        priorityScore,
        alertType,
        confidence,
        predictionOutcome,
        note,
        status,
        assignee: assignee || undefined,
      });
    } else {
      const alertIdToUse = selectedAlert?.alert_id;

      onSaveDraft({
        alertId: alertIdToUse,
        priority,
        priorityScore,
        alertType,
        assignee: assignee || undefined,
        draft,
      });
    }
  };

  const submit = (draft = false) => {
    const errors = validateForm();

    if (Object.keys(errors).length > 0 && !draft) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    if (mode === 'edit' && onUpdate && existingCaseId) {
      const currentUser = authService.getUser();
      const currentUserId = currentUser?.userId;

      onUpdate(existingCaseId, {
        priority,
        priorityScore,
        alertType,
        predictionOutcome,
        confidence,
        status,
        note,
        assignee: currentUserId || undefined,
      });
    } else {
      const alertIdToUse = selectedAlert?.alert_id;

      onCreate({
        alertId: alertIdToUse,
        priority,
        priorityScore,
        alertType,
        assignee: assignee || undefined,
        draft,
      });
    }
  };
  const completeCase = async () => {
    const errors = validateForm();

    if (Object.keys(errors).length > 0) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors({});

    if (existingCaseId) {
      onCompleteCase(existingCaseId, {
        priority,
        priorityScore,
        alertType,
        predictionOutcome,
        confidence,
        status,
        note,
        assignee: assignee || undefined,
      });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">
            {mode === 'edit' ? 'Complete Draft Case' : 'Create Manual Case'}
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {}
          {(error || Object.keys(validationErrors).length > 0) && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {error ? 'Error' : 'Please fix the following errors'}
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    {error && <p>{error || 'An error occurred'}</p>}
                    {Object.entries(validationErrors).map(
                      ([field, message]) => (
                        <p key={field}>• {message}</p>
                      ),
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {}
          {mode === 'edit' ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority
                    <span className="text-xs text-gray-500 ml-1">
                      (Auto-calculated)
                    </span>
                  </label>
                  <div
                    className={`w-full px-3 py-2 border rounded-md bg-gray-50 text-sm font-medium ${
                      priority === 'BREACH'
                        ? 'text-red-600 border-red-200'
                        : priority === 'CRITICAL'
                          ? 'text-orange-600 border-orange-200'
                          : priority === 'URGENT'
                            ? 'text-yellow-600 border-yellow-200'
                            : 'text-blue-600 border-blue-200'
                    }`}
                  >
                    {priority}
                  </div>
                </div>

                {}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confidence %<span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="number"
                    value={confidence}
                    onChange={(e) => {
                      setConfidence(Number(e.target.value));
                    }}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                      validationErrors.confidence
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-blue-500'
                    } ${loading ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    min={0}
                    max={100}
                    disabled={loading}
                    aria-describedby={
                      validationErrors.confidence
                        ? 'confidence-error'
                        : undefined
                    }
                  />
                  {validationErrors.confidence && (
                    <p
                      id="confidence-error"
                      className="text-red-500 text-xs mt-1"
                    >
                      {validationErrors.confidence}
                    </p>
                  )}
                </div>

                {}
                <div className="mb-4 md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Priority Score
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <div className="space-y-2">
                    <input
                      type="range"
                      value={priorityScore}
                      onChange={(e) => {
                        setPriorityScore(Number(e.target.value));
                      }}
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                      min={0}
                      max={1}
                      step={0.01}
                      disabled={loading}
                    />
                    <div className="flex justify-between text-xs text-gray-600">
                      <span>0.0 (NEW)</span>
                      <span>0.33 (URGENT)</span>
                      <span>0.66 (CRITICAL)</span>
                      <span>1.0 (BREACH)</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <input
                        type="number"
                        value={priorityScore}
                        onChange={(e) => {
                          setPriorityScore(Number(e.target.value));
                        }}
                        className={`w-24 px-2 py-1 border rounded text-sm ${
                          validationErrors.priorityScore
                            ? 'border-red-300 focus:ring-red-500'
                            : 'border-gray-300 focus:ring-blue-500'
                        } ${loading ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                        min={0}
                        max={1}
                        step={0.01}
                        disabled={loading}
                      />
                      <span
                        className={`text-sm font-medium px-2 py-1 rounded ${
                          priority === 'BREACH'
                            ? 'text-red-600 bg-red-50'
                            : priority === 'CRITICAL'
                              ? 'text-orange-600 bg-orange-50'
                              : priority === 'URGENT'
                                ? 'text-yellow-600 bg-yellow-50'
                                : 'text-blue-600 bg-blue-50'
                        }`}
                      >
                        → {priority}
                      </span>
                    </div>
                  </div>
                  {validationErrors.priorityScore && (
                    <p className="text-red-500 text-xs mt-1">
                      {validationErrors.priorityScore}
                    </p>
                  )}
                </div>

                {}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Alert Type
                  </label>
                  <select
                    value={alertType || ''}
                    onChange={(e) => {
                      setAlertType(e.target.value as AlertType);
                    }}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      loading ? 'bg-gray-50 cursor-not-allowed' : ''
                    }`}
                    disabled={loading}
                  >
                    <option value="">Select type</option>
                    <option value="FRAUD">Fraud</option>
                    <option value="AML">AML</option>
                    <option value="FRAUD_AND_AML">Fraud and AML</option>
                  </select>
                </div>

                {}

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Prediction Outcome
                  </label>
                  <select
                    value={predictionOutcome}
                    onChange={(e) => {
                      setPredictionOutcome(
                        e.target.value as
                          | 'FALSE_POSITIVE'
                          | 'TRUE_POSITIVE'
                          | 'FALSE_NEGATIVE'
                          | 'TRUE_NEGATIVE',
                      );
                    }}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      loading ? 'bg-gray-50 cursor-not-allowed' : ''
                    }`}
                    disabled={loading}
                  >
                    <option value="FALSE_POSITIVE">False Positive</option>
                    <option value="TRUE_POSITIVE">True Positive</option>
                    <option value="FALSE_NEGATIVE">False Negative</option>
                    <option value="TRUE_NEGATIVE">True Negative</option>
                  </select>
                </div>
              </div>
              {}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Case Status
                </label>
                <select
                  value={status}
                  onChange={(e) => {
                    setStatus(e.target.value as CaseStatus);
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    loading || isStatusLocked
                      ? 'bg-gray-50 cursor-not-allowed'
                      : ''
                  }`}
                  disabled={loading || isStatusLocked}
                >
                  <option value="STATUS_02_READY_FOR_ASSIGNMENT">
                    Ready for Assignment (Investigation)
                  </option>
                  <option value="STATUS_82_CLOSED_CONFIRMED">
                    Closed - Confirmed
                  </option>
                  <option value="STATUS_81_CLOSED_REFUTED">
                    Closed - Refuted
                  </option>
                  <option value="STATUS_83_CLOSED_INCONCLUSIVE">
                    Closed - Inconclusive
                  </option>
                </select>
              </div>
              {}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                  <span className="text-red-500 ml-1">*</span>
                  <span className="text-xs text-gray-500 ml-2">
                    (minimum 4 characters)
                  </span>
                </label>
                <textarea
                  value={note}
                  onChange={(e) => {
                    setNote(e.target.value);
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 resize-none ${
                    validationErrors.note
                      ? 'border-red-300 focus:ring-red-500'
                      : 'border-gray-300 focus:ring-blue-500'
                  } ${loading ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                  rows={4}
                  placeholder="Provide detailed reasoning for your triage decision (e.g., why this is suspicious, what patterns were identified, supporting evidence)..."
                  disabled={loading}
                  maxLength={500}
                  aria-describedby={
                    validationErrors.note ? 'note-error' : 'note-help'
                  }
                />
                <div className="flex justify-between items-center mt-1">
                  <div>
                    {validationErrors.note && (
                      <p id="note-error" className="text-red-500 text-xs">
                        {validationErrors.note}
                      </p>
                    )}
                    {!validationErrors.note && (
                      <p id="note-help" className="text-gray-500 text-xs">
                        Detailed notes help with case investigation and audit
                        trails
                      </p>
                    )}
                  </div>
                  <span
                    className={`text-xs ${note.length >= 500 ? 'text-red-500' : 'text-gray-500'}`}
                  >
                    {note.length}/500
                  </span>
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Link Existing Alerts Section */}
              <LinkExistingAlertsTab
                selectedAlerts={selectedAlert ? [selectedAlert] : []}
                onAlertsChange={(alerts) => {
                  setSelectedAlert(
                    alerts.length > 0 ? alerts[alerts.length - 1] : null,
                  );
                }}
                isVisible={true}
                onAlertsSelected={(_hasAlerts) => {}}
              />

              {/* Transaction Data Display */}
              {selectedAlert?.transaction && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Transaction Data
                  </label>
                  <div className="w-full p-4 border border-gray-300 rounded-md bg-gray-50 max-h-64 overflow-y-auto">
                    <pre className="text-xs text-gray-700 font-mono whitespace-pre-wrap break-words">
                      {typeof selectedAlert.transaction === 'string'
                        ? selectedAlert.transaction
                        : JSON.stringify(selectedAlert.transaction, null, 2)}
                    </pre>
                  </div>
                </div>
              )}

              {/* Alert Type */}
              <div className="space-y-2">
                <label
                  htmlFor="alert-type"
                  className="block text-sm font-medium text-gray-700"
                >
                  Alert Type *
                </label>
                <select
                  id="alert-type"
                  value={alertType}
                  onChange={(e) => {
                    setAlertType(e.target.value as AlertType);
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                    validationErrors.alertType
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300'
                  }`}
                >
                  <option value="FRAUD">Fraud</option>
                  <option value="AML">AML</option>
                  <option value="FRAUD_AND_AML">Fraud & AML</option>
                  {/* <option value="NONE">None</option> */}
                </select>
                {validationErrors.alertType && (
                  <p className="text-sm text-red-600 mt-1">
                    {validationErrors.alertType}
                  </p>
                )}
              </div>

              {/* Priority Score */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Priority Score *
                  <span className="text-xs text-gray-500 ml-1">
                    (Auto-calculates Priority)
                  </span>
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    value={priorityScore}
                    onChange={(e) => {
                      setPriorityScore(Number(e.target.value));
                    }}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    min={0}
                    max={1}
                    step={0.01}
                  />
                  <div className="flex justify-between text-xs text-gray-600">
                    <span>0.0 (NEW)</span>
                    <span>0.33 (URGENT)</span>
                    <span>0.66 (CRITICAL)</span>
                    <span>1.0 (BREACH)</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <input
                      type="number"
                      value={priorityScore}
                      onChange={(e) => {
                        setPriorityScore(Number(e.target.value));
                      }}
                      className={`w-24 px-2 py-1 border rounded text-sm focus:ring-blue-500 focus:border-blue-500 ${
                        validationErrors.priorityScore
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300'
                      }`}
                      min={0}
                      max={1}
                      step={0.01}
                    />
                    <span
                      className={`text-sm font-medium px-2 py-1 rounded ${
                        priority === 'BREACH'
                          ? 'text-red-600 bg-red-50'
                          : priority === 'CRITICAL'
                            ? 'text-orange-600 bg-orange-50'
                            : priority === 'URGENT'
                              ? 'text-yellow-600 bg-yellow-50'
                              : 'text-blue-600 bg-blue-50'
                      }`}
                    >
                      → {priority}
                    </span>
                  </div>
                </div>
                {validationErrors.priorityScore && (
                  <p className="text-sm text-red-600 mt-1">
                    {validationErrors.priorityScore}
                  </p>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Priority
                  <span className="text-xs text-gray-500 ml-1">
                    (Auto-calculated)
                  </span>
                </label>
                <div
                  className={`w-full px-3 py-2 border rounded-md bg-gray-50 text-sm font-medium ${
                    priority === 'BREACH'
                      ? 'text-red-600 border-red-200'
                      : priority === 'CRITICAL'
                        ? 'text-orange-600 border-orange-200'
                        : priority === 'URGENT'
                          ? 'text-yellow-600 border-yellow-200'
                          : 'text-blue-600 border-blue-200'
                  }`}
                >
                  {priority}
                </div>
              </div>
            </>
          )}
        </div>

        {}
        <div className="flex items-center justify-between px-6 py-4">
          {mode === 'create' && (
            <button
              onClick={() => {
                saveAsDraft(true);
              }}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save as Draft'}
            </button>
          )}
          {mode === 'edit' && <div></div>}
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              onClick={async () => {
                mode === 'edit' ? await completeCase() : submit(false);
              }}
              disabled={loading || !canSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading
                ? mode === 'edit'
                  ? 'Updating...'
                  : 'Creating...'
                : mode === 'edit'
                  ? 'Complete Case'
                  : 'Create Case'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCaseModal;
