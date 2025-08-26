import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import type { ConvertToCaseData as ConvertToCaseDataType } from '../../types/triage.types';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { Alert } from '../../types/alertsdashboard.types';

interface ConvertToCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: Alert;
  onConfirmConvert: (caseData: ConvertToCaseDataType) => void;
}


const ConvertToCaseModal: React.FC<ConvertToCaseModalProps> = ({
  isOpen,
  onClose,
  alert,
  onConfirmConvert,
}) => {
  const [caseType, setCaseType] = useState<'FRAUD' | 'AML' | 'FRAUD_AND_AML' | ''>('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | ''>('');
  const [showLinkCases, setShowLinkCases] = useState(false);
  const [linkedCases, setLinkedCases] = useState<string[]>([]);
  const [caseSearchQuery, setCaseSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const { user } = useAuth();
  const [caseOwnerUserId, setCaseOwnerUserId] = useState<string | undefined>(user?.user_id || undefined);
  const [otherOwnerInput, setOtherOwnerInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  

  // Placeholder for existing cases; replace with real data source if available
  const existingCases: { id: string; title: string }[] = [];

  const filteredCases = caseSearchQuery
    ? existingCases.filter((caseItem) =>
        caseItem.id.toLowerCase().includes(caseSearchQuery.toLowerCase()) ||
        caseItem.title.toLowerCase().includes(caseSearchQuery.toLowerCase())
      )
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!caseType || !priority) {
      // Basic validation
      window.alert('Please select a Case Type and Priority Level.');
      return;
    }

    setIsSubmitting(true);
    
    try {
      const chosenOwner = caseOwnerUserId === 'other' ? (otherOwnerInput.trim() || undefined) : caseOwnerUserId;

      const caseData: ConvertToCaseDataType = {
        caseType,
        priority,
        linkedCases,
        notes: notes.trim(),
        alertId: alert.alert_id,
        caseOwnerUserId: chosenOwner,
        // risk fields will be populated by parent (AlertsDashboard) from alert data, but include here for preview
        ...extractRiskFromAlert(alert)
      };

      await onConfirmConvert(caseData);
      handleCancel();
    } catch (error) {
      console.error('Error converting alert to case:', error);
      // Error handling will be done by parent component
    } finally {
      setIsSubmitting(false);
    }
  };

  // parsing/helpers removed for UI; keep extractRiskFromAlert for payload construction

  const extractRiskFromAlert = (legacyAlert: Alert) => {
    const result: { riskCategory?: string; riskScore?: number; riskComponents?: Array<{ id: string; wght: number }> } = {};
    try {
      const maybe = legacyAlert.alert_data as unknown;
      if (maybe && typeof maybe === 'object') {
        const tadp = (maybe as Record<string, unknown>)['tadpResult'];
        const typology = tadp && typeof tadp === 'object' ? (tadp as Record<string, unknown>)['typologyResult'] : undefined;
        const first = Array.isArray(typology) && typology.length > 0 && typeof typology[0] === 'object' ? (typology[0] as Record<string, unknown>) : undefined;
        if (first) {
          result.riskCategory = first['id'] as string | undefined;
          const maybeResult = first['result'];
          result.riskScore = typeof maybeResult === 'number' ? (maybeResult as number) : undefined;
          const maybeRules = first['ruleResults'];
          if (Array.isArray(maybeRules)) {
            result.riskComponents = maybeRules.map((r) => {
              const rec = r as Record<string, unknown>;
              return { id: rec['id'] as string, wght: rec['wght'] as number };
            });
          }
        }
      }
    } catch {
      // ignore parsing errors
    }
    return result;
  };

  const handleCancel = () => {
    setCaseType('');
    setPriority('');
    setShowLinkCases(false);
    setLinkedCases([]);
    setCaseSearchQuery('');
    setNotes('');
    onClose();
  };

  const handleAddLinkedCase = (caseId: string) => {
    if (!linkedCases.includes(caseId)) {
      setLinkedCases([...linkedCases, caseId]);
      setCaseSearchQuery('');
    }
  };

  const handleRemoveLinkedCase = (caseId: string) => {
    setLinkedCases(linkedCases.filter(id => id !== caseId));
  };

  const getPriorityColor = (priorityLevel: string) => {
    switch (priorityLevel) {
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-400 bg-orange-50 border-orange-200';
      case 'low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen p-4">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-500 opacity-75 transition-opacity"
          onClick={handleCancel}
          aria-hidden="true"
        ></div>

        {/* Modal */}
        <div className="relative bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-900">
                Convert Alert to Case
              </h3>
              <button
                onClick={handleCancel}
                className="rounded-md bg-white text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <span className="sr-only">Close</span>
                <XMarkIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Case Type */}
              <div>
                <label htmlFor="caseType" className="block text-sm font-medium text-gray-700 mb-2">
                  Case Type <span className="text-red-500">*</span>
                </label>
                <select
                  id="caseType"
                  value={caseType}
                  onChange={(e) => setCaseType(e.target.value as 'FRAUD' | 'AML' | 'FRAUD_AND_AML')}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="" disabled>Select a case type</option>
                  <option value="FRAUD">Fraud</option>
                  <option value="AML">AML (Anti-Money Laundering)</option>
                  <option value="FRAUD_AND_AML">Fraud and AML</option>
                </select>
              </div>

              {/* Case Priority Level (radio) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Case Priority Level <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {(['low', 'medium', 'high'] as const).map((priorityLevel) => (
                    <label
                      key={priorityLevel}
                      className={`relative flex items-center p-3 border rounded-lg cursor-pointer hover:bg-gray-50 ${
                        priority === priorityLevel
                          ? getPriorityColor(priorityLevel)
                          : 'border-gray-300 bg-white'
                      }`}
                    >
                      <input
                        type="radio"
                        name="priority"
                        value={priorityLevel}
                        checked={priority === priorityLevel}
                        onChange={(e) => setPriority(e.target.value as typeof priority)}
                        className="sr-only"
                      />
                      <div className="flex items-center">
                        <div
                          className={`w-4 h-4 rounded-full border-2 mr-3 ${
                            priority === priorityLevel
                              ? 'border-current bg-current'
                              : 'border-gray-400'
                          }`}
                        >
                          {priority === priorityLevel && (
                            <div className="w-2 h-2 bg-white rounded-full m-0.5"></div>
                          )}
                        </div>
                        <span className="text-sm font-medium capitalize">{priorityLevel}</span>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

                  {/* Assign to Investigator dropdown */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Investigator</label>
                  <select
                    id="caseOwner"
                    value={caseOwnerUserId ?? ''}
                    onChange={(e) => setCaseOwnerUserId(e.target.value || undefined)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Unassigned</option>
                    {user && <option value={user.user_id}>{user.username || user.user_id}</option>}
                    <option value="other">Other (enter user id)</option>
                  </select>

                  {caseOwnerUserId === 'other' && (
                    <input
                      type="text"
                      value={otherOwnerInput}
                      onChange={(e) => setOtherOwnerInput(e.target.value)}
                      placeholder="Enter investigator user id (UUID)"
                      className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                    />
                  )}
                </div>

              {/* Rules & Typologies */}
              {/* Rules & Typologies UI removed - data is still included in the payload via extractRiskFromAlert */}

              {/* Link to Other Cases */}
              <div>
                <div className="flex items-center mb-3">
                  <input
                    id="linkCases"
                    type="checkbox"
                    checked={showLinkCases}
                    onChange={(e) => setShowLinkCases(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="linkCases" className="ml-2 text-sm font-medium text-gray-700">
                    Link to Other Cases
                  </label>
                </div>

                {showLinkCases && (
                  <div className="space-y-3">
                    {/* Case Search Input */}
                    <div className="relative">
                      <input
                        type="text"
                        value={caseSearchQuery}
                        onChange={(e) => setCaseSearchQuery(e.target.value)}
                        placeholder="Search case ID or title..."
                        className="w-full px-3 py-2 pl-10 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                      />
                      <MagnifyingGlassIcon className="absolute left-3 top-2.5 h-5 w-5 text-gray-400" />
                    </div>

                    {/* Search Results */}
                    {caseSearchQuery && (
                      <div className="max-h-32 overflow-y-auto border border-gray-200 rounded-md">
                        {filteredCases.length > 0 ? (
                          filteredCases.map((caseItem) => (
                            <button
                              key={caseItem.id}
                              type="button"
                              onClick={() => handleAddLinkedCase(caseItem.id)}
                              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-sm text-gray-900">{caseItem.id}</div>
                              <div className="text-xs text-gray-500">{caseItem.title}</div>
                            </button>
                          ))
                        ) : (
                          <div className="px-3 py-2 text-sm text-gray-500">No cases found</div>
                        )}
                      </div>
                    )}

                    {/* Linked Cases */}
                    {linkedCases.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-gray-700">Linked Cases:</p>
                        <div className="flex flex-wrap gap-2">
                          {linkedCases.map((caseId) => (
                            <span
                              key={caseId}
                              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800"
                            >
                              {caseId}
                              <button
                                type="button"
                                onClick={() => handleRemoveLinkedCase(caseId)}
                                className="ml-2 text-blue-600 hover:text-blue-800"
                              >
                                ×
                              </button>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Notes */}
              <div>
                <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-2">
                  Notes <span className="text-gray-500">(Optional)</span>
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={6}
                  placeholder="Enter case notes and investigation details..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
              </div>

              {/* Preview payload UI removed */}

              {/* Warning Message */}
              <div className="bg-amber-50 border border-amber-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-amber-400" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-amber-800">
                      Confirm Case Creation
                    </h3>
                    <div className="mt-2 text-sm text-amber-700">
                      <p>This action will convert the alert into a case and mark the original alert as "Converted". This action cannot be undone.</p>
                    </div>
                  </div>
                </div>
              </div>
            </form>
          </div>

          {/* Footer */}
          <div className="bg-gray-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
            <button
              type="submit"
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full inline-flex justify-center rounded-md border border-transparent shadow-sm px-4 py-2 bg-blue-600 text-base font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Creating Case...' : 'Create Case'}
            </button>
            <button
              type="button"
              onClick={handleCancel}
              disabled={isSubmitting}
              className="mt-3 w-full inline-flex justify-center rounded-md border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 sm:mt-0 sm:ml-3 sm:w-auto sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConvertToCaseModal;
