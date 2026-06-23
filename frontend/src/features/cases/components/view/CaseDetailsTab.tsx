import React, { useState, useEffect } from 'react';
import type { CaseRow } from '../casesTable.utils';
import CaseActionsPanel from './CaseActionsPanel';
import { getCaseStatusBadge } from '@/shared/constants/case.constant';
import type { TransactionDetailDTO } from '../../../alerts/types/triage.types';
import triageService from '../../../alerts/services/triageservice';
import {
  ArrowTopRightOnSquareIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import { evidenceService } from '../../services/evidenceService';
import { taskService } from '../../services/taskService';
import useInvestigatorSupervisorList from '../../hooks/useInvestigatorSupervisorList';
import AlertsDetailModal from '@/features/alerts/components/AlertsDetailModal';

interface CaseDetailsTabProps {
  row: CaseRow;
  subCasesDetails: CaseRow[] | undefined;
  parentCaseDetails: CaseRow | null;
  canManageSupervisorActions?: boolean;
  showActions?: boolean;
  onComplete?: (row: CaseRow) => void;
  onCloseCase?: (row: CaseRow) => void;
  onReopenCase?: (row: CaseRow) => void;
  onAbandonCase?: (row: CaseRow) => void;
  onSuspendCase?: (row: CaseRow) => void;
  onResumeCase?: (row: CaseRow) => void;
  onApproveCase?: (row: CaseRow) => void;
  onApproveCaseReopen?: (row: CaseRow) => void;
  onRejectCaseReopen?: (row: CaseRow) => void;
  onApproveCaseCreation?: (row: CaseRow) => void;
  onRejectCaseCreation?: (row: CaseRow) => void;
}

const SectionCard: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
    {title ? (
      <div className="mb-2 text-sm font-semibold text-gray-700">{title}</div>
    ) : null}
    <div className="text-sm text-gray-900">{children}</div>
  </div>
);

const getPriorityColor = (priority: string): string => {
  const priorityColors: Record<string, string> = {
    NEW: 'bg-blue-50 text-blue-700 ring-blue-200',
    URGENT: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    CRITICAL: 'bg-orange-50 text-orange-700 ring-orange-200',
    BREACH: 'bg-red-50 text-red-700 ring-red-200',
  };
  return priorityColors[priority] ?? 'bg-gray-50 text-gray-700 ring-gray-200';
};

const getScoreColor = (score: number): string => {
  if (score >= 80) return 'text-red-600 bg-red-50';
  if (score >= 60) return 'text-orange-600 bg-orange-50';
  if (score >= 40) return 'text-yellow-600 bg-yellow-50';
  if (score > 0) return 'text-green-600 bg-green-50';
  return 'text-gray-600 bg-gray-50';
};

interface LatestReport {
  reportType: string;
  reportId: string;
}

const shouldShowInvestigationAssignee = (caseType?: string): boolean =>
  caseType === 'FRAUD' || caseType === 'AML';

