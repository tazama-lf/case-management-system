import React from 'react';
import { XMarkIcon, ExclamationTriangleIcon, MagnifyingGlassIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import triageService from '../../alerts/services/triageservice';
import type { Alert } from '../../alerts/types/triage.types';

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
  loading?: boolean;
  error?: string;
  initial?: {
    alertId?: string;
    priority?: Priority;
    priorityScore?: number;
    alertType?: AlertType;
    assignee?: string;
  };
}

const CreateCaseModal: React.FC<CreateCaseModalProps> = ({ open, onClose, onCreate, loading, error, initial }) => {
  const [availableAlerts, setAvailableAlerts] = React.useState<Alert[]>([]);
  const [selectedAlert, setSelectedAlert] = React.useState<Alert | null>(null);
  const [alertSearchTerm, setAlertSearchTerm] = React.useState('');
  const [isLoadingAlerts, setIsLoadingAlerts] = React.useState(false);
  const [showAlertDropdown, setShowAlertDropdown] = React.useState(false);
  const [alertSearchError, setAlertSearchError] = React.useState<string>('');

  const [priority, setPriority] = React.useState<Priority>('NEW');
  const [priorityScore, setPriorityScore] = React.useState<number>(0.33);
  const [alertType, setAlertType] = React.useState<AlertType>('FRAUD');
  const [assignee, setAssignee] = React.useState('');
  const [validationErrors, setValidationErrors] = React.useState<string[]>([]);

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
    setValidationErrors([]);
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
    }, 300); // 300ms debounce

    return () => clearTimeout(timeoutId);
  }, [alertSearchTerm, open]);

  const handleAlertSearch = (searchTerm: string) => {
    setAlertSearchTerm(searchTerm);
    setShowAlertDropdown(true);
  };

  const handleAlertSelect = (alert: Alert) => {
    setSelectedAlert(alert);
    setAlertSearchTerm(alert.alert_id);
    setShowAlertDropdown(false);
    
    if (alert.alert_type) {
      setAlertType(alert.alert_type as AlertType);
    }
  };

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

  const filteredAlerts = React.useMemo(() => {
    if (!alertSearchTerm || alertSearchTerm.length < 2) {
      return availableAlerts.slice(0, 10);
    }

    const searchTerm = alertSearchTerm.toLowerCase().replace(/[-\s]/g, ''); // Remove dashes and spaces for flexible matching
    
    return availableAlerts.filter(alert => {
      const alertIdClean = alert.alert_id.toLowerCase().replace(/[-\s]/g, '');
      
      const exactMatch = alert.alert_id.toLowerCase().includes(alertSearchTerm.toLowerCase());
      const partialMatch = alertIdClean.includes(searchTerm);
      const startsWithMatch = alertIdClean.startsWith(searchTerm);
      
      return exactMatch || partialMatch || startsWithMatch;
    }).sort((a, b) => {
      const aId = a.alert_id.toLowerCase();
      const bId = b.alert_id.toLowerCase();
      const search = alertSearchTerm.toLowerCase();
      
      const aStartsWith = aId.startsWith(search);
      const bStartsWith = bId.startsWith(search);
      
      if (aStartsWith && !bStartsWith) return -1;
      if (!aStartsWith && bStartsWith) return 1;
      
      return aId.localeCompare(bId);
    }).slice(0, 20); // Limit to 20 results for performance
  }, [availableAlerts, alertSearchTerm]);

  if (!open) return null;

  const validateForm = (): string[] => {
    const errors: string[] = [];
    if (!selectedAlert) errors.push('Alert selection is required');
    if (!alertType) errors.push('Alert Type is required');
    if (!priority) errors.push('Priority is required');
    if (priorityScore < 0 || priorityScore > 1) errors.push('Priority Score must be between 0 and 1');
    return errors;
  };

  const canCreate = Boolean(priority && alertType && selectedAlert);

  const submit = (draft = false) => {
    const errors = validateForm();
    if (errors.length > 0 && !draft) {
      setValidationErrors(errors);
      return;
    }
    setValidationErrors([]);

    onCreate({
      alertId: selectedAlert?.alert_id,
      priority,
      priorityScore,
      alertType,
      assignee: assignee || undefined,
      draft,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-white shadow-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4">
          <h2 className="text-xl font-semibold text-gray-900">Create Manual Case</h2>
          <button
            onClick={onClose}
            disabled={loading}
            className="p-2 hover:bg-gray-100 rounded-full disabled:opacity-50"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {/* Error Display */}
          {(error || validationErrors.length > 0) && (
            <div className="rounded-md bg-red-50 p-4">
              <div className="flex">
                <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">
                    {error ? 'Error' : 'Please fix the following errors'}
                  </h3>
                  <div className="mt-2 text-sm text-red-700">
                    {error && <p>{error}</p>}
                    {validationErrors.map((err, idx) => (
                      <p key={idx}>• {err}</p>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Alert Selection */}
          <div className="space-y-2" data-alert-dropdown>
            <label htmlFor="alert-search" className="block text-sm font-medium text-gray-700">
              Select Alert (NALT Status Only)
            </label>
            <div className="relative">
              <div className="relative">
                <input
                  id="alert-search"
                  type="text"
                  value={alertSearchTerm}
                  onChange={(e) => handleAlertSearch(e.target.value)}
                  onFocus={() => setShowAlertDropdown(true)}
                  placeholder="Search by Alert ID (min 2 chars, e.g., '837c88')..."
                  className="w-full pl-10 pr-10 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  autoComplete="off"
                />
                <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                <ChevronDownIcon 
                  className={`absolute right-3 top-2.5 h-5 w-5 text-gray-400 transition-transform ${showAlertDropdown ? 'rotate-180' : ''}`} 
                />
              </div>
              
              {/* Alert Dropdown */}
              {showAlertDropdown && (
                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                  {isLoadingAlerts ? (
                    <div className="px-4 py-2 text-sm text-gray-500">Loading alerts...</div>
                  ) : alertSearchError ? (
                    <div className="px-4 py-2 text-sm text-red-500">{alertSearchError}</div>
                  ) : filteredAlerts.length === 0 ? (
                    <div className="px-4 py-2 text-sm text-gray-500">No NALT alerts found</div>
                  ) : (
                    filteredAlerts.map((alert) => (
                      <button
                        key={alert.alert_id}
                        onClick={() => handleAlertSelect(alert)}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 focus:bg-gray-50 border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <div className="text-sm font-medium text-gray-900">{alert.alert_id}</div>
                            <div className="text-xs text-gray-500">
                              {alert.txtp && `Type: ${alert.txtp}`}
                              {alert.source && ` | Source: ${alert.source}`}
                              {alert.alert_type && ` | Alert Type: ${alert.alert_type}`}
                            </div>
                          </div>
                          <div className="text-xs text-gray-400">
                            Priority: {alert.priority}
                          </div>
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
            
            {selectedAlert && (
              <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <div className="text-sm">
                  <div className="font-medium text-blue-900">Selected Alert: {selectedAlert.alert_id}</div>
                  <div className="text-blue-700 mt-1">
                    {selectedAlert.txtp && `Type: ${selectedAlert.txtp} | `}
                    {selectedAlert.source && `Source: ${selectedAlert.source} | `}
                    Priority: {selectedAlert.priority}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Alert Type */}
          <div className="space-y-2">
            <label htmlFor="alert-type" className="block text-sm font-medium text-gray-700">
              Alert Type *
            </label>
            <select
              id="alert-type"
              value={alertType}
              onChange={(e) => setAlertType(e.target.value as AlertType)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="FRAUD">Fraud</option>
              <option value="AML">AML</option>
              <option value="FRAUD_AND_AML">Fraud & AML</option>
              <option value="NONE">None</option>
            </select>
          </div>

          {/* Priority Score with Visual Feedback */}
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
                  className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-blue-500 focus:border-blue-500"
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
          </div>

          {/* Priority - Read-only, calculated from score */}
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

          {/* Assignee */}
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
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4">
          <button
            onClick={() => submit(true)}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            {loading ? 'Saving...' : 'Save as Draft'}
          </button>
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
              disabled={loading || !canCreate}
              className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create Case'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateCaseModal;
