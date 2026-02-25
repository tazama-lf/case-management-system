import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  DocumentTextIcon,
  ExclamationTriangleIcon,
  UserPlusIcon,
  ClockIcon,
  ArrowPathIcon,
  UserMinusIcon,
  FolderOpenIcon,
  DocumentCheckIcon,
} from '@heroicons/react/24/outline';
import type { CaseRow } from '../casesTable.utils';
import authService from '@/features/auth/services/authService';
import { caseHistoryService } from '../../services/caseHistoryService';
import { taskHistoryService } from '../../services/taskHistoryService';
import { formatDate } from '@/shared/utils/dateUtils';


interface CaseHistoryEvent {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  userId?: string;
  details: string;
  type: 'case' | 'task';
}

interface CaseHistoryTabProps {
  caseId: number;
  row?: CaseRow;
}

const getEventIcon = (outcome: string, action: string) => {
  // Select icon based on action type
  let IconComponent = DocumentTextIcon;
  const actionLower = action.toLowerCase();

  if (actionLower.includes('created') || actionLower.includes('submitted')) {
    IconComponent = FolderOpenIcon;
  } else if (actionLower.includes('reassigned')) {
    IconComponent = ArrowPathIcon;
  } else if (actionLower.includes('unassigned')) {
    IconComponent = UserMinusIcon;
  } else if (actionLower.includes('assigned')) {
    IconComponent = UserPlusIcon;
  } else if (actionLower.includes('completed') || actionLower.includes('closed')) {
    IconComponent = CheckCircleIcon;
  } else if (actionLower.includes('approved')) {
    IconComponent = DocumentCheckIcon;
  } else if (actionLower.includes('pending') || actionLower.includes('awaiting')) {
    IconComponent = ClockIcon;
  } else if (actionLower.includes('returned') || actionLower.includes('rejected')) {
    IconComponent = ArrowPathIcon;
  } else if (actionLower.includes('abandoned') || actionLower.includes('suspended') || actionLower.includes('error')) {
    IconComponent = ExclamationTriangleIcon;
  }

  const bgColor = outcome === 'success' ? 'bg-green-100' :
    outcome === 'error' ? 'bg-red-100' :
      outcome === 'warning' ? 'bg-yellow-100' :
        'bg-blue-100';

  const iconColor = outcome === 'success' ? 'text-green-600' :
    outcome === 'error' ? 'text-red-600' :
      outcome === 'warning' ? 'text-yellow-600' :
        'text-blue-600';

  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded ${bgColor}`}>
      <IconComponent className={`h-5 w-5 ${iconColor}`} />
    </div>
  );
};

const mapOutcomeToEventOutcome = (outcome: string): 'success' | 'warning' | 'error' | 'info' => {
  if (!outcome) return 'info';
  const lowerOutcome = outcome.toLowerCase();
  if (lowerOutcome === 'success' || lowerOutcome === 'completed' || lowerOutcome === 'approved') return 'success';
  if (lowerOutcome === 'error' || lowerOutcome === 'failed' || lowerOutcome === 'denied') return 'error';
  if (lowerOutcome === 'warning' || lowerOutcome === 'pending') return 'warning';
  return 'info';
};

const formatOperation = (operation: string): string => {
  // Convert camelCase or snake_case to Title Case
  return operation
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (str) => str.toUpperCase())
    .trim();
};

const mapStatusToEvent = (
  status: string,
  timestamp: string
): Omit<CaseHistoryEvent, 'id' | 'userId' | 'type'> | null => {
  const statusMap: Record<string, { action: string; details: string; outcome: 'success' | 'warning' | 'error' | 'info' }> = {
    STATUS_00_DRAFT: {
      action: 'Case drafted',
      details: 'Case created as draft',
      outcome: 'info',
    },
    STATUS_01_PENDING_CASE_CREATION_APPROVAL: {
      action: 'Pending approval',
      details: 'Case awaiting supervisor approval for creation',
      outcome: 'warning',
    },
    STATUS_02_READY_FOR_ASSIGNMENT: {
      action: 'Ready for assignment',
      details: 'Case approved and ready to be assigned to an investigator',
      outcome: 'info',
    },
    STATUS_03_RETURNED: {
      action: 'Returned for review',
      details: 'Case returned for additional review',
      outcome: 'warning',
    },
    STATUS_10_ASSIGNED: {
      action: 'Case assigned',
      details: 'Case assigned to investigator',
      outcome: 'info',
    },
    STATUS_20_IN_PROGRESS: {
      action: 'Investigation in progress',
      details: 'Investigation is currently underway',
      outcome: 'info',
    },
    STATUS_21_SUSPENDED: {
      action: 'Case suspended',
      details: 'Investigation temporarily suspended',
      outcome: 'warning',
    },
    STATUS_22_PENDING_FINAL_APPROVAL: {
      action: 'Pending final approval',
      details: 'Case closure awaiting supervisor approval',
      outcome: 'warning',
    },
    STATUS_30_PENDING_REOPENING: {
      action: 'Pending reopening',
      details: 'Case reopening request awaiting approval',
      outcome: 'warning',
    },
    STATUS_31_REOPENED: {
      action: 'Case reopened',
      details: 'Case has been reopened for further investigation',
      outcome: 'info',
    },
    STATUS_71_AUTOCLOSED_CONFIRMED: {
      action: 'Autoclosed - Confirmed',
      details: 'Case automatically closed and confirmed by system',
      outcome: 'success',
    },
    STATUS_72_AUTOCLOSED_REFUTED: {
      action: 'Autoclosed - Refuted',
      details: 'Case automatically closed and refuted by system',
      outcome: 'success',
    },
    STATUS_81_CLOSED_REFUTED: {
      action: 'Case closed - Refuted',
      details: 'Investigation completed and case closed as refuted',
      outcome: 'success',
    },
    STATUS_82_CLOSED_CONFIRMED: {
      action: 'Case closed - Confirmed',
      details: 'Investigation completed and case closed as confirmed',
      outcome: 'success',
    },
    STATUS_83_CLOSED_INCONCLUSIVE: {
      action: 'Case closed - Inconclusive',
      details: 'Investigation completed but results inconclusive',
      outcome: 'success',
    },
    STATUS_99_ABANDONED: {
      action: 'Case abandoned',
      details: 'Case has been abandoned',
      outcome: 'error',
    },
  };

  const eventData = statusMap[status];
  if (!eventData) return null;

  return {
    timestamp,
    action: eventData.action,
    performedBy: 'System',
    details: eventData.details,
  };
};

const CaseHistoryTab: React.FC<CaseHistoryTabProps> = ({ caseId }) => {
  const [history, setHistory] = useState<CaseHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [investigators, setInvestigators] = useState<Record<string, string>>({});

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        try {
          const investigatorList = await authService.fetchAllInvestigators();
          const investigatorMap: Record<string, string> = {};
          investigatorList.forEach((inv) => {
            const fullName =
              inv.firstName && inv.lastName
                ? `${inv.firstName} ${inv.lastName}`
                : inv.username;
            investigatorMap[inv.id] = fullName;
          });
          setInvestigators(investigatorMap);
        } catch (err) {
          console.warn('Failed to fetch investigators:', err);
        }

        const events: CaseHistoryEvent[] = [];

        try {
          const caseHistory = await caseHistoryService.getCaseHistory(caseId);
          const taskHistory = await taskHistoryService.getCaseHistory(caseId);

          caseHistory.forEach((log) => {
            let action = formatOperation(log.operation);
            const details = log.action_performed || 'Action performed';

            const operationLower = log.operation.toLowerCase().replace(/\s|_/g, '');

            if (operationLower.includes('createcase') || operationLower.includes('createmanualcase')) {
              action = 'Case created';
            }
            else if (operationLower.includes('savecaseasdraft')) {
              action = 'Case saved as draft';
            }
            else if (operationLower.includes('completecase')) {
              action = 'Case completed';
            }
            else if (operationLower.includes('completecasecreation')) {
              action = 'Case creation completed';
            }
            else if (operationLower.includes('updatecasestatus')) {
              action = 'Case status updated';
            }
            else if (operationLower === 'updatecase') {
              action = 'Case updated';
            }
            else if (operationLower.includes('suspendcase')) {
              action = 'Case suspended';
            }
            else if (operationLower.includes('resumecase')) {
              action = 'Case resumed';
            }
            else if (operationLower.includes('closecase') && details.toLowerCase().includes('approval')) {
              action = 'Case closure submitted for approval';
            }
            else if (operationLower.includes('closecase')) {
              action = 'Case closed';
            }
            else if (operationLower.includes('abandoncase')) {
              action = 'Case abandoned';
            }
            else if (operationLower.includes('reopencase')) {
              action = 'Case reopened';
            }
            else if (operationLower.includes('approvecasecreation')) {
              action = 'Approve case creation';
            }
            else if (operationLower.includes('rejectcasecreation')) {
              action = 'Reject case creation';
            }
            else if (operationLower.includes('approvecaseclosure')) {
              action = 'Case approved';
            }
            else if (operationLower.includes('rejectcaseclosure')) {
              action = 'Case rejected';
            }
            else if (operationLower.includes('approvecasereopening')) {
              action = 'Approve case reopening';
            }
            else if (operationLower.includes('rejectcasereopening')) {
              action = 'Reject case reopening';
            }
            else if (operationLower.includes('returncaseforreview')) {
              action = 'Case returned for review';
            }
            else if (operationLower.includes('autoclosed')) {
              action = 'Case auto-closed';
            }

            events.push({
              id: `event-${log.case_id}`,
              timestamp: log.performed_at instanceof Date
                ? log.performed_at.toISOString()
                : new Date(log.performed_at).toISOString(),
              action: action,
              performedBy: log.entity_name === 'System' ? 'System' : 'User',
              userId: log.user_id,
              details: details,
              type: 'case',
            });
          });

          taskHistory.forEach((log) => {
            let action = formatOperation(log.operation);
            const details = log.action_performed || 'Action performed';

            const operationLower = log.operation.toLowerCase().replace(/\s|_/g, '');
            const actionLower = (log.action_performed || '').toLowerCase();

            if (operationLower.includes('createtask')) {
              action = 'Task created';
            }
            else if (operationLower.includes('createsartask')) {
              action = 'SAR/STR task created';
            }
            else if (operationLower.includes('updatetask')) {
              action = 'Task updated';
            }
            else if (operationLower.includes('claimtask')) {
              action = 'Task claimed';
            }
            else if (operationLower.includes('selfassigntask')) {
              action = 'Task self-assigned';
            }
            else if (operationLower.includes('reassigntask')) {
              action = 'Task reassigned';
            }
            else if (operationLower.includes('unassigntask')) {
              action = 'Task unassigned';
            }
            else if (operationLower.includes('assigntask')) {
              action = 'Task assigned';
            }
            // else if (operationLower.includes('retrievetask')) {
            //   action = 'Task retrieved';
            // }
            else if (operationLower.includes('completetask')) {
              action = 'Task completed';
            }

            else if (operationLower.includes('upload') || actionLower.includes('evidence')) {
              action = 'Evidence uploaded';
            }

            else if (operationLower.includes('assigntasktoinvestigator')) {
              action = 'Assign Task to Investigator';
            }

            else if (operationLower.includes('investigationtasktriggered')) {
              action = 'Investigation task triggered';
            }
            else if (operationLower.includes('triagealertupdated')) {
              action = 'Triage alert updated';
            }
            else {
              // Keep the default action
            }

            events.push({
              id: `task-${log.task_id}`,
              timestamp:
                log.performed_at instanceof Date
                  ? log.performed_at.toISOString()
                  : new Date(log.performed_at).toISOString(),
              action,
              performedBy: log.entity_name === 'System' ? 'System' : 'User',
              userId: log.user_id,
              details,
              type: 'task',
            });
          });

        } catch (err) {
          console.warn('Failed to fetch case History:', err);
        }

        // const uniqueEvents = Array.from(
        //   new Map(events.map(event => [event.id, event])).values()
        // );

        events.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );

        setHistory(events);
      } catch (err) {
        console.error('Failed to fetch case history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [caseId]);

  const formatActionText = (text?: string) => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };



  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Timeline Header */}
      <h3 className="text-xl font-semibold text-gray-900 text-center mb-8">Case Timeline</h3>

      {/* Timeline Events */}
      {sortedHistory.length > 0 ? (
        <div className="relative max-w-4xl mx-auto">
          {/* Continuous vertical line in center */}
          <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-gray-300 -translate-x-1/2"></div>

          {sortedHistory.map((event, index) => {
            const isLeft = index % 2 === 0;

            return (
              <div key={index} className="relative pb-12 last:pb-0">
                {/* Timeline dot in center */}
                <div className="absolute left-1/2 top-6 w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-md -translate-x-1/2 z-10"></div>

                {isLeft ? (
                  // Left side layout (date on left, content on right)
                  <div className="flex items-start gap-8">
                    <div className="w-1/2 text-right pr-8">
                      <div className="text-sm text-gray-500">{formatDate(event.timestamp)}</div>
                    </div>
                    <div className="w-1/2 pl-8">
                      <div className="space-y-1">
                        <div className="font-semibold text-gray-900">{formatActionText(event.action)}</div>
                        {event.details && (
                          <div className="text-sm text-gray-600">{event.details}</div>
                        )}
                        {/* {event.userId && investigators[event.userId] && (
                          <div className="text-sm text-blue-600">
                            {event.type === 'task' && event.action.includes('assigned')
                              ? `Assigned to ${investigators[event.userId]}`
                              : event.performedBy === 'System'
                                ? `Related to ${investigators[event.userId]}`
                                : `By ${investigators[event.userId]}`}
                          </div>
                        )} */}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Right side layout (content on left, date on right)
                  <div className="flex items-start gap-8">
                    <div className="w-1/2 text-right pr-8">
                      <div className="space-y-1">
                        <div className="font-semibold text-gray-900">{formatActionText(event.action)}</div>
                        {event.details && (
                          <div className="text-sm text-gray-600">{event.details}</div>
                        )}
                        {/* {event.userId && investigators[event.userId] && (
                          <div className="text-sm text-blue-600">
                            {event.type === 'task' && event.action.includes('assigned')
                              ? `Assigned to ${investigators[event.userId]}`
                              : event.performedBy === 'System'
                                ? `Related to ${investigators[event.userId]}`
                                : `By ${investigators[event.userId]}`}
                          </div>
                        )} */}
                      </div>
                    </div>
                    <div className="w-1/2 pl-8">
                      <div className="text-sm text-gray-500">{formatDate(event.timestamp)}</div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center text-gray-500 py-8">
          No history events available for this case
        </div>
      )}
    </div>
  );
};

export default CaseHistoryTab;
