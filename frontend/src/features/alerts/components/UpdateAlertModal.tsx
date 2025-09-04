
import React, { useState } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import type { Alert } from '../types/triage.types';

interface UpdateAlertModalProps {
  isOpen: boolean;
  alert: Alert;
  onClose: () => void;
  onUpdate: (fields: { priority: string; confidence_per: number; alert_type: string; note: string }) => Promise<void>;
}

const UpdateAlertModal: React.FC<UpdateAlertModalProps> = ({ isOpen, alert, onClose, onUpdate }) => {
  const [priority, setPriority] = useState(alert.priority);
  const [confidence, setConfidence] = useState(alert.confidence_per);
  const [alertType, setAlertType] = useState(alert.alert_type ?? '');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    setPriority(alert.priority);
    setConfidence(alert.confidence_per);
    setAlertType(alert.alert_type ?? '');
    setNote('');
  }, [alert]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await onUpdate({
        priority,
        confidence_per: confidence,
        alert_type: alertType,
        note,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update alert');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        <div className="fixed inset-0 bg-gray-500 opacity-75 transition-opacity" onClick={onClose} aria-hidden="true"></div>
        <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all max-w-lg w-full">
          <form onSubmit={handleSubmit} className="bg-white px-6 py-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Update Alert</h3>
            {error && <div className="text-red-600 mb-2 text-sm">{error}</div>}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
              <select value={priority} onChange={e => setPriority(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="NEW">New</option>
                <option value="URGENT">Urgent</option>
                <option value="CRITICAL">Critical</option>
                <option value="BREACH">Breach</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Confidence %</label>
              <input type="number" value={confidence} onChange={e => setConfidence(Number(e.target.value))} className="w-full px-3 py-2 border border-gray-300 rounded-md" min={0} max={100} />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Alert Type</label>
              <select value={alertType} onChange={e => setAlertType(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="">Select type</option>
                <option value="TRANSACTION_MONITORING">Transaction Monitoring</option>
                <option value="AML_SCREENING">AML Screening</option>
                <option value="FRAUD_DETECTION">Fraud Detection</option>
              </select>
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Note</label>
              <textarea value={note} onChange={e => setNote(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md" rows={3} />
            </div>
            <div className="flex justify-end space-x-2 mt-6">
              <button type="button" onClick={onClose} className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400">Cancel</button>
              <button type="submit" disabled={loading} className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">{loading ? 'Saving...' : 'Save Changes'}</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UpdateAlertModal;
