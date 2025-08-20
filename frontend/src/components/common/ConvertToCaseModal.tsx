import React, { useState, useEffect } from 'react';
import { XMarkIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { Alert } from '../../types/alertsdashboard.types';

interface ConvertToCaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  alert: Alert;
  onConfirmConvert: (caseData: ConvertToCaseData) => void;
}

export interface ConvertToCaseData {
  caseId: string;
  assignedTo: string;
  priority: 'low' | 'medium' | 'high';
  linkedCases: string[];
  notes: string;
  alertId: string;
}

const ConvertToCaseModal: React.FC<ConvertToCaseModalProps> = ({
  isOpen,
  onClose,
  alert,
  onConfirmConvert,
}) => {
  const [assignedTo, setAssignedTo] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high'>('medium');
  const [showLinkCases, setShowLinkCases] = useState(false);
  const [linkedCases, setLinkedCases] = useState<string[]>([]);
  const [caseSearchQuery, setCaseSearchQuery] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [caseId, setCaseId] = useState('');

  // Mock investigators data - in real implementation, fetch from API
  const investigators = [
    { id: 'inv-001', name: 'John Smith', email: 'john.smith@tazama.org' },
    { id: 'inv-002', name: 'Jane Doe', email: 'jane.doe@tazama.org' },
    { id: 'inv-003', name: 'Mike Johnson', email: 'mike.johnson@tazama.org' },
    { id: 'inv-004', name: 'Sarah Wilson', email: 'sarah.wilson@tazama.org' },
    { id: 'inv-005', name: 'David Brown', email: 'david.brown@tazama.org' },
  ];

  // Mock existing cases for auto-complete - in real implementation, fetch from API
  const existingCases = [
    { id: 'CASE-001', title: 'Suspicious Money Transfer Investigation' },
    { id: 'CASE-002', title: 'Multiple Account Fraud Detection' },
    { id: 'CASE-003', title: 'Cross-Border Transaction Analysis' },
    { id: 'CASE-004', title: 'Identity Theft Investigation' },
    { id: 'CASE-005', title: 'Merchant Account Abuse' },
  ];

  // Generate new case ID when modal opens
  useEffect(() => {
    if (isOpen && alert) {
      const newCaseId = `CASE-${Date.now().toString().slice(-6)}`;
      setCaseId(newCaseId);
      // Pre-populate notes with alert information
      setNotes(`Case created from Alert ${alert.id}\n\nAlert Details:\n- Type: ${alert.type}\n- Severity: ${alert.severity}\n- Risk Score: ${alert.riskScore}\n- Transaction ID: ${alert.transactionId}\n\nInitial Investigation Notes:\n`);
    }
  }, [isOpen, alert]);

  const filteredCases = existingCases.filter(
    (caseItem) =>
      caseItem.id.toLowerCase().includes(caseSearchQuery.toLowerCase()) ||
      caseItem.title.toLowerCase().includes(caseSearchQuery.toLowerCase())
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!assignedTo || !notes.trim()) {
      return; // Form validation handled by required attributes
    }

    setIsSubmitting(true);
    
    try {
      const caseData: ConvertToCaseData = {
        caseId,
        assignedTo,
        priority,
        linkedCases,
        notes: notes.trim(),
        alertId: alert.id,
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

  const handleCancel = () => {
    setAssignedTo('');
    setPriority('medium');
    setShowLinkCases(false);
    setLinkedCases([]);
    setCaseSearchQuery('');
    setNotes('');
    setCaseId('');
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
              {/* Case ID (disabled) */}
              <div>
                <label htmlFor="caseId" className="block text-sm font-medium text-gray-700 mb-2">
                  Case ID
                </label>
                <input
                  id="caseId"
                  type="text"
                  value={caseId}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-50 text-gray-500 cursor-not-allowed"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Auto-generated case identifier
                </p>
              </div>

              {/* Assign to Investigator */}
              <div>
                <label htmlFor="assignedTo" className="block text-sm font-medium text-gray-700 mb-2">
                  Assign to Investigator <span className="text-red-500">*</span>
                </label>
                <select
                  id="assignedTo"
                  value={assignedTo}
                  onChange={(e) => setAssignedTo(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Select an investigator...</option>
                  {investigators.map((investigator) => (
                    <option key={investigator.id} value={investigator.id}>
                      {investigator.name} ({investigator.email})
                    </option>
                  ))}
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
                  Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  required
                  rows={6}
                  placeholder="Enter case notes and investigation details..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 resize-none"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Minimum 20 characters required
                </p>
              </div>

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
              disabled={!assignedTo || !notes.trim() || notes.trim().length < 20 || isSubmitting}
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
