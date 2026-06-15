import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  XMarkIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@heroicons/react/24/outline';
import type {
  Alert as TriageAlert,
  ActionHistory,
  AlertStatus,
} from '../types/triage.types';
import type { Alert as LegacyAlert } from '../types/alertsdashboard.types';
import triageService from '../services/triageservice';
import userService from '../../cases/services/userService';
import {
  taskService,
  type TaskForSupervisor,
} from '../../cases/services/taskService';
import { useCase, canActOnCase } from '../../cases/hooks/useCase';
import { useSystemConfig } from '../../../shared/hooks/useSystemConfig';
import { formatDate } from '@/shared/utils/dateUtils';
import { useQueryClient } from '@tanstack/react-query';
import { caseService } from '../../cases/services/caseService';

interface AlertsDetailModalProps {
  alertId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onCloseAlert?: (
    alert: LegacyAlert,
    status: AlertStatus,
    notes: string,
  ) => void;
  onAlertUpdated?: () => void;
  onManualTriage?: (alert: LegacyAlert) => void;
  onNavigateToCase?: () => void;
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

interface TriggeredRuleDetail {
  ruleId: string;
  ruleWeight: number;
  subRef?: string;
  independentVariable?: unknown;
}

interface TriggeredTypologyDetail {
  typologyId: string;
  typologyCfg: string;
  typologyScore: number;
  alertThreshold: number;
  interdictionThreshold: number;
  rules: TriggeredRuleDetail[];
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const asNumber = (value: unknown, fallback = 0): number => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' && value.trim() ? value : fallback;

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'bg-red-500';
  if (score >= 60) return 'bg-orange-500';
  return 'bg-yellow-500';
};

const getScoreTextColor = (score: number): string => {
  if (score >= 80) return 'text-red-700';
  if (score >= 60) return 'text-orange-700';
  return 'text-yellow-700';
};

const extractTriggeredTypologies = (
  alert: TriageAlert,
): TriggeredTypologyDetail[] => {
  const alertData = isRecord(alert.alert_data) ? alert.alert_data : {};
  const tadpResult = isRecord(alertData.tadpResult) ? alertData.tadpResult : {};
  const tadpTypologies = Array.isArray(tadpResult.typologyResult)
    ? tadpResult.typologyResult.filter(isRecord)
    : [];

  const networkMap = isRecord(alert.network_map) ? alert.network_map : {};
  const networkMessages = Array.isArray(networkMap.messages)
    ? networkMap.messages.filter(isRecord)
    : [];
  const networkTypologies = networkMessages.flatMap((message) =>
    Array.isArray(message.typologies)
      ? message.typologies.filter(isRecord)
      : [],
  );

  const alertedTypologies = Array.isArray(alert.alerted_typologies)
    ? alert.alerted_typologies.filter(isRecord)
    : [];

  const sourceTypologies = alertedTypologies.length
    ? alertedTypologies
    : tadpTypologies;

  return sourceTypologies.map((source, index) => {
    const sourceId = asString(source.id, `typology-${index}`);
    const sourceCfg = asString(source.cfg, sourceId);

    const tadpTypology = tadpTypologies.find((typology) => {
      const id = asString(typology.id);
      const cfg = asString(typology.cfg);
      return (
        id === sourceId ||
        cfg === sourceId ||
        id === sourceCfg ||
        cfg === sourceCfg
      );
    });

    const networkTypology = networkTypologies.find((typology) => {
      const id = asString(typology.id);
      const cfg = asString(typology.cfg);
      return (
        id === sourceId ||
        cfg === sourceId ||
        id === sourceCfg ||
        cfg === sourceCfg
      );
    });

    const workflow = isRecord(tadpTypology?.workflow)
      ? tadpTypology.workflow
      : {};

    const ruleResults = Array.isArray(tadpTypology?.ruleResults)
      ? tadpTypology.ruleResults.filter(isRecord)
      : [];
    const networkRules = Array.isArray(networkTypology?.rules)
      ? networkTypology.rules.filter(isRecord)
      : [];

    const rules = (ruleResults.length ? ruleResults : networkRules).map(
      (rule, ruleIndex) => ({
        ruleId: asString(rule.id, `rule-${ruleIndex + 1}`),
        ruleWeight: asNumber(rule.wght ?? rule.weight, 0),
        subRef: asString(rule.subRuleRef),
        independentVariable: rule.indpdntVarbl ?? rule.independentVariable,
      }),
    );

    return {
      typologyId: asString(tadpTypology?.id, sourceId),
      typologyCfg: asString(
        source.label,
        asString(source.cfg, asString(tadpTypology?.cfg, sourceId)),
      ),
      typologyScore: asNumber(source.result ?? tadpTypology?.result, 0),
      alertThreshold: asNumber(
        source.alertThreshold ?? workflow.alertThreshold,
        0,
      ),
      interdictionThreshold: asNumber(workflow.interdictionThreshold, 0),
      rules,
    };
  });
};

const escapeHtml = (unsafe: string) =>
  unsafe
    .replace(/&/gu, '&amp;')
    .replace(/</gu, '&lt;')
    .replace(/>/gu, '&gt;')
    .replace(/"/gu, '&quot;')
    .replace(/'/gu, '&#039;');

const syntaxHighlightJson = (obj: unknown) => {
  const json = typeof obj === 'string' ? obj : JSON.stringify(obj, null, 2);
  const escaped = escapeHtml(String(json));

  const highlighted = escaped
    .replace(
      /("(.*?)")(?=\s*:)/gu,
      '<span class="text-indigo-700 font-medium">$1</span>',
    )
    .replace(/:\s*"(.*?)"/gu, ': <span class="text-green-700">"$1"</span>')
    .replace(
      /(:\s*)(-?\d+\.?\d*(?:e[+-]?\d+)?)/giu,
      '$1<span class="text-red-600">$2</span>',
    )
    .replace(
      /(:\s*)(true|false)/giu,
      '$1<span class="text-yellow-600">$2</span>',
    )
    .replace(/(:\s*)(null)/giu, '$1<span class="text-gray-500">$2</span>');

  return highlighted.replace(/\n/gu, '<br/>').replace(/ /gu, '&nbsp;');
};

const ActionHistoryItem: React.FC<{ action: ActionHistory }> = ({ action }) => {
  const [username, setUsername] = useState<string | null>(null);

  useEffect(() => {
    const fetchUsername = async () => {
      try {
        const userDetails = await userService.getUserDetailsById(
          action.user_id,
        );
        if (userDetails) {
          const userName = userService.formatUserName(userDetails);
          setUsername(userName);
        }
      } catch (error) {
        console.error('Failed to fetch user details:', error);
      }
    };

    fetchUsername();
  }, [action.user_id]);

  const displayText =
    username && action.action_performed.includes(action.user_id)
      ? action.action_performed.replace(action.user_id, username)
      : action.action_performed;

  // const userDisplayName = username;

  return (
    <>
      <p className="text-sm text-gray-900">
        <span className="font-medium">{displayText}</span>
      </p>
      <div className="flex items-center space-x-2 text-xs text-gray-500">
        <span>{formatDate(action.performed_at)}</span>
        {action.user_id && (
          <>
            <span>•</span>
            <span className="font-medium">User ID: {action.user_id}</span>
          </>
        )}
      </div>
    </>
  );
};

const AlertsDetailModal: React.FC<AlertsDetailModalProps> = ({
  alertId,
  isOpen,
  onClose,
  onAlertUpdated,
  onManualTriage,
  onNavigateToCase,
}) => {
  const { isManualMode, isDisabledMode, isAIMode } = useSystemConfig();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [alert, setAlert] = useState<TriageAlert | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedTypologies, setExpandedTypologies] = useState<Set<string>>(
    new Set(),
  );

  const [actionHistory, setActionHistory] = useState<ActionHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isCompleteNewCaseCompleted, setIsCompleteNewCaseCompleted] =
    useState(false);
  const [hasCaseAccess, setHasCaseAccess] = useState<boolean>(true); // Default true for better UX

  const { data: caseDetails } = useCase(alert?.case_id);

  const canPerformActions = canActOnCase(caseDetails?.status);

  const toggleTypology = (typologyId: string) => {
    setExpandedTypologies((prev) => {
      const next = new Set(prev);
      if (next.has(typologyId)) {
        next.delete(typologyId);
      } else {
        next.add(typologyId);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!alert) {
      setExpandedTypologies(new Set());
      return;
    }

    const firstTypologyId = extractTriggeredTypologies(alert)[0]?.typologyId;
    setExpandedTypologies(
      firstTypologyId ? new Set([firstTypologyId]) : new Set(),
    );
  }, [alert]);

  useEffect(() => {
    const fetchAlertDetails = async () => {
      if (!alertId || !isOpen) {
        setAlert(null);
        return;
      }

      setAlert(null);
      setLoading(true);
      setError(null);

      try {
        await new Promise((resolve) => setTimeout(resolve, 500));
        const alertDetails = await triageService.getAlertById(alertId);
        setAlert(alertDetails);

        if (alertDetails.case_id) {
          queryClient.invalidateQueries({
            queryKey: ['case', alertDetails.case_id],
          });
        }

        setLoadingHistory(true);
        try {
          const history = await triageService.getAlertActionHistory(alertId);
          setActionHistory(Array.isArray(history) ? history : []);
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
  }, [alertId, isOpen, queryClient]);

  // Check if Complete New Case task is completed
  useEffect(() => {
    const checkCompleteNewCaseStatus = async () => {
      if (!alert?.case_id) {
        setIsCompleteNewCaseCompleted(false);
        return;
      }

      try {
        const tasks = await taskService.getTasksByCaseId(alert.case_id);
        const completeNewCaseTask = tasks.find(
          (task: TaskForSupervisor) => task.name === 'Complete New Case',
        );

        if (completeNewCaseTask) {
          setIsCompleteNewCaseCompleted(
            completeNewCaseTask.status === 'STATUS_30_COMPLETED',
          );
        } else {
          setIsCompleteNewCaseCompleted(false);
        }
      } catch (error) {
        console.error('Failed to fetch tasks for case:', error);
        setIsCompleteNewCaseCompleted(false);
      }
    };

    checkCompleteNewCaseStatus();
  }, [alert?.case_id, isOpen]);

  // Check if user has access to view the case using SAME logic as dashboard
  useEffect(() => {
    const checkCaseAccess = async () => {
      if (!alert?.case_id) {
        setHasCaseAccess(true); // No case to check
        return;
      }

      try {
        const hasAccess = await caseService.checkCaseAccess(alert.case_id);
        setHasCaseAccess(hasAccess);
      } catch (error) {
        console.error('Failed to check case access:', error);
        setHasCaseAccess(false); // Deny access on error
      }
    };

    checkCaseAccess();
  }, [alert?.case_id]);

  if (!isOpen) {
    return null;
  }

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
            <p className="mt-2 text-sm text-gray-600">
              {error ?? 'An error occurred while loading the alert'}
            </p>
            <div className="mt-6 flex justify-center space-x-3">
              <button
                onClick={() => {
                  window.location.reload();
                }}
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

  if (!alert) {
    return null;
  }

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

  const triggeredTypologies = extractTriggeredTypologies(alert);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen pt-4 px-4 pb-20 text-center sm:p-0">
        {}
        <div
          className="fixed inset-0 bg-gray-900 opacity-60 transition-opacity"
          onClick={() => {
            if (alert?.case_id) {
              queryClient.invalidateQueries({
                queryKey: ['case', alert.case_id],
              });
            }
            onAlertUpdated?.();
            onClose();
          }}
          aria-hidden="true"
        ></div>

        {}
        <div className="relative inline-block align-middle bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:max-w-5xl sm:w-full">
          {}
          <div className="absolute top-0 right-0 pt-4 pr-4 z-10">
            <button
              onClick={() => {
                if (alert?.case_id) {
                  queryClient.invalidateQueries({
                    queryKey: ['case', alert.case_id],
                  });
                }
                onAlertUpdated?.();
                onClose();
              }}
              className="bg-white rounded-md text-gray-400 hover:text-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <span className="sr-only">Close</span>
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>

          {}
          <div className="bg-white px-4 pt-4 pb-4 max-h-[85vh] overflow-y-auto">
            <div className="max-w-4xl mx-auto">
              {}
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

                    {}
                    <div className="flex items-center space-x-2 ml-4">
                      {}
                      {(() => {
                        const triageCompleted = actionHistory.some((action) =>
                          action.operation.includes('ALERT_UPDATED'),
                        );
                        const showButton =
                          canPerformActions &&
                          onManualTriage &&
                          (isManualMode ?? isDisabledMode) &&
                          !isAIMode &&
                          !triageCompleted &&
                          !isCompleteNewCaseCompleted;

                        return showButton && onManualTriage ? (
                          <button
                            onClick={() => {
                              onManualTriage(convertToLegacyAlert(alert));
                            }}
                            className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-md transition-colors"
                            title={
                              isManualMode
                                ? 'Perform manual triage - update alert and make case decision'
                                : 'Update alert details - direct investigation mode'
                            }
                          >
                            {isManualMode ? 'Update Alert' : 'Update Alert'}
                          </button>
                        ) : null;
                      })()}

                      {}
                      {isAIMode && (
                        <span className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 rounded-md border border-blue-200">
                          AI Processed
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="text-lg text-gray-600 mb-1">
                    {alert?.alert_data?.status ?? 'No message available'}
                  </p>
                  <p className="text-sm text-gray-500">
                    Alert ID: {alert.alert_id} • Source: {alert.source ?? 'N/A'}
                  </p>
                </div>
              </div>

              {}
              <div className="bg-white rounded-lg mb-4">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
                  {}
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
                          {formatDate(alert.created_at)}
                        </p>
                      </div>
                      <div>
                        <span className="text-sm font-medium text-gray-500">
                          Case Status:
                        </span>
                        <p className="text-sm text-gray-900">
                          {caseDetails?.status ?? 'Loading...'}
                        </p>
                      </div>
                      {caseDetails?.case_id && (
                        <div>
                          <span className="text-sm font-medium text-gray-500">
                            Case ID:
                          </span>
                          {hasCaseAccess ? (
                            <button
                              onClick={() => {
                                navigate(`/cases/${alert.case_id}`);
                                onClose();
                                onNavigateToCase?.();
                              }}
                              className="flex items-center gap-1 text-sm text-gray-900 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                              title="View case details"
                            >
                              <span>{alert.case_id}</span>
                              <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                            </button>
                          ) : (
                            <div
                              className="flex items-center gap-1 text-sm text-gray-500 cursor-not-allowed"
                              title="You don't have permission to view this case"
                            >
                              <span>{alert.case_id}</span>
                              <ArrowTopRightOnSquareIcon className="w-4 h-4 opacity-50" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {}
                  <div className="flex-1 lg:max-w-[48%] bg-white rounded-lg">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">
                      Transaction Data
                    </h4>
                    <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                      {alert.transaction ? (
                        <pre
                          className="whitespace-pre-wrap break-words max-h-64 overflow-auto text-sm"
                          dangerouslySetInnerHTML={{
                            __html: syntaxHighlightJson(alert.transaction),
                          }}
                        />
                      ) : (
                        <div className="text-sm text-gray-600">
                          No transaction data
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {}
              <div className="bg-white rounded-lg mb-4">
                <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6">
                  {}
                  <div className="w-full bg-white rounded-lg">
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
                              <ActionHistoryItem action={action} />
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

              {}
              <div className="rounded-lg border border-gray-200 bg-white p-5 mb-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-4">
                  Triggered Typologies
                </h4>
                <div className="space-y-3">
                  {triggeredTypologies.length > 0 ? (
                    triggeredTypologies.map((typology) => (
                      <div
                        key={typology.typologyId}
                        className="rounded-lg border border-gray-200 bg-gray-50"
                      >
                        <button
                          onClick={() => {
                            toggleTypology(typology.typologyId);
                          }}
                          className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-100 transition-colors"
                        >
                          <div className="flex items-center gap-3 flex-1">
                            {expandedTypologies.has(typology.typologyId) ? (
                              <ChevronUpIcon className="h-4 w-4 text-gray-500" />
                            ) : (
                              <ChevronDownIcon className="h-4 w-4 text-gray-500" />
                            )}
                            <div className="flex items-center gap-3 flex-wrap">
                              <div
                                className={`h-2 w-2 rounded-full ${getScoreColor(
                                  typology.typologyScore,
                                )}`}
                              />

                              <span className="text-sm font-medium text-gray-900">
                                {typology.typologyCfg}
                              </span>

                              <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">
                                Alert Threshold: {typology.alertThreshold}
                              </span>

                              <span className="text-xs font-medium text-orange-700 bg-orange-100 px-2 py-0.5 rounded">
                                Interdiction Threshold:{' '}
                                {typology.interdictionThreshold}
                              </span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span
                              className={`text-sm font-semibold ${getScoreTextColor(
                                typology.typologyScore,
                              )}`}
                            >
                              Typology Score:{' '}
                              {typology.typologyScore.toFixed(2)}
                            </span>
                            {/* <div className="w-24 bg-gray-200 rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${getScoreColor(
                                  typology.typologyScore,
                                )}`}
                                style={{
                                  width: `${Math.min(
                                    typology.typologyScore,
                                    100,
                                  )}%`,
                                }}
                              />
                            </div> */}
                          </div>
                        </button>

                        {expandedTypologies.has(typology.typologyId) && (
                          <div className="px-4 pb-4 space-y-2 border-t border-gray-200 pt-3 bg-white">
                            {typology.rules.length > 0 ? (
                              typology.rules.map((rule, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-start gap-2"
                                >
                                  <div className="flex-shrink-0 mt-1">
                                    <div className="h-1.5 w-1.5 rounded-full bg-gray-400" />
                                  </div>
                                  <div>
                                    <div className="text-sm text-gray-900">
                                      {rule.ruleId}
                                    </div>
                                    <div className="text-xs text-gray-500 mt-0.5">
                                      Weight: {rule.ruleWeight.toFixed(2)}
                                    </div>
                                    {rule.subRef && (
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        Sub-ref: {rule.subRef}
                                      </div>
                                    )}
                                    {rule.independentVariable != null && (
                                      <div className="text-xs text-gray-500 mt-0.5">
                                        Independent Variable:{' '}
                                        {String(rule.independentVariable)}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="text-sm text-gray-500">
                                No rules
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-sm text-gray-500 py-4">
                      No typologies triggered
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
