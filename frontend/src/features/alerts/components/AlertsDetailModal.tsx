import React, { useState, useEffect } from 'react';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline';
import type { Alert as TriageAlert, ActionHistory, AlertStatus } from '../types/triage.types';
import type { Alert as LegacyAlert } from '../types/alertsdashboard.types';
import triageService from '../services/triageservice';
import { useCase, canActOnCase } from '../../cases/hooks/useCase';
import { useSystemConfig } from '../../../shared/hooks/useSystemConfig';

interface AlertsDetailModalProps {
  alertId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onCloseAlert?: (alert: LegacyAlert, status: AlertStatus, notes: string) => void;
  onAlertUpdated?: () => void; 
  onManualTriage?: (alert: LegacyAlert) => void;
}

const convertToLegacyAlert = (alert: TriageAlert): LegacyAlert => ({
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
  confidence_per: alert.confidence_per,
  created_at: alert.created_at,
  case_id: alert.case_id,
  prediction_outcome: alert.prediction_outcome,
});

// Risk score calculation and breakdown
const getRiskScore = (alert: TriageAlert): number => {
  const priorityWeights = {
    NEW: 1,
    URGENT: 1.5,
    CRITICAL: 2,
    BREACH: 3,
  };
  console.log('Calculating risk score for alert:', alert);

  const baseScore = alert.confidence_per || 50;
  const weight = priorityWeights[alert.priority] || 1;
  return Math.round(baseScore * weight * 10); 
};

// Risk breakdown components
const getRiskBreakdown = (alert: TriageAlert) => {
  try {
    const maybe = alert.alert_data as unknown;
    if (maybe && typeof maybe === 'object') {
      const tadp = (maybe as Record<string, unknown>)['tadpResult'];
      if (tadp && typeof tadp === 'object') {
        const typologyResult = (tadp as Record<string, unknown>)['typologyResult'];
        if (Array.isArray(typologyResult) && typologyResult.length > 0 && typeof typologyResult[0] === 'object') {
          const typ = typologyResult[0] as Record<string, unknown>;
          const maybeRules = typ['ruleResults'];
          if (Array.isArray(maybeRules)) {
            return maybeRules.map((r) => {
              const rec = r as Record<string, unknown>;
              const id = (rec['id'] as string) || String(rec['ruleId'] || 'unknown');
              const name = (rec['label'] as string) || (rec['name'] as string) || id;
              const type = (rec['subRuleRef'] as string) || (rec['type'] as string) || (rec['category'] as string) || 'Unknown';
              const wght = typeof rec['wght'] === 'number' ? (rec['wght'] as number) : Number(rec['weight'] || 0);
              return { name, type, score: wght };
            });
          }
        }
      }
    }
  } catch {
    // ignore parsing errors and fall back to synthetic breakdown
  }

  // Fallback: synthesize breakdown based on computed risk score
  const totalScore = getRiskScore(alert);
  const components = [
    {
      name: 'Multiple ATM Withdrawals',
      type: 'Velocity',
      score: Math.round(totalScore * 0.31), // ~31% of total
    },
    {
      name: 'High-Value Cash Transactions',
      type: 'Pattern',
      score: Math.round(totalScore * 0.34), // ~34% of total
    },
    {
      name: 'Geographic Distribution',
      type: 'Pattern',
      score: Math.round(totalScore * 0.34), // ~34% of total
    },
  ];

  if (alert.priority === 'CRITICAL' || alert.priority === 'BREACH') {
    components.push({
      name: 'Aggregated Transaction Mirroring',
      type: 'Pattern',
      score: Math.round(totalScore * 0.33)
    });
    components[0].score = Math.round(totalScore * 0.22);
    components[1].score = Math.round(totalScore * 0.22);
    components[2].score = Math.round(totalScore * 0.23);
  }

  return components;
};

