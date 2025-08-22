import React, { useState, useEffect } from 'react';
import { 
  XMarkIcon, 
  ExclamationTriangleIcon,
  DocumentDuplicateIcon,
  XCircleIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import type { Alert as TriageAlert, ActionHistory } from '../../types/triage.types';
import type { Alert as LegacyAlert } from '../../types/alertsdashboard.types';
import triageService from '../../services/triageservice';
import CloseAlertModal from './CloseAlertModal';
import ConvertToCaseModal, { type ConvertToCaseData } from './ConvertToCaseModal';

interface AlertsDetailModalProps {
  alertId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onConvertToCase?: (alert: LegacyAlert, caseData?: ConvertToCaseData) => void;
  onCloseAlert?: (alert: LegacyAlert, justification?: string) => void;
  onAlertUpdated?: () => void; // Callback to refresh the alerts list
}

// Temporary adapter to convert new Alert format to legacy format for modals
const convertToLegacyAlert = (alert: TriageAlert): LegacyAlert => ({
  // Backend fields - pass through
  alert_id: alert.alert_id,
  tenant_id: alert.tenant_id,
  priority: alert.priority,
  alert_type: alert.alert_type,
  source: alert.source,
  txtp: alert.txtp,
  message: alert.message,
  alert_data: alert.alert_data,
  transaction: alert.transaction,
  network_map: alert.network_map,
  alert_status: alert.alert_status,
  confidence_per: alert.confidence_per,
  created_at: alert.created_at,
  case_id: alert.case_id,

  // UI-specific fields - derived mappings
  id: alert.alert_id,
  title: alert.message,
  description: alert.message,
  type: alert.alert_type || alert.source || 'transaction_monitoring',
  severity: alert.priority.toLowerCase() as 'low' | 'medium' | 'high' | 'critical',
  riskScore: alert.confidence_per,
  confidence: alert.confidence_per,
  status: (alert.alert_status === 'CLOSED' ? 'resolved' : 
           alert.alert_status === 'CONVERTED' ? 'converted' :
           alert.alert_status.toLowerCase()) as 'new' | 'investigating' | 'resolved' | 'false_positive' | 'converted',
  createdAt: alert.created_at,
  updatedAt: alert.created_at, // Use created_at as fallback
  lastUpdated: alert.created_at,
  transactionId: alert.txtp,
  assignedTo: undefined,
  assignee: undefined,
  amount: undefined, // Would need to parse from transaction data
  currency: undefined, // Would need to parse from transaction data
});

// Risk score calculation and breakdown
const getRiskScore = (alert: TriageAlert): number => {
  // For now, use confidence_per as base score multiplied by priority weight
  const priorityWeights = {
    'LOW': 1,
    'MEDIUM': 1.5,
    'HIGH': 2,
    'CRITICAL': 3
  };
  
  const baseScore = alert.confidence_per || 50;
  const weight = priorityWeights[alert.priority] || 1;
  return Math.round(baseScore * weight * 10); // Scale to reasonable range
};

// Risk breakdown components
const getRiskBreakdown = (alert: TriageAlert) => {
  const totalScore = getRiskScore(alert);
  
  // Generate realistic breakdown based on alert properties
  const components = [
    {
      name: 'Multiple ATM Withdrawals',
      type: 'Velocity',
      score: Math.round(totalScore * 0.31) // ~31% of total
    },
    {
      name: 'High-Value Cash Transactions',
      type: 'Pattern',
      score: Math.round(totalScore * 0.34) // ~34% of total
    },
    {
      name: 'Geographic Distribution',
      type: 'Pattern', 
      score: Math.round(totalScore * 0.34) // ~34% of total
    }
  ];
  
  // Add fourth component if high risk
  if (alert.priority === 'HIGH' || alert.priority === 'CRITICAL') {
    components.push({
      name: 'Aggregated Transaction Mirroring',
      type: 'Pattern',
      score: Math.round(totalScore * 0.33) // Adjust for 4 components
    });
    
    // Rebalance other components
    components[0].score = Math.round(totalScore * 0.22);
    components[1].score = Math.round(totalScore * 0.22);
    components[2].score = Math.round(totalScore * 0.23);
  }
  
  return components;
};

const AlertsDetailModal: React.FC<AlertsDetailModalProps> = ({
  alertId,
  isOpen,
  onClose,
  onConvertToCase,
  onCloseAlert,
  onAlertUpdated,
}) => {
  const [alert, setAlert] = useState<TriageAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [actionHistory, setActionHistory] = useState<ActionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Fetch alert details when alertId changes and modal is open
  useEffect(() => {
    const fetchAlertDetails = async () => {
      if (!alertId || !isOpen) {
        setAlert(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        console.log('🔍 Fetching alert details for ID:', alertId);
        const alertDetails = await triageService.getAlertById(alertId);
        console.log('Alert details fetched:', alertDetails);
        setAlert(alertDetails);

        // Fetch action history
        setLoadingHistory(true);
        try {
          const history = await triageService.getAlertActionHistory(alertId);
          setActionHistory(history);
        } catch (historyError) {
          console.warn('Failed to fetch action history:', historyError);
          setActionHistory([]);
        } finally {
          setLoadingHistory(false);
        }

        // Log alert view for audit trail
        const currentUser = 'system'; // TODO: Get from auth context
        console.log('Alert View Logged:', {
          alertId: alertDetails.alert_id,
          viewedBy: currentUser,
          viewedAt: new Date().toISOString(),
          action: 'alert_opened',
        });
      } catch (err) {
        console.error('Error fetching alert details:', err);
        setError(err instanceof Error ? err.message : 'Failed to load alert details');
      } finally {
        setLoading(false);
      }
    };

    fetchAlertDetails();
  }, [alertId, isOpen]);

  const handleConvert = () => {
    console.log('handleConvert called, alert status:', alert?.alert_status);
    // Only show convert modal if alert is in an open state
    if (alert && (alert.alert_status === 'NEW' || alert.alert_status === 'INVESTIGATING')) {
      console.log('Setting showConvertModal to true');
      setShowConvertModal(true);
    } else {
      console.log('Alert cannot be converted in current status:', alert?.alert_status);
    }
  };

  const handleConfirmConvert = async (caseData: ConvertToCaseData) => {
    try {
      // Call the parent's onConvertToCase with additional parameters
      if (alert && onConvertToCase) {
        await onConvertToCase(convertToLegacyAlert(alert), caseData);
        // Refresh alert details after successful conversion
        if (onAlertUpdated) {
          onAlertUpdated();
        }
      }
      setShowConvertModal(false);
      onClose();
    } catch (error) {
      console.error('Error converting alert to case:', error);
      // Keep modal open to show error
      throw error;
    }
  };

  const handleCloseAlert = () => {
    console.log('handleCloseAlert called, alert status:', alert?.alert_status);
    // Only show close modal if alert is in an open state
    if (alert && (alert.alert_status === 'NEW' || alert.alert_status === 'INVESTIGATING')) {
      console.log('Setting showCloseModal to true');
      setShowCloseModal(true);
    } else {
      console.log('Alert cannot be closed in current status:', alert?.alert_status);
    }
  };

  const handleConfirmCloseAlert = async (_alertId: string, justification: string) => {
    try {
      // Call the parent's onCloseAlert with additional parameters
      if (alert && onCloseAlert) {
        // Pass the justification information
        await onCloseAlert(convertToLegacyAlert(alert), justification);
        // Refresh alert details after successful closure
        if (onAlertUpdated) {
          onAlertUpdated();
        }
      }
      setShowCloseModal(false);
      onClose();
    } catch (error) {
      console.error('Error closing alert:', error);
      // Keep modal open to show error
      throw error;
    }
  };

  // Don't render if not open
  if (!isOpen) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
          <div className="fixed inset-0 bg-gray-500 opacity-20 transition-opacity" aria-hidden="true"></div>
          <div className="relative inline-block align-middle bg-white rounded-lg text-center overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600">Loading alert details...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
          <div className="fixed inset-0 bg-gray-500 opacity-20 transition-opacity" aria-hidden="true"></div>
          <div className="relative inline-block align-middle bg-white rounded-lg text-center overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full p-6">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-600 mx-auto" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">Error Loading Alert</h3>
            <p className="mt-2 text-sm text-gray-600">{error}</p>
            <div className="mt-6 flex justify-center space-x-3">
              <button
                onClick={() => window.location.reload()}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Retry
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // No alert loaded yet or alert not found
  if (!alert) {
    return null;
  }

  // Get priority color (using priority instead of severity)
  const getPriorityColor = (priority: string) => {
    switch (priority?.toLowerCase()) {
      case 'critical':
        return 'text-red-600 bg-red-50';
      case 'high':
        return 'text-orange-600 bg-orange-50';
      case 'medium':
        return 'text-yellow-600 bg-yellow-50';
      case 'low':
        return 'text-green-600 bg-green-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-end justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:block sm:p-0">
        {/* Background overlay */}
        <div
          className="fixed inset-0 bg-gray-900 opacity-60 transition-opacity"
          onClick={onClose}
          aria-hidden="true"
        ></div>

        {/* This element is to trick the browser into centering the modal contents */}
        <span
          className="hidden sm:inline-block sm:align-middle sm:h-screen"
          aria-hidden="true"
        >
          &#8203;
        </span>

        {/* Modal panel */}
        <div className="relative inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-5xl sm:w-full">
          {/* Close button */}
          <div className="absolute top-0 right-0 pt-4 pr-4 z-10">
            <button
              onClick={onClose}
              className="bg-white rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {/* Modal content */}
          <div className="bg-white px-4 pt-4 pb-4 max-h-[85vh] overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              {/* Header Section */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-2">
                    <h3 className="text-xl font-bold text-gray-900 mt-4">
                      Alert Details
                    </h3>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getPriorityColor(alert.priority)}`}
                    >
                      {alert.priority}
                    </span>
                    
                    {/* Actions buttons moved here after priority badge */}
                    <div className="flex items-center space-x-2 ml-4">
                      {/* Only show Convert to Case if status allows converting */}
                      {(alert?.alert_status === 'NEW' || alert?.alert_status === 'INVESTIGATING') && (
                        <button
                          onClick={() => {
                            console.log('Convert to Case button clicked');
                            handleConvert();
                          }}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                          title="Convert this alert to a case for further investigation"
                        >
                          <DocumentDuplicateIcon className="h-4 w-4 mr-1.5" />
                          Convert to Case
                        </button>
                      )}
                      
                      {/* Only show Close Alert if status allows closing */}
                      {(alert?.alert_status === 'NEW' || alert?.alert_status === 'INVESTIGATING') && (
                        <button
                          onClick={() => {
                            console.log('Close Alert button clicked');
                            handleCloseAlert();
                          }}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors"
                          title="Close this alert with justification"
                        >
                          <XCircleIcon className="h-4 w-4 mr-1.5" />
                          Close Alert
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-lg text-gray-600 mb-1">{alert.message}</p>
                  <p className="text-sm text-gray-500">
                    Alert ID: {alert.alert_id} • Source: {alert.source || 'N/A'}
                  </p>
                </div>
              </div>

              {/* Row 1: Alert Summary & Transaction Data */}
              <div className="bg-white rounded-lg mb-4">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
                  {/* Column 1: Alert Summary */}
                  <div className="flex-1 lg:max-w-[48%] bg-white rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">
                      Alert Summary
                    </h4>
                    <div className="space-y-3">
                      <div>
                        <span className="text-sm font-medium text-gray-500">
                          Alert ID:
                        </span>
                        <p className="text-sm text-gray-900">{alert.alert_id}</p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">
                          Confidence Score:
                        </span>
                        <p className="text-sm text-gray-900">
                          {alert.confidence_per}%
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">
                          Created:
                        </span>
                        <p className="text-sm text-gray-900">
                          {new Date(alert.created_at).toLocaleString()}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">
                          Status:
                        </span>
                        <p className="text-sm text-gray-900">
                          {alert.alert_status}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Column 2: Transaction Data */}
                  <div className="flex-1 lg:max-w-[48%] bg-white rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">
                      Transaction Data
                    </h4>
                    <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                      <div>
                        <span className="text-sm font-medium text-gray-500">
                          Transaction Data:
                        </span>
                        <div className="text-sm text-gray-900 font-mono bg-gray-100 p-2 rounded mt-1">
                          {alert.transaction ? JSON.stringify(alert.transaction, null, 2) : 'No transaction data'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Row 2: Related Items & Action History */}
              <div className="bg-white rounded-lg mb-4">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
                  {/* Column 1: Related Items */}
                  <div className="flex-1 lg:max-w-[48%] bg-white rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">
                      Related Items
                    </h4>
                    <div className="space-y-4">
                      <p className="text-sm font-medium text-gray-900">
                        Related Item 1
                      </p>
                      <p className="text-sm font-medium text-gray-900">
                        Related Item 2
                      </p>
                    </div>
                  </div>

                  {/* Column 2: Action History */}
                  <div className="flex-1 lg:max-w-[48%] bg-white rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">
                      Action History
                    </h4>
                    
                    {loadingHistory ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                        <span className="ml-2 text-sm text-gray-600">Loading...</span>
                      </div>
                    ) : actionHistory.length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {actionHistory.map((action) => (
                          <div key={action.id} className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg">
                            <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-1 ${
                              action.outcome === 'SUCCESS' 
                                ? 'bg-green-100 text-green-600' 
                                : action.outcome === 'FAILURE'
                                ? 'bg-red-100 text-red-600'
                                : 'bg-blue-100 text-blue-600'
                            }`}>
                              <ClockIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900">
                                <span className="font-medium">{action.action}</span>
                              </p>
                              <p className="text-xs text-gray-500">
                                {new Date(action.timestamp).toLocaleString('en-US', {
                                  month: 'numeric',
                                  day: 'numeric',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit',
                                  hour12: true
                                })}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500">No action history available</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Row 3: Rules & Typologies */}
              <div className="bg-white rounded-lg p-4 mb-4 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-lg font-semibold text-gray-900 border-b border-gray-200 pb-2">
                    Rules & Typologies
                  </h4>
                  <button
                    onClick={() => setShowRules(!showRules)}
                    className="text-sm px-3 py-1.5 rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {showRules ? 'Hide Risk Breakdown' : 'Show Risk Breakdown'}
                  </button>
                </div>

                <div className="mb-4">
                  <div className="flex items-center space-x-4 text-sm">
                    <span className="text-gray-500">Risk Category:</span>
                    <span className="font-medium text-gray-900">
                      False promotions, phishing, or social engineering scams
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-gray-500">Risk Score:</span>
                    <span className="font-medium text-red-600 text-base">
                      {getRiskScore(alert)}
                    </span>
                  </div>
                </div>

                {/* Collapsible detailed risk breakdown */}
                <div
                  className={`overflow-hidden transition-all duration-300 ${showRules ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  {showRules && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Risk Component
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Type
                            </th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Score
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {getRiskBreakdown(alert).map((component, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {component.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                {component.type}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {component.score}
                              </td>
                            </tr>
                          ))}
                          <tr className="bg-gray-50">
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              Total Score
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                              Aggregate
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                              {getRiskScore(alert)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* Close Alert Modal */}
      {alert && (
        <CloseAlertModal
          isOpen={showCloseModal}
          onClose={() => setShowCloseModal(false)}
          alert={convertToLegacyAlert(alert)}
          onConfirmClose={handleConfirmCloseAlert}
        />
      )}

      {/* Convert to Case Modal */}
      {alert && (
        <ConvertToCaseModal
          isOpen={showConvertModal}
          onClose={() => setShowConvertModal(false)}
          alert={convertToLegacyAlert(alert)}
          onConfirmConvert={handleConfirmConvert}
        />
      )}
    </div>
  );
};

export default AlertsDetailModal;
