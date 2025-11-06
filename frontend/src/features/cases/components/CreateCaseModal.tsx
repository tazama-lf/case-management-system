import React from 'react';
import { XMarkIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import triageService from '@/features/alerts/services/triageservice';
import type { Alert } from '@/features/alerts/types/triage.types';
import LinkExistingAlertsTab from './LinkExistingAlerts';

export type Priority = 'NEW' | 'URGENT' | 'CRITICAL' | 'BREACH';
export type AlertType = 'FRAUD' | 'AML' | 'FRAUD_AND_AML' | 'NONE';

interface CreateCaseModalProps {
  open: boolean;
  onClose: () => void;
  onCreate: (payload: {
    alertId?: string;
    priority: Priority;
    priorityScore: number;
    alertType: AlertType;
    assignee?: string;
    draft?: boolean;
  }) => void;
  onUpdate?: (caseId: string, payload: {
    priority: Priority;
    priorityScore: number;
    alertType: AlertType;
    assignee?: string;
  }) => void;
  loading?: boolean;
  error?: string;
  mode?: 'create' | 'edit';
  existingCaseId?: string;
  initial?: {
    alertId?: string;
    priority?: Priority;
    priorityScore?: number;
    alertType?: AlertType;
    assignee?: string;
  };
}

const CreateCaseModal: React.FC<CreateCaseModalProps> = ({
  open,
  onClose,
  onCreate,
  onUpdate,
  loading,
  error,
  mode = 'create',
  existingCaseId,
  initial
}) => {

  const [availableAlerts, setAvailableAlerts] = React.useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = React.useState<Alert | null>(null);
  const [alertSearchTerm, setAlertSearchTerm] = React.useState('');
  const [_isLoadingAlerts, setIsLoadingAlerts] = React.useState(false);
  const [_showAlertDropdown, setShowAlertDropdown] = React.useState(false);
  const [_alertSearchError, setAlertSearchError] = React.useState<string>('');

  const [priority, setPriority] = React.useState<Priority>('NEW');
  const [priorityScore, setPriorityScore] = React.useState<number>(0.33);
  const [alertType, setAlertType] = React.useState<AlertType>('FRAUD');
  const [assignee, setAssignee] = React.useState('');
  const [validationErrors, setValidationErrors] = React.useState<Record<string, string>>({});

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
      setIsLoadingAlerts(true);
      setAlertSearchError('');
      try {
        const alerts = await triageService.getNALTAlerts();
        setAvailableAlerts(alerts);
      } catch (error) {
        console.error('Failed to load NALT alerts:', error);
        setAlertSearchError('Failed to load available alerts');
      } finally {
        setIsLoadingAlerts(false);
      }
    };

    loadNALTAlerts();
  }, [open]);


  React.useEffect(() => {
    if (!open) return;

    setSelectedAlert(null);
    setPriorityScore(initial?.priorityScore || 0.33);
    setAlertType(initial?.alertType || 'FRAUD');
    setAssignee(initial?.assignee || '');
    setValidationErrors({});
    setAlertSearchTerm('');
  }, [open, initial]);

  React.useEffect(() => {
    if (initial?.alertId && availableAlerts.length > 0 && !selectedAlert && open) {
      const alert = availableAlerts.find(a => a.alert_id === initial.alertId);
      if (alert) {
        setSelectedAlert(alert);
        setAlertSearchTerm(alert.alert_id);
      }
    }
  }, [availableAlerts, initial?.alertId, selectedAlert, open]);

  React.useEffect(() => {
    if (!open) return;

    const timeoutId = setTimeout(async () => {
      if (alertSearchTerm.length === 0) {
        setIsLoadingAlerts(true);
        try {
          const alerts = await triageService.getNALTAlerts();
          setAvailableAlerts(alerts);
        } catch (error) {
          console.error('Failed to load alerts:', error);
          setAlertSearchError('Failed to load alerts');
        } finally {
          setIsLoadingAlerts(false);
        }
      } else if (alertSearchTerm.length >= 1) {
        setIsLoadingAlerts(true);
        setAlertSearchError('');
        try {
          const alerts = await triageService.getNALTAlerts(alertSearchTerm);
          setAvailableAlerts(alerts);
        } catch (error) {
          console.error('Failed to search alerts:', error);
          setAlertSearchError('Failed to search alerts');
        } finally {
          setIsLoadingAlerts(false);
        }
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [alertSearchTerm, open]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (target && !target.closest('[data-alert-dropdown]')) {
        setShowAlertDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);


  if (!open) return null;

  const validateForm = (): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (mode === 'create' && !selectedAlert) {
      errors.alertId = 'Please select an alert to create a case';
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
    return errors;
  };

  const canSubmit = Boolean(
    priority &&
    alertType &&
    (mode === 'edit' || selectedAlert)
  );

  const submit = (draft = false) => {
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
        assignee: assignee || undefined,
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
                    {error && <p>{error}</p>}
                    {Object.entries(validationErrors).map(([field, message]) => (
                      <p key={field}>• {message}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {}
          {mode === 'edit' ? (
            <>
              {}
              <div className="space-y-2">
                <label htmlFor="alert-type" className="block text-sm font-medium text-gray-700">
                  Alert Type *
                </label>
                <select
                  id="alert-type"
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value as AlertType)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                    validationErrors.alertType
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300'
                  }`}
                >
                  <option value="FRAUD">Fraud</option>
                  <option value="AML">AML</option>
                  <option value="FRAUD_AND_AML">Fraud & AML</option>
                  <option value="NONE">None</option>
                </select>
                {validationErrors.alertType && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.alertType}</p>
                )}
              </div>

              {}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Priority Score *
                  <span className="text-xs text-gray-500 ml-1">(Auto-calculates Priority)</span>
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    value={priorityScore}
                    onChange={(e) => setPriorityScore(Number(e.target.value))}
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
                      onChange={(e) => setPriorityScore(Number(e.target.value))}
                      className={`w-24 px-2 py-1 border rounded text-sm focus:ring-blue-500 focus:border-blue-500 ${
                        validationErrors.priorityScore
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300'
                      }`}
                      min={0}
                      max={1}
                      step={0.01}
                    />
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      priority === 'BREACH' ? 'text-red-600 bg-red-50' :
                      priority === 'CRITICAL' ? 'text-orange-600 bg-orange-50' :
                      priority === 'URGENT' ? 'text-yellow-600 bg-yellow-50' :
                      'text-blue-600 bg-blue-50'
                    }`}>
                      → {priority}
                    </span>
                  </div>
                </div>
                {validationErrors.priorityScore && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.priorityScore}</p>
                )}
              </div>

              {}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Priority
                  <span className="text-xs text-gray-500 ml-1">(Auto-calculated)</span>
                </label>
                <div className={`w-full px-3 py-2 border rounded-md bg-gray-50 text-sm font-medium ${
                  priority === 'BREACH' ? 'text-red-600 border-red-200' :
                  priority === 'CRITICAL' ? 'text-orange-600 border-orange-200' :
                  priority === 'URGENT' ? 'text-yellow-600 border-yellow-200' :
                  'text-blue-600 border-blue-200'
                }`}>
                  {priority}
                </div>
              </div>

              {}
              <div className="space-y-2">
                <label htmlFor="assignee" className="block text-sm font-medium text-gray-700">
                  Assignee
                </label>
                <input
                  id="assignee"
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Leave empty for automatic assignment"
                />
              </div>
            </>
          ) : (
            <>
              {}
              <LinkExistingAlertsTab
                selectedAlerts={selectedAlert ? [selectedAlert] : []}
                onAlertsChange={(alerts) => {

                  setSelectedAlert(alerts.length > 0 ? alerts[alerts.length - 1] : null);
                }}
                isVisible={true}
                onAlertsSelected={(_hasAlerts) => {}}
              />

              {}
              <div className="space-y-2">
                <label htmlFor="alert-type" className="block text-sm font-medium text-gray-700">
                  Alert Type *
                </label>
                <select
                  id="alert-type"
                  value={alertType}
                  onChange={(e) => setAlertType(e.target.value as AlertType)}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-blue-500 focus:border-blue-500 ${
                    validationErrors.alertType
                      ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                      : 'border-gray-300'
                  }`}
                >
                  <option value="FRAUD">Fraud</option>
                  <option value="AML">AML</option>
                  <option value="FRAUD_AND_AML">Fraud & AML</option>
                  <option value="NONE">None</option>
                </select>
                {validationErrors.alertType && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.alertType}</p>
                )}
              </div>

              {}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Priority Score *
                  <span className="text-xs text-gray-500 ml-1">(Auto-calculates Priority)</span>
                </label>
                <div className="space-y-2">
                  <input
                    type="range"
                    value={priorityScore}
                    onChange={(e) => setPriorityScore(Number(e.target.value))}
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
                      onChange={(e) => setPriorityScore(Number(e.target.value))}
                      className={`w-24 px-2 py-1 border rounded text-sm focus:ring-blue-500 focus:border-blue-500 ${
                        validationErrors.priorityScore
                          ? 'border-red-300 focus:ring-red-500 focus:border-red-500'
                          : 'border-gray-300'
                      }`}
                      min={0}
                      max={1}
                      step={0.01}
                    />
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      priority === 'BREACH' ? 'text-red-600 bg-red-50' :
                      priority === 'CRITICAL' ? 'text-orange-600 bg-orange-50' :
                      priority === 'URGENT' ? 'text-yellow-600 bg-yellow-50' :
                      'text-blue-600 bg-blue-50'
                    }`}>
                      → {priority}
                    </span>
                  </div>
                </div>
                {validationErrors.priorityScore && (
                  <p className="text-sm text-red-600 mt-1">{validationErrors.priorityScore}</p>
                )}
              </div>

              {}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">
                  Priority
                  <span className="text-xs text-gray-500 ml-1">(Auto-calculated)</span>
                </label>
                <div className={`w-full px-3 py-2 border rounded-md bg-gray-50 text-sm font-medium ${
                  priority === 'BREACH' ? 'text-red-600 border-red-200' :
                  priority === 'CRITICAL' ? 'text-orange-600 border-orange-200' :
                  priority === 'URGENT' ? 'text-yellow-600 border-yellow-200' :
                  'text-blue-600 border-blue-200'
                }`}>
                  {priority}
                </div>
              </div>

              {}
              <div className="space-y-2">
                <label htmlFor="assignee" className="block text-sm font-medium text-gray-700">
                  Assignee
                </label>
                <input
                  id="assignee"
                  type="text"
                  value={assignee}
                  onChange={(e) => setAssignee(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  placeholder="Leave empty for automatic assignment"
                />
              </div>
            </>
          )}
        </div>

        {}
        <div className="flex items-center justify-between px-6 py-4">
          {mode === 'create' && (
            <button
              onClick={() => submit(true)}
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
              onClick={() => submit(false)}
              disabled={loading || !canSubmit}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (mode === 'edit' ? 'Updating...' : 'Creating...') : (mode === 'edit' ? 'Complete Case' : 'Create Case')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCaseModal;
