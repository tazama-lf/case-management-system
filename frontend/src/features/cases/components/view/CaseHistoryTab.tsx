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
import { caseService } from '../../services/caseService';
import { taskService } from '../../services/taskService';
import authService from '@/features/auth/services/authService';
import type { Case } from '@/features/alerts/types/triage.types';
import { useAuth } from '@/features/auth/components/AuthContext';

interface CaseHistoryEvent {
  id: string;
  timestamp: string;
  action: string;
  performedBy: string;
  userId?: string;
  details: string;
  outcome: 'success' | 'warning' | 'error' | 'info';
  type: 'case' | 'task' | 'audit';
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
    outcome: eventData.outcome,
  };
};

const CaseHistoryTab: React.FC<CaseHistoryTabProps> = ({ caseId }) => {
  const [history, setHistory] = useState<CaseHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [investigators, setInvestigators] = useState<Record<string, string>>({});
  const { hasInvestigatorRole, hasSupervisorRole } = useAuth();
  const isInvestigatorOnly = hasInvestigatorRole() && !hasSupervisorRole();

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
          const caseDetails: Case = await caseService.getCaseDetails(caseId);

          if (caseDetails.case_creation_type !== null && caseDetails.case_creation_type !== undefined && caseDetails.case_creation_type.length > 0 &&
            caseDetails.case_creation_type.toLowerCase() === 'MANUAL'.toLowerCase() && isInvestigatorOnly) {
            events.push({
              id: `case-created-${caseDetails.case_id}`,
              timestamp: caseDetails.created_at,
              action: 'Case submitted for approval',
              performedBy: 'System',
              userId: caseDetails.case_creator_user_id,
              details: `Case created with priority ${caseDetails.priority} and type ${caseDetails.case_type}`,
              outcome: 'info',
              type: 'case',
            });
          }


          if (caseDetails.case_owner_user_id && caseDetails.case_owner_user_id !== caseDetails.case_creator_user_id) {
            events.push({
              id: `case-assigned-${caseDetails.case_id}`,
              timestamp: caseDetails.updated_at,
              action: 'Case assigned to investigator',
              performedBy: 'System',
              userId: caseDetails.case_owner_user_id,
              details: `Case assigned to investigator for review`,
              outcome: 'info',
              type: 'case',
            });
          }


          const statusEvent = mapStatusToEvent(caseDetails.status, caseDetails.updated_at);
          if (statusEvent) {
            events.push({
              ...statusEvent,
              id: `case-status-${caseDetails.case_id}`,
              userId: caseDetails.case_owner_user_id,
              type: 'case',
            });
          }
        } catch (err) {
          console.warn('Failed to fetch case details:', err);
        }


        try {
          const tasks = await taskService.getTasksByCaseId(caseId);

          tasks.forEach((task) => {
            // Only add task creation event (don't add task assignment here, let audit logs handle it)
            events.push({
              id: `task-created-${task.task_id}`,
              timestamp: task.created_at,
              action: task.name || 'Task created',
              performedBy: 'System',
              userId: undefined, // Don't set userId for creation
              details: task.description || 'Task created and ready for assignment',
              outcome: 'info',
              type: 'task',
            });

            // Check current task status for unassignment
            if (task.status === 'STATUS_01_UNASSIGNED' && task.updated_at !== task.created_at) {
              // Task was unassigned (updated_at differs from created_at means it changed)
              events.push({
                id: `task-unassigned-${task.task_id}`,
                timestamp: task.updated_at,
                action: 'Task unassigned',
                performedBy: 'System',
                userId: undefined,
                details: `${task.name || 'Task'} was unassigned from investigator`,
                outcome: 'warning',
                type: 'task',
              });
            }

            // Check for completed tasks
            if (task.status === 'STATUS_30_COMPLETED') {
              events.push({
                id: `task-completed-${task.task_id}`,
                timestamp: task.updated_at,
                action: 'Investigation completed',
                performedBy: task.assignedUser?.username || 'Investigator',
                userId: task.assigned_user_id,
                details: `${task.name || 'Task'} completed and evidence collected`,
                outcome: 'success',
                type: 'task',
              });
            }
          });
        } catch (err) {
          console.warn('Failed to fetch tasks:', err);
        }

        try {
          const eventLogs = await caseService.getCaseHistoryByEvent(caseId);

          eventLogs.forEach((log) => {
            let action = formatOperation(log.operation);
            let details = log.action_performed || 'Action performed';

            // Detect specific operations for better labeling
            const actionLower = log.action_performed?.toLowerCase() || '';
            const operationLower = log.operation.toLowerCase();

            // Handle task reassignment
            if (operationLower.includes('reassign') || actionLower.includes('reassign')) {
              action = 'Task reassigned';
              if (actionLower.includes('from') && actionLower.includes('to')) {
                details = log.action_performed;
              } else {
                details = 'Task was reassigned to a different investigator';
              }
            }
            // Handle task unassignment
            else if (operationLower.includes('unassign') || actionLower.includes('unassign')) {
              action = 'Task unassigned';
              details = log.action_performed || 'Task was unassigned from investigator';
            }
            // Handle task assignment (but not reassignment)
            else if ((operationLower.includes('assign') && !operationLower.includes('reassign') && !operationLower.includes('unassign')) ||
              (actionLower.includes('assign') && !actionLower.includes('reassign') && !actionLower.includes('unassign'))) {
              action = 'Task assigned';
            }
            // Handle case status changes
            else if (operationLower.includes('updatecase') || operationLower.includes('update_case')) {
              if (actionLower.includes('status')) {
                action = 'Case status updated';
              }
            }
            // Handle evidence uploads
            else if (operationLower.includes('evidence') || actionLower.includes('evidence')) {
              action = 'Evidence uploaded';
            }
            // Handle comments
            else if (operationLower.includes('comment') || actionLower.includes('comment')) {
              action = 'Comment added';
            }

            events.push({
              id: `audit-${log.id}`,
              timestamp: log.performed_at instanceof Date
                ? log.performed_at.toISOString()
                : new Date(log.performed_at).toISOString(),
              action: action,
              performedBy: log.entity_name === 'System' ? 'System' : 'User',
              userId: log.user_id,
              details: details,
              outcome: mapOutcomeToEventOutcome(log.outcome),
              type: 'audit',
            });
          });
        } catch (err) {
          console.warn('Failed to fetch audit logs:', err);
        }

        const uniqueEvents = Array.from(
          new Map(events.map(event => [event.id, event])).values()
        );

        uniqueEvents.sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
        );

        setHistory(uniqueEvents);
      } catch (err) {
        console.error('Failed to fetch case history:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [caseId]);

  const formatTimestamp = (timestamp: string) => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return timestamp;
    }
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

    <div className="py-4">
      {/* Timeline Header */}
      <h3 className="text-base font-semibold text-gray-900 mb-6">Case Timeline</h3>
      <div className="space-y-6">
        {sortedHistory.length > 0 ? (
          sortedHistory.map((event) => (
            <div key={event.id} className="flex gap-4">
              {/* Icon */}
              <div className="flex-shrink-0">
                {getEventIcon(event.outcome, event.action)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-semibold text-gray-900">
                  {event.action}
                </h4>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatTimestamp(event.timestamp)}
                </p>
                <p className="text-sm text-gray-700 mt-1">
                  {event.details}
                </p>
                {event.userId && investigators[event.userId] && (
                  <p className="text-xs text-gray-600 mt-1">
                    {event.type === 'task' && event.action.includes('assigned')
                      ? `Assigned to ${investigators[event.userId]}`
                      : event.performedBy === 'System'
                        ? `Related to ${investigators[event.userId]}`
                        : `By ${investigators[event.userId]}`}
                  </p>
                )}
              </div>
            </div>
          ))
        ) : (
          <div className="text-center py-12">
            <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
            <p className="text-sm text-gray-600">
              No history events available for this case
            </p>
          </div>
        )
        }
      </div >
    </div >




    // <div className="py-4">
    //   {/* Timeline Header */}
    //   <h3 className="text-base font-semibold text-gray-900 mb-6">Case Timeline</h3>

    //   {/* Timeline Events */}
    //   <div className="space-y-6">
    //     {history.length > 0 ? (
    //       history.map((event) => (
    //         <div key={event.id} className="flex gap-4">
    //           {/* Icon */}
    //           <div className="flex-shrink-0">
    //             {getEventIcon(event.outcome, event.action)}
    //           </div>

    //           {/* Content */}
    //           <div className="flex-1 min-w-0">
    //             <h4 className="text-sm font-semibold text-gray-900">
    //               {event.action}
    //             </h4>
    //             <p className="text-xs text-gray-500 mt-0.5">
    //               {formatTimestamp(event.timestamp)}
    //             </p>
    //             <p className="text-sm text-gray-700 mt-1">
    //               {event.details}
    //             </p>
    //             {event.userId && investigators[event.userId] && (
    //               <p className="text-xs text-gray-600 mt-1">
    //                 {event.type === 'task' && event.action.includes('assigned')
    //                   ? `Assigned to ${investigators[event.userId]}`
    //                   : event.performedBy === 'System'
    //                     ? `Related to ${investigators[event.userId]}`
    //                     : `By ${investigators[event.userId]}`}
    //               </p>
    //             )}
    //           </div>
    //         </div>
    //       ))
    //     ) : (
    //       <div className="text-center py-12">
    //         <DocumentTextIcon className="h-12 w-12 text-gray-300 mx-auto mb-3" />
    //         <p className="text-sm text-gray-600">
    //           No history events available for this case
    //         </p>
    //       </div>
    //     )}
    //   </div>
    // </div>
  );
};

export default CaseHistoryTab;
