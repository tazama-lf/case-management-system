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
  // System configuration for triage mode
  const { isManualMode, isDisabledMode } = useSystemConfig();
  
  const [priority, setPriority] = useState<Priority>(alert.priority);
  const [confidence, setConfidence] = useState(alert.confidence_per);
  const [alertType, setAlertType] = useState<AlertType | ''>(alert.alert_type ?? '');
  const [predictionOutcome, setPredictionOutcome] = useState<'FALSE_POSITIVE' | 'TRUE_POSITIVE' | 'FALSE_NEGATIVE' | 'TRUE_NEGATIVE'>('FALSE_POSITIVE');
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<CaseStatus>('CLOSED_REFUTED_81');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setPriority(alert.priority);
    setConfidence(alert.confidence_per);
    setAlertType(alert.alert_type ?? '');
    setNote('');
    setPredictionOutcome('FALSE_POSITIVE');
    setStatus('CLOSED_REFUTED_81');
  }, [alert]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!note.trim()) {
      setError('Note is required for manual triage');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const triageData: ManualTriageDto = {
        confidence_per: confidence,
        priority,
        alertType: alertType as AlertType,
        predictionOutcome,
        note: note.trim(),
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
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Priority */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                  <select 
                    value={priority} 
                    onChange={e => setPriority(e.target.value as Priority)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="NEW">New</option>
                    <option value="URGENT">Urgent</option>
                    <option value="CRITICAL">Critical</option>
                    <option value="BREACH">Breach</option>
                  </select>
                </div>

                {/* Confidence Percentage */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Confidence %</label>
                  <input 
                    type="number" 
                    value={confidence} 
                    onChange={e => setConfidence(Number(e.target.value))} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                    min={0} 
                    max={100} 
                  />
                </div>

                {/* Alert Type */}
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Alert Type</label>
                  <select 
                    value={alertType} 
                    onChange={e => setAlertType(e.target.value as AlertType)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select type</option>
                    <option value="FRAUD">Fraud</option>
                    <option value="AML">AML</option>
                    <option value="FRAUD_AND_AML">Fraud and AML</option>
                  </select>
                </div>

                {/* Prediction Outcome - Only show in MANUAL mode, hidden in DISABLED mode */}
                {isManualMode && !isDisabledMode && (
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Prediction Outcome</label>
                    <select 
                      value={predictionOutcome} 
                      onChange={e => setPredictionOutcome(e.target.value as 'FALSE_POSITIVE' | 'TRUE_POSITIVE' | 'FALSE_NEGATIVE' | 'TRUE_NEGATIVE')} 
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="FALSE_POSITIVE">False Positive</option>
                      <option value="TRUE_POSITIVE">True Positive</option>
                      <option value="FALSE_NEGATIVE">False Negative</option>
                      <option value="TRUE_NEGATIVE">True Negative</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Case Status - Only show in MANUAL mode, simplified in DISABLED mode */}
              {isManualMode && !isDisabledMode && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Case Status</label>
                  <select 
                    value={status} 
                    onChange={e => setStatus(e.target.value as CaseStatus)} 
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="READY_FOR_ASSIGNMENT_02">Ready for Assignment (Investigation)</option>
                    <option value="CLOSED_CONFIRMED_82">Closed - Confirmed</option>
                    <option value="CLOSED_REFUTED_81">Closed - Refuted</option>
                    <option value="CLOSED_INCONCLUSIVE_83">Closed - Inconclusive</option>
                  </select>
                </div>
              )}

              {/* In DISABLED mode, automatically route to investigation */}
              {isDisabledMode && (
                <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                  <p className="text-sm text-blue-700">
                    <strong>Direct Investigation Mode:</strong> This alert will be automatically routed to investigation upon update.
                  </p>
                </div>
              )}

              {/* Triage Notes */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes <span className="text-red-500">*</span>
                </label>
                <textarea 
                  value={note} 
                  onChange={e => setNote(e.target.value)} 
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500" 
                  rows={4}
                  placeholder="Provide detailed reasoning for your triage decision..."
                  required
                />
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3">
                <button 
                  type="button" 
                  onClick={onClose} 
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400 transition-colors"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={loading || !note.trim()} 
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? 'Processing...' : (isManualMode ? 'Complete Triage' : 'Update Alert')}
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