const CaseDetailsTab: React.FC<CaseDetailsTabProps> = ({
  row,
  subCasesDetails,
  parentCaseDetails,
  canManageSupervisorActions = false,
  showActions = true,
  onComplete,
  onCloseCase,
  onReopenCase,
  onAbandonCase,
  onSuspendCase,
  onResumeCase,
  onApproveCase,
  onApproveCaseReopen,
  onRejectCaseReopen,
  onApproveCaseCreation,
  onRejectCaseCreation,
}) => {
  const [pacs002Data, setPacs002Data] = React.useState<TransactionDetailDTO[]>(
    [],
  );
  const [pacs008Data, setPacs008Data] = React.useState<TransactionDetailDTO[]>(
    [],
  );
  const [openPacs002, setOpenPacs002] = React.useState(false);
  const [openPacs008, setOpenPacs008] = React.useState(false);
  const [isAlertModalOpen, setIsAlertModalOpen] = React.useState(false);
  const [, setViewingId] = useState<string | null>(null);
  const [latestReports, setLatestReports] = useState<
    Record<string, LatestReport | null>
  >({});
  const [loading, setLoading] = useState(false);
  const [investigationAssignees, setInvestigationAssignees] = useState<
    Record<number, string | null>
  >({});
  const { getAssigneeFullName } = useInvestigatorSupervisorList();

  useEffect(() => {
    setLatestReports({});
    setViewingId(null);
  }, [row.id]);

  // Extract transaction data
  const getTransactionData = (): Record<string, unknown> | null => {
    if (!row.transaction) return null;

    try {
      const txData = row.transaction as Record<string, unknown>;
      const fiToFIPmtSts = txData?.FIToFIPmtSts as Record<string, unknown>;
      return fiToFIPmtSts?.TxInfAndSts as Record<string, unknown> | null;
    } catch {
      return null;
    }
  };

  getTransactionData();

  const escapeHtml = (unsafe: string): string =>
    unsafe
      .replace(/&/gu, '&amp;')
      .replace(/</gu, '&lt;')
      .replace(/>/gu, '&gt;')
      .replace(/"/gu, '&quot;')
      .replace(/'/gu, '&#039;');

  const syntaxHighlightJson = (obj: unknown): string => {
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

  const stripHudiMetadata = (
    record: TransactionDetailDTO,
  ): TransactionDetailDTO => {
    const hudiFields = [
      '_hoodie_commit_time',
      '_hoodie_commit_seqno',
      '_hoodie_record_key',
      '_hoodie_partition_path',
      '_hoodie_file_name',
    ];
    return Object.fromEntries(
      Object.entries(record).filter(([key]) => !hudiFields.includes(key)),
    ) as TransactionDetailDTO;
  };

  React.useEffect(() => {
    const fetchTransactionData = async (): Promise<void> => {
      if (!row?.alertId) return;

      try {
        const response = await triageService.getAlertTransactionalData(
          row.alertId,
        );

        // Separate pacs.002 and pacs.008 records from the transaction data
        const pacs002Records = response
          .filter((record: TransactionDetailDTO) =>
            record.tx_type.includes('pacs.002'),
          )
          .map(stripHudiMetadata);
        const pacs008Records = response
          .filter((record: TransactionDetailDTO) =>
            record.tx_type.includes('pacs.008'),
          )
          .map(stripHudiMetadata);

        setPacs002Data(pacs002Records);
        setPacs008Data(pacs008Records);
      } catch (error) {
        console.error(
          `Unable to retrieve Transaction Data for alert ID ${row.alertId}`,
          error,
        );
      }
    };

    fetchTransactionData();
  }, [row?.alertId]);

  const loadReport = React.useCallback(async () => {
    setLatestReports({});
    setViewingId(null);
    if (!row.id) return;

    const isClosed = row.status.toLowerCase().includes('closed');
    if (!isClosed) {
      setLatestReports({});
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const evidenceResponse = await evidenceService.getCaseEvidence(row.id);
      const latestByType: Record<string, LatestReport | null> = {};

      evidenceResponse.evidence.forEach((evidence) => {
        const reportType = evidence.evidenceType ?? 'INVESTIGATION_REPORT';
        const { reportId } = evidence;

        const submittedAt = evidence.attachments?.[0]?.submittedAt
          ? new Date(evidence.attachments[0].submittedAt).getTime()
          : 0;

        const existing = latestByType[reportType];

        if (!existing) {
          latestByType[reportType] = {
            reportType,
            reportId: reportId ?? '',
          };
          return;
        }

        const existingEvidence = evidenceResponse.evidence.find(
          (e) => e.reportId === existing.reportId,
        );

        const existingDate = existingEvidence?.attachments?.[0]?.submittedAt
          ? new Date(existingEvidence.attachments[0].submittedAt).getTime()
          : 0;

        if (submittedAt > existingDate) {
          latestByType[reportType] = {
            reportType,
            reportId: reportId ?? '',
          };
        }
      });

      setLatestReports(latestByType);
    } catch (err) {
      console.error('Failed to load reports:', err);
    } finally {
      setLoading(false);
    }
  }, [row.id]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  useEffect(() => {
    const caseRowsToFetch = [row, ...(subCasesDetails ?? [])].filter((caseRow) =>
      shouldShowInvestigationAssignee(caseRow.type),
    );
    const caseIdsToFetch = Array.from(
      new Set(caseRowsToFetch.map((caseRow) => caseRow.id)),
    );

    setInvestigationAssignees((previous) => {
      const next: Record<number, string | null> = {};
      caseIdsToFetch.forEach((caseId) => {
        if (Object.hasOwn(previous, caseId)) {
          next[caseId] = previous[caseId];
        }
      });
      return next;
    });

    if (caseIdsToFetch.length === 0) {
      return;
    }

    let isMounted = true;

    const fetchInvestigationAssignees = async (): Promise<void> => {
      const results = await Promise.all(
        caseIdsToFetch.map(async (caseId) => {
          try {
            const investigationTask =
              await taskService.getInvestigationTaskForCase(caseId);

            return {
              caseId,
              assigneeId: investigationTask?.assigned_user_id ?? null,
            };
          } catch (error) {
            console.error(
              `Failed to load investigation assignee for case ${caseId}:`,
              error,
            );
            return { caseId, assigneeId: null };
          }
        }),
      );

      if (!isMounted) {
        return;
      }

      setInvestigationAssignees((previous) => {
        const next = { ...previous };
        results.forEach(({ caseId, assigneeId }) => {
          next[caseId] = assigneeId;
        });
        return next;
      });
    };

    void fetchInvestigationAssignees();

    return () => {
      isMounted = false;
    };
  }, [row, subCasesDetails]);

  const renderInvestigationAssignee = (caseId: number): React.ReactNode => {
    const assigneeId = investigationAssignees[caseId];
    const assigneeName = assigneeId ? getAssigneeFullName(assigneeId) : null;

    return (
      <div>
        <div className="text-xs text-gray-500 uppercase">Assignee</div>
        <div className="font-medium text-gray-900">
          {assigneeName ?? 'Unassigned'}
        </div>
      </div>
    );
  };

  const handleViewReport = async (reportId?: string): Promise<void> => {
    if (!reportId) {
      return;
    }
    const actualReportId = reportId;
    setViewingId(actualReportId);

    try {
      // Fetch the encrypted blob from CouchDB
      const blob = await evidenceService.viewEvidence(actualReportId);

      if (blob.size === 0) {
        throw new Error('Received empty file');
      }

      // Determine the best way to preview based on MIME type
      const mimeType = blob.type ?? 'application/octet-stream';
      const isPreviewable = [
        'application/pdf',
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml',
        'text/plain',
        'text/html',
        'text/csv',
      ].some((type) => mimeType.includes(type));

      // Create blob URL
      const blobUrl = URL.createObjectURL(blob);

      if (isPreviewable) {
        // Open in new tab for previewable files
        window.open(blobUrl, '_blank', 'noopener,noreferrer');
      } else {
        // For non-previewable files, inform user and offer download
        const shouldDownload = confirm(
          `This file type (${mimeType}) cannot be previewed in the browser.\n\nWould you like to download it instead?`,
        );

        if (shouldDownload) {
          // Trigger download
          const link = document.createElement('a');
          link.href = blobUrl;
          link.download = reportId;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
        }

        // Clean up immediately if not downloading
        if (!shouldDownload) {
          URL.revokeObjectURL(blobUrl);
        }
      }

      // Clean up blob URL after a delay (for previewable files)
      if (isPreviewable) {
        setTimeout(() => {
          URL.revokeObjectURL(blobUrl);
        }, 30000); // 30 seconds should be enough for the browser to load it
      }
    } catch (err) {
      console.error('[Report View] Error:', err);
      const errorMessage =
        err instanceof Error ? err.message : 'Unknown error occurred';
      alert(`Failed to view Report: ${errorMessage}`);
    } finally {
      setViewingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="flex items-center gap-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="text-sm text-gray-600">Loading case details…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        {/* Case Information */}
        <div className="space-y-3">
          {/* <div className="text-sm font-semibold text-gray-700">Case Information</div> */}
          <div className="flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-700">
              Case Information
            </div>

            <div className="flex items-center gap-2 ml-6">
              {row.status.toLowerCase().includes('closed') &&
                latestReports.INVESTIGATION_REPORT?.reportId && (
                  <button
                    onClick={async () => {
                      await handleViewReport(
                        latestReports.INVESTIGATION_REPORT!.reportId,
                      );
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2
                     bg-gradient-to-r from-blue-600 to-blue-700
                     text-white text-sm font-medium rounded-md
                     hover:from-blue-700 hover:to-blue-800
                     shadow-sm transition-all"
                  >
                    <DocumentTextIcon className="h-5 w-5" />
                    View Investigation Report
                  </button>
                )}
            </div>
          </div>
          <SectionCard>
            <div className="grid grid-cols-2 gap-x-6 gap-y-3">
              <div>
                <div className="text-xs text-gray-500 uppercase">Case ID</div>
                <div className="font-medium text-gray-900">{row.id}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Case Type</div>
                <span
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${row.typeColor}`}
                >
                  {row.type || 'N/A'}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Status</div>
                <span
                  className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-gray-200 ${row.statusColor}`}
                >
                  {getCaseStatusBadge(row.status)}
                </span>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">Priority</div>
                <div className="inline-flex items-center gap-2">
                  <span
                    className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${getPriorityColor(row.priority)}`}
                  >
                    {row.priority}
                  </span>
                </div>
              </div>
              <div>
                <div className="text-xs text-gray-500 uppercase">
                  Created On
                </div>
                <div className="font-medium text-gray-900">{row.createdOn}</div>
              </div>
              {shouldShowInvestigationAssignee(row.type) &&
                renderInvestigationAssignee(row.id)}
            </div>
          </SectionCard>
        </div>

        {/* Parent Case Information */}
        {row?.parentId && parentCaseDetails && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700">
              Parent Case Information
            </div>
            <SectionCard>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <div className="text-xs text-gray-500 uppercase">
                    Parent ID
                  </div>
                  <div className="font-medium text-gray-900">
                    {parentCaseDetails.id}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">Status</div>
                  <span
                    className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-gray-200 ${parentCaseDetails.statusColor}`}
                  >
                    {getCaseStatusBadge(parentCaseDetails.status)}
                  </span>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* Sub Cases Information */}
        {row?.type === 'FRAUD_AND_AML' && subCasesDetails && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700">
              Sub Case Information
            </div>
            <SectionCard>
              {subCasesDetails.map((subCases) => (
                <div key={subCases.id} className="mb-4">
                  <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                    <div>
                      <div className="text-xs text-gray-500 uppercase">
                        SubCase ID
                      </div>
                      <div className="font-medium text-gray-900">
                        {subCases.id}
                      </div>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 uppercase">
                        SubCase Type
                      </div>
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${subCases.typeColor}`}
                      >
                        {subCases.type || 'N/A'}
                      </span>
                    </div>

                    <div>
                      <div className="text-xs text-gray-500 uppercase">
                        Status
                      </div>
                      <span
                        className={`inline-flex w-fit items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-gray-200 ${subCases.statusColor}`}
                      >
                        {getCaseStatusBadge(subCases.status)}
                      </span>
                    </div>

                    {shouldShowInvestigationAssignee(subCases.type) &&
                      renderInvestigationAssignee(subCases.id)}
                  </div>
                </div>
              ))}
            </SectionCard>
          </div>
        )}

        {/* Alert Information */}
        {row.alertId && (
          <div className="space-y-3">
            <div className="text-sm font-semibold text-gray-700">
              Alert Information
            </div>
            <SectionCard>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <div>
                  <div className="text-xs text-gray-500 uppercase">
                    Alert ID
                  </div>
                  <button
                    type="button"
                    onClick={() => { setIsAlertModalOpen(true); }}
                    className="inline-flex items-center gap-1 font-medium text-gray-900 hover:text-blue-800 hover:underline focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 rounded"
                    title="View alert details"
                  >
                    <span>{row.alertId}</span>
                    <ArrowTopRightOnSquareIcon className="h-4 w-4" />
                  </button>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase">
                    Confidence Score
                  </div>
                  <div
                    className={`inline-flex px-2 py-1 text-sm font-bold rounded-full ${getScoreColor(row.confidencePercent ?? 0)}`}
                  >
                    {row.confidencePercent ?? 0}%
                  </div>
                </div>
                <div className="col-span-2">
                  <div className="text-xs text-gray-500 uppercase">Message</div>
                  <div className="font-medium text-gray-900 mt-1">
                    {row.alertMessage ?? 'N/A'}
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>
        )}
      </div>

      <AlertsDetailModal
        alertId={row.alertId ?? null}
        isOpen={isAlertModalOpen}
        onClose={() => { setIsAlertModalOpen(false); }}
      />

      {/* PACS.002 Data */}
      {pacs002Data.length > 0 && (
        <div className="space-y-3">
          <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => {
                setOpenPacs002(!openPacs002);
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
            >
              <div>
                <h4 className="text-sm font-medium text-gray-900">
                  pacs.002.001.12
                </h4>
              </div>
              {openPacs002 ? (
                <ChevronUpIcon className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
              )}
            </button>
            {openPacs002 && (
              <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                {pacs002Data.map((record, index) => (
                  <div key={record.pk || index} className="mb-4 last:mb-0">
                    <pre
                      className="whitespace-pre-wrap break-words max-h-64 overflow-auto text-sm"
                      dangerouslySetInnerHTML={{
                        __html: syntaxHighlightJson(record),
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* PACS.008 Data */}
      {pacs008Data.length > 0 && (
        <div className="space-y-3">
          <section className="rounded-lg border border-gray-200 bg-white shadow-sm">
            <button
              type="button"
              onClick={() => {
                setOpenPacs008(!openPacs008);
              }}
              className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-gray-50"
            >
              <div>
                <h4 className="text-sm font-medium text-gray-900">
                  {pacs008Data[0].tx_type}
                </h4>
              </div>
              {openPacs008 ? (
                <ChevronUpIcon className="h-4 w-4 text-gray-500" />
              ) : (
                <ChevronDownIcon className="h-4 w-4 text-gray-500" />
              )}
            </button>
            {openPacs008 && (
              <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                {pacs008Data.map((record, index) => (
                  <div key={record.pk || index} className="mb-4 last:mb-0">
                    <pre
                      className="whitespace-pre-wrap break-words max-h-64 overflow-auto text-sm"
                      dangerouslySetInnerHTML={{
                        __html: syntaxHighlightJson(record),
                      }}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      {/* Actions Panel */}
      {showActions && (
        <div className="col-span-full">
          <CaseActionsPanel
            caseData={row}
            subCasesDetails={subCasesDetails}
            parentCaseDetails={parentCaseDetails}
            canManageSupervisorActions={canManageSupervisorActions}
            onComplete={onComplete}
            onCloseCase={onCloseCase}
            onReopenCase={onReopenCase}
            onAbandonCase={onAbandonCase}
            onSuspendCase={onSuspendCase}
            onResumeCase={onResumeCase}
            onApproveCase={onApproveCase}
            onApproveCaseReopen={onApproveCaseReopen}
            onRejectCaseReopen={onRejectCaseReopen}
            onApproveCaseCreation={onApproveCaseCreation}
            onRejectCaseCreation={onRejectCaseCreation}
          />
        </div>
      )}
    </div>
  );
};
export default CaseDetailsTab;
