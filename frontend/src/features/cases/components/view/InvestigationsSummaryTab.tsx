import React, { useState, useEffect, lazy, Suspense } from 'react';
import {
  DocumentTextIcon,
  ChevronDownIcon,
  ChevronRightIcon,
} from '@heroicons/react/24/outline';
import { marked } from 'marked';
import type { CaseRow } from '../casesTable.utils';
import { caseService } from '../../services/caseService';
import { evidenceService } from '../../services/evidenceService';
import { commentService } from '../../services/commentService';
import { taskService, TaskStatus } from '../../services/taskService';
import userService from '../../services/userService';
import type { Case } from '@/features/alerts/types/triage.types';
import type { Evidence } from '../../types/evidence.types';
import type { TaskComment } from '../../services/commentService';
import { useToast } from '@/shared/providers/ToastProvider';
import authService from '@/features/auth/services/authService';
import type { UnifiedWorkQueueTask } from '../../types/task.types';
import type { TaskForSupervisor } from '../../services/taskService';
import { formatDate } from '@/shared/utils/dateUtils';

const CompleteTaskModal = lazy(
  async () => await import('../modals/CompleteTaskModal'),
);

marked.setOptions({
  breaks: true,
  gfm: true,
});

interface InvestigationSummaryTabProps {
  caseId: number;
  row?: CaseRow;
  onTaskUpdate?: () => void;
  refreshKey?: number;
  task?: TaskForSupervisor;
}

interface EvidenceCategory {
  type: string;
  count: number;
  description: string;
  evidence: Evidence[];
}

