import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Alert, ManualTriageDto, Priority, AlertType, CaseStatus } from '../types/triage.types';
import { useSystemConfig } from '../../../shared/hooks/useSystemConfig';

interface ManualTriageModalProps {
  isOpen: boolean;
  alert: Alert;
  onClose: () => void;
  onSubmit: (data: ManualTriageDto) => Promise<void>;
}

const ManualTriageModal: React.FC<ManualTriageModalProps> = ({ isOpen, alert, onClose, onSubmit }) => {
  const { isManualMode, isDisabledMode } = useSystemConfig();

  const [priority, setPriority] = useState<Priority>(alert.priority);
  const [confidence, setConfidence] = useState(alert.confidence_per);
  const [priorityScore, setPriorityScore] = useState<number>(0.33);
  const [alertType, setAlertType] = React.useState<AlertType | undefined>(
    alert.alert_type || undefined
  );
  const [predictionOutcome, setPredictionOutcome] = useState<'FALSE_POSITIVE' | 'TRUE_POSITIVE' | 'FALSE_NEGATIVE' | 'TRUE_NEGATIVE'>('FALSE_POSITIVE');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<CaseStatus>('STATUS_81_CLOSED_REFUTED');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{[key: string]: string}>({});

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

  const validateForm = () => {
    const errors: {[key: string]: string} = {};

    if (!note.trim()) {
      errors.note = 'Note is required for manual triage';
    } else if (note.trim().length < 10) {
      errors.note = 'Note must be at least 10 characters long';
    }

    if (confidence < 0 || confidence > 100) {
      errors.confidence = 'Confidence must be between 0 and 100';
    }

    if (priorityScore < 0 || priorityScore > 1) {
      errors.priorityScore = 'Priority score must be between 0 and 1';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  React.useEffect(() => {
    if (note || confidence || priorityScore) {
      validateForm();
    }
  }, [note, confidence, priorityScore]);

  React.useEffect(() => {
    setPriority(alert.priority);
    setConfidence(alert.confidence_per);
    setPriorityScore(0.33);
    setAlertType(alert.alert_type || undefined);
    setNote('');
    setPredictionOutcome('FALSE_POSITIVE');
    setStatus('STATUS_81_CLOSED_REFUTED');
    setError(null);
    setValidationErrors({});
  }, [alert, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      setError('Please fix the validation errors before submitting');
      return;
    }

    setLoading(true);
    setError(null);
    setValidationErrors({});

    try {
            const triageData: ManualTriageDto = {
        confidence_per: confidence,
        priority,
        priorityScore,
        alertType,
        predictionOutcome,
        note,
        status,
      };

      await onSubmit(triageData);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to perform manual triage');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-gray-500 opacity-75 transition-opacity" onClick={onClose} aria-hidden="true"></div>
        <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all max-w-2xl w-full">
          <div className="bg-white px-6 py-6">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  {isManualMode ? "Update Alert" : "Update Alert"}: {alert.alert_id}
                </h3>
                <p className="text-sm text-gray-500 mt-1">
                  {isManualMode
                    ? "Review alert details and make triage decision with case routing"
                    : "Update alert information - direct investigation mode"
                  }
                </p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="text-gray-400 hover:text-gray-500"
              >
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                {error || 'An error occurred'}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Confidence %
                    <span className="text-red-500 ml-1">*</span>
                  </label>
                  <input
                    type="number"
                    value={confidence}
                    onChange={e => setConfidence(Number(e.target.value))}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 ${
                      validationErrors.confidence
                        ? 'border-red-300 focus:ring-red-500'
                        : 'border-gray-300 focus:ring-blue-500'
                    } ${loading ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                    min={0}
                    max={100}
                    disabled={loading}
                    aria-describedby={validationErrors.confidence ? 'confidence-error' : undefined}
                  />
                  {validationErrors.confidence && (
                    <p id="confidence-error" className="text-red-500 text-xs mt-1">{validationErrors.confidence}</p>
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
                      onChange={e => setPriorityScore(Number(e.target.value))}
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
                        onChange={e => setPriorityScore(Number(e.target.value))}
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
                    <p className="text-red-500 text-xs mt-1">{validationErrors.priorityScore}</p>
                  )}
                </div>

                {}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alert Type</label>
                  <select
                    value={alertType || ''}
                    onChange={e => setAlertType(e.target.value as AlertType)}
                    className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                      loading ? 'bg-gray-50 cursor-not-allowed' : ''
                    }`}
                    disabled={loading}
                  >
                    <option value="">Select type</option>
                    <option value="FRAUD">Fraud</option>
                    <option value="AML">AML</option>
                    <option value="FRAUD_AND_AML">Fraud and AML</option>
                    <option value="NONE">None</option>
                  </select>
                </div>

              {}
              {isManualMode && !isDisabledMode && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Prediction Outcome</label>
                  <select
                    value={predictionOutcome}
                    onChange={e => setPredictionOutcome(e.target.value as 'FALSE_POSITIVE' | 'TRUE_POSITIVE' | 'FALSE_NEGATIVE' | 'TRUE_NEGATIVE')}
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
              )}
            </div>

            {}
            {isManualMode && !isDisabledMode && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">Case Status</label>
                <select
                  value={status}
                  onChange={e => setStatus(e.target.value as CaseStatus)}
                  className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                    loading ? 'bg-gray-50 cursor-not-allowed' : ''
                  }`}
                  disabled={loading}
                >
                  <option value="STATUS_02_READY_FOR_ASSIGNMENT">Ready for Assignment (Investigation)</option>
                  <option value="STATUS_82_CLOSED_CONFIRMED">Closed - Confirmed</option>
                  <option value="STATUS_81_CLOSED_REFUTED">Closed - Refuted</option>
                  <option value="STATUS_83_CLOSED_INCONCLUSIVE">Closed - Inconclusive</option>
                </select>
              </div>
            )}

            {}
            {isDisabledMode && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">
                  <strong>Direct Investigation Mode:</strong> This alert will be automatically routed to investigation upon update.
                </p>
              </div>
            )}

            {}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Notes
                <span className="text-red-500 ml-1">*</span>
                <span className="text-xs text-gray-500 ml-2">(minimum 10 characters)</span>
              </label>
              <textarea
                value={note}
                onChange={e => setNote(e.target.value)}
                className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-2 resize-none ${
                  validationErrors.note
                    ? 'border-red-300 focus:ring-red-500'
                    : 'border-gray-300 focus:ring-blue-500'
                } ${loading ? 'bg-gray-50 cursor-not-allowed' : ''}`}
                rows={4}
                placeholder="Provide detailed reasoning for your triage decision (e.g., why this is suspicious, what patterns were identified, supporting evidence)..."
                disabled={loading}
                maxLength={500}
                aria-describedby={validationErrors.note ? 'note-error' : 'note-help'}
              />
              <div className="flex justify-between items-center mt-1">
                <div>
                  {validationErrors.note && (
                    <p id="note-error" className="text-red-500 text-xs">{validationErrors.note}</p>
                  )}
                  {!validationErrors.note && (
                    <p id="note-help" className="text-gray-500 text-xs">
                      Detailed notes help with case investigation and audit trails
                    </p>
                  )}
                </div>
                <span className={`text-xs ${note.length >= 500 ? 'text-red-500' : 'text-gray-500'}`}>
                  {note.length}/500
                </span>
              </div>
            </div>

            {}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 transition-colors focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading || Object.keys(validationErrors).length > 0 || !note.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {loading && (
                  <svg className="animate-spin -ml-1 mr-3 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                )}
                <span>
                  {loading ? 'Processing...' : (isManualMode ? 'Complete Triage' : 'Update Alert')}
                </span>
              </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ManualTriageModal;