// Extract typology info (id/label/result) from alert.alert_data.tadpResult.typologyResult[0]
const extractTypologyInfo = (alert: TriageAlert) => {
  try {
    const maybe = alert.alert_data as unknown;
    if (maybe && typeof maybe === 'object') {
      const tadp = (maybe as Record<string, unknown>)['tadpResult'];
      if (tadp && typeof tadp === 'object') {
        const typologyResult = (tadp as Record<string, unknown>)['typologyResult'];
        if (Array.isArray(typologyResult) && typologyResult.length > 0 && typeof typologyResult[0] === 'object') {
          const typ = typologyResult[0] as Record<string, unknown>;
          const id = typ['id'] as string | undefined;
          const label = (typ['label'] as string) || (typ['name'] as string) || id;
          const result = typeof typ['result'] === 'number' ? (typ['result'] as number) : undefined;
          return { id, label, result };
        }
      }
    }
  } catch {
    // ignore
  }
  return { id: undefined, label: undefined, result: undefined };
};

// Utility: escape HTML for safe insertion
const escapeHtml = (unsafe: string) => {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

// Utility: simple JSON syntax highlighter that returns HTML
const syntaxHighlightJson = (obj: unknown) => {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  const escaped = escapeHtml(String(json));

  const highlighted = escaped
    .replace(/("(.*?)")(?=\s*:)/g, '<span class="text-indigo-700 font-medium">$1</span>')
    .replace(/:\s*"(.*?)"/g, ': <span class="text-green-700">"$1"</span>')
    .replace(/(:\s*)(-?\d+\.?\d*(?:e[+-]?\d+)?)/gi, '$1<span class="text-red-600">$2</span>')
    .replace(/(:\s*)(true|false)/gi, '$1<span class="text-yellow-600">$2</span>')
    .replace(/(:\s*)(null)/gi, '$1<span class="text-gray-500">$2</span>');

  return highlighted.replace(/\n/g, '<br/>').replace(/ /g, '&nbsp;');
};

const AlertsDetailModal: React.FC<AlertsDetailModalProps> = ({
  alertId,
  isOpen,
  onClose,
  onManualTriage,
}) => {
  // System configuration for triage mode
  const { isManualMode, isDisabledMode, isAIMode } = useSystemConfig();
  
  const [alert, setAlert] = useState<TriageAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showRules, setShowRules] = useState(false);
  
  const [actionHistory, setActionHistory] = useState<ActionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const { data: caseDetails } = useCase(alert?.case_id);

  const canPerformActions = canActOnCase(caseDetails?.status);

  useEffect(() => {
    const fetchAlertDetails = async () => {
      if (!alertId || !isOpen) {
        setAlert(null);
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const alertDetails = await triageService.getAlertById(alertId);
        setAlert(alertDetails);

        // Fetch action history
        setLoadingHistory(true);
        try {
          const history = await triageService.getAlertActionHistory(alertId);
          setActionHistory(history);
        } catch {
          setActionHistory([]);
        } finally {
          setLoadingHistory(false);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load alert details',
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAlertDetails();
  }, [alertId, isOpen]);

  if (!isOpen) {
    return null;
  }

  // Loading state
  if (loading) {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto">
        <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center">
          <div
            className="fixed inset-0 bg-gray-500 opacity-20 transition-opacity"
            aria-hidden="true"
          ></div>
          <div className="relative inline-block align-middle bg-white rounded-lg text-center overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full p-6">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-sm text-gray-600">
              Loading alert details...
            </p>
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
          <div
            className="fixed inset-0 bg-gray-500 opacity-20 transition-opacity"
            aria-hidden="true"
          ></div>
          <div className="relative inline-block align-middle bg-white rounded-lg text-center overflow-hidden shadow-xl transform transition-all sm:max-w-lg sm:w-full p-6">
            <ExclamationTriangleIcon className="h-12 w-12 text-red-600 mx-auto" />
            <h3 className="mt-4 text-lg font-medium text-gray-900">
              Error Loading Alert
            </h3>
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
                      {/* Manual Triage button - only show in MANUAL mode or DISABLED mode for updates, not in AI mode */}
            {canPerformActions && onManualTriage && isManualMode && !isAIMode && !isDisabledMode && (
              <button
                onClick={() => onManualTriage(convertToLegacyAlert(alert))}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                aria-label="Update Alert - Manual Triage"
              >
                <PencilSquareIcon className="h-4 w-4 mr-2 inline" />
                Update Alert
              </button>
            )}                      {/* AI Mode indicator - show when in AI mode */}
                      {isAIMode && (
                        <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md border border-blue-200">
                          AI Processed
                        </span>
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
                        <p className="text-sm text-gray-900">
                          {alert.alert_id}
                        </p>
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
                          Case Status:
                        </span>
                        <p className="text-sm text-gray-900">
                          {caseDetails?.status || 'Loading...'}
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
                          {alert.transaction ? (
                            <pre
                              className="whitespace-pre-wrap break-words max-h-64 overflow-auto text-sm"
                              dangerouslySetInnerHTML={{ __html: syntaxHighlightJson(alert.transaction) }}
                            />
                          ) : (
                            <div className="text-sm text-gray-600">No transaction data</div>
                          )}
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
                        <span className="ml-2 text-sm text-gray-600">
                          Loading...
                        </span>
                      </div>
                    ) : actionHistory.length > 0 ? (
                      <div className="space-y-3 max-h-64 overflow-y-auto">
                        {actionHistory.map((action) => (
                          <div
                            key={action.audit_log_id}
                            className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                          >
                            <div
                              className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center mt-1 ${
                                action.outcome === 'SUCCESS'
                                  ? 'bg-green-100 text-green-600'
                                  : action.outcome === 'FAILURE'
                                    ? 'bg-red-100 text-red-600'
                                    : 'bg-blue-100 text-blue-600'
                              }`}
                            >
                              <ClockIcon className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-gray-900">
                                <span className="font-medium">
                                  {action.action_performed}
                                </span>
                              </p>
                              <div className="flex items-center space-x-2 text-xs text-gray-500">
                                <span>
                                  {new Date(action.performed_at).toLocaleString(
                                    'en-US',
                                    {
                                      month: 'numeric',
                                      day: 'numeric',
                                      year: 'numeric',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit',
                                      hour12: true,
                                    },
                                  )}
                                </span>
                                {action.user_id && (
                                  <>
                                    <span>•</span>
                                    <span className="font-medium">
                                      User: {action.user_id}
                                    </span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <p className="text-sm text-gray-500">
                          No action history available
                        </p>
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
                    {(() => {
                      const typ = extractTypologyInfo(alert);
                      return (
                        <>
                          <span className="text-gray-500">Risk Category:</span>
                          <span className="font-medium text-gray-900">{typ.label || typ.id || 'Unknown'}</span>
                          <span className="text-gray-500">•</span>
                          <span className="text-gray-500">Risk Score:</span>
                          <span className="font-medium text-red-600 text-base">{typ.result ?? getRiskScore(alert)}</span>
                        </>
                      );
                    })()}
                  </div>
                </div>

                {/* Collapsible detailed risk breakdown */}
                <div
                  className={`overflow-hidden transition-all duration-300 ${showRules ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'}`}
                >
                  {showRules && (
                    <div className="border border-gray-200 rounded-lg overflow-hidden">
                      <div className="max-h-80 overflow-y-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                          <thead className="bg-gray-50 sticky top-0 z-10">
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
                            <tr className="bg-gray-50 sticky bottom-0">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                Total Score
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                Aggregate
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-red-600">
                                {(() => {
                                  const typ = extractTypologyInfo(alert);
                                  return typ.result ?? getRiskScore(alert);
                                })()}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AlertsDetailModal;