const InvestigationSummaryTab: React.FC<InvestigationSummaryTabProps> = ({
  caseId,
  onTaskUpdate,
  refreshKey,
  task,
}) => {
  const [currentTaskId, setCurrentTaskId] = useState<number | null>(null);
  const { success, error: toastError } = useToast();
  const [caseDetails, setCaseDetails] = useState<Case | null>(null);
  const [evidenceCategories, setEvidenceCategories] = useState<
    EvidenceCategory[]
  >([]);
  const [supervisorComments, setSupervisorComments] = useState<TaskComment[]>(
    [],
  );
  const [investigatorName, setInvestigatorName] = useState<string>('N/A');
  const [loading, setLoading] = useState(true);
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(
    new Set(),
  );
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [investigationNotes, setInvestigationNotes] = useState<string>('');
  const [investigationTask, setInvestigationTask] = useState<any>(null);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  // const [isSupervisor, setIsSupervisor] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | undefined>(
    undefined,
  );
  const [submittedDate, setSubmittedDate] = useState<string>('N/A');

  const mapToUnifiedWorkQueueTask = (
    task: any,
    caseDetails: Case | null,
  ): UnifiedWorkQueueTask => ({
    id: task.task_id,
    taskId: task.task_id,
    name: task.name ?? 'Unnamed Task',
    description: task.description,
    assignee: task.assigned_user_id,
    assigneeName: task.assignedUser?.username ?? task.assigned_user_id,
    candidateGroup: task.candidateGroup ?? 'investigations',
    status: task.status,
    priority: caseDetails?.priority ?? 'NEW',
    created: task.created_at,
    dueDate: task.sla_deadline ?? undefined,
    caseId: task.case_id,
  });

  const loadEvidence = React.useCallback(async (): Promise<void> => {
    if (!currentTaskId) return;
    const evidenceResponse =
      await evidenceService.getTaskEvidence(currentTaskId);

    const groupedByType = new Map<string, Evidence[]>();

    if (evidenceResponse.evidence && Array.isArray(evidenceResponse.evidence)) {
      evidenceResponse.evidence.forEach((evidence) => {
        const type = evidence.evidenceType ?? 'OTHER';
        if (!groupedByType.has(type)) {
          groupedByType.set(type, []);
        }
        groupedByType.get(type)!.push(evidence);
      });
    }
    const getDisplayLabel = (type: string): string => {
      switch (type) {
        case 'KYC':
          return 'KYC/EDD Report';
        case 'SANCTIONS':
          return 'Sanctions Screening';
        case 'ADVERSE_MEDIA':
          return 'Adverse Media Screening';
        case 'SAR_STR_FILING':
          return 'SAR/STR Filing Documentation';
        case 'OTHER':
          return 'Other supporting Documentation and Reference Materials';
        default:
          return type;
      }
    };

    const ORDERED_TYPES = [
      'KYC',
      'SANCTIONS',
      'ADVERSE_MEDIA',
      'SAR_STR_FILING',
      'OTHER',
    ];
    const categories: EvidenceCategory[] = [];

    ORDERED_TYPES.forEach((type) => {
      const items = groupedByType.get(type);
      if (!items) return;

      categories.push({
        type: getDisplayLabel(type),
        count: items.length,
        description: items.length === 1 ? 'document' : 'documents',
        evidence: items,
      });
    });

    groupedByType.forEach((items, type) => {
      if (ORDERED_TYPES.includes(type)) return;

      categories.push({
        type: getDisplayLabel(type),
        count: items.length,
        description: items.length === 1 ? 'document' : 'documents',
        evidence: items,
      });
    });

    setEvidenceCategories(categories);
  }, [currentTaskId]);

  const getOutcomeLabel = (status: string): string => {
    if (status?.includes('CONFIRMED')) return 'Confirmed Fraud';
    if (status?.includes('REFUTED')) return 'Refuted';
    if (status?.includes('INCONCLUSIVE')) return 'Inconclusive';
    return 'Under Investigation';
  };

  const getOutcomeColor = (status: string): string => {
    if (status?.includes('CONFIRMED')) return 'text-red-700 bg-red-50';
    if (status?.includes('REFUTED')) return 'text-green-700 bg-green-50';
    if (status?.includes('INCONCLUSIVE')) return 'text-yellow-700 bg-yellow-50';
    return 'text-blue-700 bg-blue-50';
  };

  const toggleCategory = (categoryType: string): void => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryType)) {
      newExpanded.delete(categoryType);
    } else {
      newExpanded.add(categoryType);
    }
    setExpandedCategories(newExpanded);
  };

  const handleCompleteTask = async (
    task: any,
    _notes?: string,
  ): Promise<void> => {
    try {
      const taskIdToComplete = task.task_id ?? task.id;
      await taskService.updateTaskForSupervisor(taskIdToComplete, {
        status: TaskStatus.STATUS_30_COMPLETED,
      });
      setShowCompleteModal(false);
      const tasks = await taskService.getTasksByCaseId(caseId);
      const updatedInvestigationTask = tasks.find(
        (t) => t.task_id === currentTaskId,
      );
      if (updatedInvestigationTask) {
        setInvestigationTask(updatedInvestigationTask);
      }

      success(
        'Task Completed Successfully',
        'Investigation task has been completed successfully.',
      );

      if (onTaskUpdate) {
        onTaskUpdate();
      }
    } catch (error) {
      toastError(
        'Failed to Complete Task',
        error instanceof Error ? error.message : 'An unknown error occurred',
      );
    }
  };

  const handleDownloadEvidence = async (
    evidenceId: string,
    fileName: string,
  ): Promise<void> => {
    try {
      setDownloadingId(evidenceId.toString());
      const blob = await evidenceService.downloadEvidence(evidenceId);

      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to download evidence:', error);
      alert(
        `Failed to download evidence: ${error instanceof Error ? error.message : 'Unknown error'}`,
      );
    } finally {
      setDownloadingId(null);
    }
  };

  useEffect(() => {
    if (task?.task_id) {
      setCurrentTaskId(task.task_id);
    }
  }, [task?.task_id]);

  useEffect(() => {
    const user = authService.getUser();
    const currentUserId = user?.userId;
    // const isSupervisor = user?.validatedClaims?.CMS_SUPERVISOR === true;
    // setIsSupervisor(isSupervisor);
    setCurrentUserId(currentUserId);
  }, []);

  useEffect(() => {
    loadEvidence();
  }, [loadEvidence, refreshKey]);

  useEffect(() => {
    if (!currentTaskId) return;
    const fetchCaseAndEvidence = async (): Promise<void> => {
      try {
        setLoading(true);
        const details = await caseService.getCaseDetails(caseId);
        setCaseDetails(details);

        try {
          const tasks = await taskService.getTasksByCaseId(caseId);

          // First find the current investigation task
          const investigationTask = tasks.find(
            (t) => t.task_id === currentTaskId,
          );

          // Then find the approval task that comes after this investigation task
          const approvalTask = investigationTask
            ? tasks
                .filter(
                  (t) =>
                    t.name?.toLowerCase().includes('approve') &&
                    new Date(t.created_at || 0).getTime() >
                      new Date(investigationTask.created_at || 0).getTime(),
                )
                .sort((a, b) => {
                  const dateA = new Date(a.created_at || 0).getTime();
                  const dateB = new Date(b.created_at || 0).getTime();
                  return dateA - dateB; // ascending order (earliest approval after investigation)
                })[0]
            : undefined;

          if (approvalTask) {
            const supervisorTaskComments =
              await commentService.getCommentsByTask(approvalTask.task_id);

            const supervisorComment = supervisorTaskComments.filter(
              (comment) =>
                comment.case_id === caseId &&
                comment.task_id === approvalTask.task_id &&
                comment.note.toLowerCase().includes('supervisor approval:'),
            );

            setSupervisorComments(supervisorComment || []);
          }

          if (investigationTask) {
            setInvestigationTask(investigationTask);
            if (investigationTask.investigationNotes) {
              setInvestigationNotes(investigationTask.investigationNotes);
            }
            if (investigationTask.updated_at) {
              setSubmittedDate(
                investigationTask.updated_at
                  ? formatDate(investigationTask.updated_at)
                  : 'N/A',
              );
            }
            if (investigationTask.assigned_user_id) {
              const userDetails = await userService.getUserDetailsById(
                investigationTask.assigned_user_id,
              );
              if (userDetails) {
                setInvestigatorName(userService.formatUserName(userDetails));
              }
            }
          }
        } catch (error) {
          console.error(
            'Failed to fetch supervisor comments or investigation notes:',
            error,
          );
        }
      } catch (error) {
        console.error(
          'Failed to fetch case details, evidence, or comments:',
          error,
        );
        setEvidenceCategories([]);
        setSupervisorComments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCaseAndEvidence();
  }, [caseId, refreshKey, currentTaskId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Case Details Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-4 flex-1">
            {/* Case ID Row */}
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">
                Case ID:
              </span>
              <span className="text-sm font-semibold text-gray-900 font-mono">
                {caseDetails?.case_id ? `CASE-${caseDetails.case_id}` : 'N/A'}
              </span>
            </div>

            {/* Other Details Row */}
            <div className="grid grid-cols-3 gap-6">
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">Type</p>
                <p className="text-sm font-semibold text-gray-900">
                  {caseDetails?.case_type ?? 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">
                  Investigator
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {investigatorName}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-medium mb-1">
                  Submitted
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {submittedDate}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 ml-6">
            {investigationTask &&
              investigationTask.status !== 'STATUS_30_COMPLETED' &&
              investigationTask.assigned_user_id === currentUserId && (
                <button
                  hidden={task?.status === 'STATUS_21_BLOCKED'}
                  onClick={() => {
                    setShowCompleteModal(true);
                  }}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-green-600 to-green-700 text-white text-sm font-medium rounded-md hover:from-green-700 hover:to-green-800 shadow-sm transition-all"
                >
                  <svg
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                  Complete Investigation
                </button>
              )}
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200"></div>

        {/* Recommended Outcome Section - Only show when case is closed */}
        {caseDetails?.status &&
          (caseDetails.status === 'STATUS_81_CLOSED_REFUTED' ||
            caseDetails.status === 'STATUS_82_CLOSED_CONFIRMED' ||
            caseDetails.status === 'STATUS_83_CLOSED_INCONCLUSIVE') && (
            <div className="rounded-lg border border-gray-200 bg-blue-50 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Recommended Outcome
              </h3>
              <div
                className={`inline-flex items-center px-3 py-1.5 rounded-md text-sm font-medium ${getOutcomeColor(caseDetails?.status ?? '')}`}
              >
                {getOutcomeLabel(caseDetails?.status ?? '')}
              </div>
            </div>
          )}

        {/* Investigation Notes Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Investigation Notes
          </h3>
          {investigationNotes ? (
            <div
              className="markdown-content text-sm text-gray-700 bg-gray-50 p-4 rounded border border-gray-200"
              dangerouslySetInnerHTML={{
                __html: (marked(investigationNotes) as string)
                  .replace(/(<\/p>\s*<ol>)/gu, '</p><br><ol>')
                  .replace(/(<\/p>\s*<ul>)/gu, '</p><br><ul>'),
              }}
            />
          ) : (
            <div className="text-sm text-gray-500 italic bg-gray-50 p-4 rounded border border-gray-200">
              No investigation notes available.
            </div>
          )}
        </div>

        {/* Supervisor Comments Section */}
        {supervisorComments.length > 0 && (
          <div className="rounded-lg border border-gray-200 bg-white p-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Supervisor Approval
            </h3>
            <div className="space-y-4">
              {/* Only show the most recent supervisor comment */}
              {(() => {
                const latestComment =
                  supervisorComments[supervisorComments.length - 1];
                return (
                  <div key={latestComment.comment_id}>
                    {/* Notes */}
                    <div
                      className="markdown-content text-sm text-gray-700 mb-4"
                      dangerouslySetInnerHTML={{
                        __html: marked(latestComment.note) as string,
                      }}
                    />

                    {/* Supervisor outcome only */}
                    {caseDetails?.status &&
                      (caseDetails.status === 'STATUS_81_CLOSED_REFUTED' ||
                        caseDetails.status === 'STATUS_82_CLOSED_CONFIRMED' ||
                        caseDetails.status ===
                          'STATUS_83_CLOSED_INCONCLUSIVE') && (
                        <div className="p-3 bg-green-50 border border-green-200 rounded">
                          <p className="text-xs text-green-600 font-medium mb-1">
                            Supervisor Final Outcome
                          </p>
                          <p className="text-sm font-semibold text-green-900">
                            {caseDetails?.status ?? 'N/A'}
                          </p>
                        </div>
                      )}
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Evidence Summary Section */}
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">
            Evidence Summary
          </h3>
          <div className="space-y-2">
            {evidenceCategories.length > 0 ? (
              evidenceCategories.map((category, index) => (
                <div
                  key={index}
                  className="border border-gray-200 rounded-lg overflow-hidden"
                >
                  {/* Category Header */}
                  <button
                    onClick={() => {
                      toggleCategory(category.type);
                    }}
                    className="w-full flex items-center justify-between gap-3 p-4 hover:bg-gray-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      {expandedCategories.has(category.type) ? (
                        <ChevronDownIcon className="h-5 w-5 text-gray-600 flex-shrink-0" />
                      ) : (
                        <ChevronRightIcon className="h-5 w-5 text-gray-600 flex-shrink-0" />
                      )}
                      <DocumentTextIcon className="h-5 w-5 text-blue-600 flex-shrink-0" />
                      <div className="flex-1">
                        <span className="text-sm font-medium text-gray-900">
                          {category.type}
                        </span>
                        <span className="text-sm text-gray-500 ml-1">
                          ({category.count} {category.description})
                        </span>
                      </div>
                    </div>
                  </button>

                  {/* Documents List */}
                  {expandedCategories.has(category.type) && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      {category.evidence.map((doc, docIndex) => (
                        <div
                          key={docIndex}
                          className="border-t border-gray-200 p-4 flex items-center justify-between hover:bg-gray-100 transition-colors first:border-t-0"
                        >
                          <div className="flex items-start gap-3 flex-1 min-w-0">
                            <DocumentTextIcon className="h-4 w-4 text-gray-400 mt-1 flex-shrink-0" />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {doc.fileName ?? 'Untitled Document'}
                              </p>
                              <div className="flex items-center gap-2 mt-1 text-xs text-gray-600">
                                <span>
                                  {evidenceService.formatFileSize(
                                    doc.fileSize ?? 0,
                                  )}
                                </span>
                                <span>•</span>
                                <span>{doc.evidenceType}</span>
                                {doc.uploadedAt && (
                                  <>
                                    <span>•</span>
                                    <span>{formatDate(doc.uploadedAt)}</span>
                                  </>
                                )}
                              </div>
                              {doc.description && (
                                <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                                  {doc.description}
                                </p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={async () => {
                              await handleDownloadEvidence(
                                doc.id,
                                doc.fileName ?? 'document',
                              );
                            }}
                            disabled={downloadingId === doc.id.toString()}
                            className="ml-4 px-3 py-2 text-xs font-medium text-blue-600 hover:bg-blue-50 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex-shrink-0"
                          >
                            {downloadingId === doc.id.toString()
                              ? 'Downloading...'
                              : 'Download'}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500 italic">
                No evidence uploaded yet for this case
              </p>
            )}
          </div>
        </div>

        {/* Case Metadata */}
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium text-gray-700">Case ID:</span>
              <span className="ml-2 text-gray-900">
                {caseDetails?.case_id ? `CASE-${caseDetails.case_id}` : 'N/A'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Priority:</span>
              <span className="ml-2 text-gray-900">
                {caseDetails?.priority ?? 'N/A'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Case Type:</span>
              <span className="ml-2 text-gray-900">
                {caseDetails?.case_type ?? 'N/A'}
              </span>
            </div>
            <div>
              <span className="font-medium text-gray-700">Created:</span>
              <span className="ml-2 text-gray-900">
                {caseDetails?.created_at
                  ? formatDate(caseDetails.created_at)
                  : 'N/A'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Complete Investigation Task Modal */}
      {showCompleteModal && investigationTask && (
        <Suspense fallback={<div>Loading...</div>}>
          <CompleteTaskModal
            open={showCompleteModal}
            onClose={() => {
              setShowCompleteModal(false);
            }}
            onCompleteTask={handleCompleteTask}
            task={mapToUnifiedWorkQueueTask(investigationTask, caseDetails)}
          />
        </Suspense>
      )}
    </>
  );
};

export default InvestigationSummaryTab;
