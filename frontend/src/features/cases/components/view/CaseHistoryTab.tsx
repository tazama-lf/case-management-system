import React, { useState, useEffect } from 'react';
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

const formatOperation = (operation: string): string =>
  // Convert camelCase or snake_case to Title Case
  operation
    .replace(/([A-Z])/gu, ' $1')
    .replace(/_/gu, ' ')
    .replace(/^./u, (str) => str.toUpperCase())
    .trim();

const CaseHistoryTab: React.FC<CaseHistoryTabProps> = ({ caseId }) => {
  const [history, setHistory] = useState<CaseHistoryEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async (): Promise<void> => {
      try {
        setLoading(true);

        try {
          await authService.fetchAllInvestigators();
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

            const operationLower = log.operation
              .toLowerCase()
              .replace(/\s|_/gu, '');

            if (
              operationLower.includes('createcase') ||
              operationLower.includes('createmanualcase')
            ) {
              action = 'Case created';
            } else if (operationLower.includes('savecaseasdraft')) {
              action = 'Case saved as draft';
            } else if (operationLower.includes('completecase')) {
              action = 'Case completed';
            } else if (operationLower.includes('completecasecreation')) {
              action = 'Case creation completed';
            } else if (operationLower.includes('updatecasestatus')) {
              action = 'Case status updated';
            } else if (operationLower === 'updatecase') {
              action = 'Case updated';
            } else if (operationLower.includes('suspendcase')) {
              action = 'Case suspended';
            } else if (operationLower.includes('resumecase')) {
              action = 'Case resumed';
            } else if (
              operationLower.includes('closecase') &&
              details.toLowerCase().includes('approval')
            ) {
              action = 'Case closure submitted for approval';
            } else if (operationLower.includes('closecase')) {
              action = 'Case closed';
            } else if (operationLower.includes('abandoncase')) {
              action = 'Case abandoned';
            } else if (operationLower.includes('reopencase')) {
              action = 'Case reopened';
            } else if (operationLower.includes('approvecasecreation')) {
              action = 'Approve case creation';
            } else if (operationLower.includes('rejectcasecreation')) {
              action = 'Reject case creation';
            } else if (operationLower.includes('approvecaseclosure')) {
              action = 'Case approved';
            } else if (operationLower.includes('rejectcaseclosure')) {
              action = 'Case rejected';
            } else if (operationLower.includes('approvecasereopening')) {
              action = 'Approve case reopening';
            } else if (operationLower.includes('rejectcasereopening')) {
              action = 'Reject case reopening';
            } else if (operationLower.includes('returncaseforreview')) {
              action = 'Case returned for review';
            } else if (operationLower.includes('autoclosed')) {
              action = 'Case auto-closed';
            }

            events.push({
              id: `event-${log.case_id}`,
              timestamp:
                log.performed_at instanceof Date
                  ? formatDate(log.performed_at.toISOString())
                  : formatDate(new Date(log.performed_at).toISOString()),
              action,
              performedBy: log.entity_name === 'System' ? 'System' : 'User',
              userId: log.user_id,
              details,
              type: 'case',
            });
          });

          taskHistory.forEach((log) => {
            let action = formatOperation(log.operation);
            const details = log.action_performed ?? 'Action performed';

            const operationLower = log.operation
              .toLowerCase()
              .replace(/\s|_/gu, '');
            const actionLower = (log.action_performed || '').toLowerCase();

            if (operationLower.includes('createtask')) {
              action = 'Task created';
            } else if (operationLower.includes('createsartask')) {
              action = 'SAR/STR task created';
            } else if (operationLower.includes('updatetask')) {
              action = 'Task updated';
            } else if (operationLower.includes('claimtask')) {
              action = 'Task claimed';
            } else if (operationLower.includes('selfassigntask')) {
              action = 'Task self-assigned';
            } else if (operationLower.includes('reassigntask')) {
              action = 'Task reassigned';
            } else if (operationLower.includes('unassigntask')) {
              action = 'Task unassigned';
            } else if (operationLower.includes('assigntask')) {
              action = 'Task assigned';
            }
            else if (operationLower.includes('completetask')) {
              action = 'Task completed';
            } else if (
              operationLower.includes('upload') ||
              actionLower.includes('evidence')
            ) {
              action = 'Evidence uploaded';
            } else if (operationLower.includes('assigntasktoinvestigator')) {
              action = 'Assign Task to Investigator';
            } else if (operationLower.includes('investigationtasktriggered')) {
              action = 'Investigation task triggered';
            } else if (operationLower.includes('triagealertupdated')) {
              action = 'Triage alert updated';
            } else {
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

  const formatActionText = (text?: string): string => {
    if (!text) return '';
    return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
  };

  const sortedHistory = [...history].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
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
      <h3 className="text-xl font-semibold text-gray-900 text-center mb-8">
        Case Timeline
      </h3>

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
                      <div className="text-sm text-gray-500">
                        {formatDate(event.timestamp)}
                      </div>
                    </div>
                    <div className="w-1/2 pl-8">
                      <div className="space-y-1">
                        <div className="font-semibold text-gray-900">
                          {formatActionText(event.action)}
                        </div>
                        {event.details && (
                          <div className="text-sm text-gray-600">
                            {event.details}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  // Right side layout (content on left, date on right)
                  <div className="flex items-start gap-8">
                    <div className="w-1/2 text-right pr-8">
                      <div className="space-y-1">
                        <div className="font-semibold text-gray-900">
                          {formatActionText(event.action)}
                        </div>
                        {event.details && (
                          <div className="text-sm text-gray-600">
                            {event.details}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="w-1/2 pl-8">
                      <div className="text-sm text-gray-500">
                        {formatDate(event.timestamp)}
                      </div>
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
