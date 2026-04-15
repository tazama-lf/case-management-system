/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Service handles dynamic API response data */
/* eslint-disable @typescript-eslint/class-methods-use-this -- Service methods are called on instances */
/* eslint-disable max-lines -- Service requires multiple report data methods */
import type {
  UploadReportDto,
  UploadReportResponse,
} from '@/features/cases/services/types/report.types';
import apiClient from '../../../shared/services/apiClient';
import type {
  ReportsData,
  InvestigatorWorkloadData,
  TaskCompletionData,
  AuditLogsData,
  CaseAgeingData,
  EvidenceFindingsData,
} from '../types/reports.types';

class ReportsService {
  async getReportsData(
    dateRange?: string,
    filters?: { caseType: string; priority: string; investigator: string },
  ): Promise<ReportsData> {
    try {
      const params = new URLSearchParams();
      if (dateRange) params.append('dateRange', dateRange);
      if (filters?.caseType) params.append('caseType', filters.caseType);
      if (filters?.priority) params.append('priority', filters.priority);
      if (filters?.investigator) {
        params.append('investigator', filters.investigator);
      }

      const response = await apiClient.get<ReportsData>(
        `/api/v1/reports/case-status?${params.toString()}`,
      );

      const processedResponse: ReportsData = {
        ...response,
        stats: {
          totalCases: ReportsService.safeFallback(response.stats.totalCases, 0),
          closedCases: ReportsService.safeFallback(response.stats.closedCases, 0),
          openCases: ReportsService.safeFallback(response.stats.openCases, 0),
          avgResolutionTime: ReportsService.safeFallback(
            response.stats.avgResolutionTime,
            0,
          ),
        },
        statusDistribution: response.statusDistribution,
        caseTypes: response.caseTypes,
        outcomes: response.outcomes,
        monthlyTrend: response.monthlyTrend,
        statusDetails: response.statusDetails,
      };

      return processedResponse;
    } catch (error) {
      console.error('Failed to fetch reports data:', error);

      return {
        stats: {
          totalCases: 0,
          closedCases: 0,
          openCases: 0,
          avgResolutionTime: 0,
        },
        statusDistribution: {
          assigned: 0,
          inProgress: 0,
          draft: 0,
          suspended: 0,
          pendingApproval: 0,
          closed: 0,
        },
        caseTypes: [],
        outcomes: {
          resolved: 0,
          confirmed: 0,
          inconclusive: 0,
          pending: 0,
        },
        monthlyTrend: [],
        statusDetails: [],
      };
    }
  }

  async getInvestigatorWorkloadData(
    dateRange?: string,
  ): Promise<InvestigatorWorkloadData> {
    try {
      const response = await apiClient.get<InvestigatorWorkloadData>(
        `/api/v1/reports/investigator-workload?dateRange=${dateRange ?? 'last30'}`,
      );

      const processedResponse: InvestigatorWorkloadData = {
        ...response,
        stats: {
          totalInvestigators: ReportsService.safeFallback(
            response.stats.totalInvestigators,
            0,
          ),
          avgCasesPerInvestigator: ReportsService.safeFallback(
            response.stats.avgCasesPerInvestigator,
            0,
          ),
          avgResolutionTime: ReportsService.safeFallback(
            response.stats.avgResolutionTime,
            0,
          ),
          caseClosureRate: ReportsService.safeFallback(
            response.stats.caseClosureRate,
            0,
          ),
        },
        workloadData: response.workloadData,
        volumeTrend: response.volumeTrend,
        efficiencyData: response.efficiencyData,
        outcomeData: response.outcomeData,
        performanceData: response.performanceData,
      };

      return processedResponse;
    } catch (error) {
      console.error('Failed to fetch investigator workload data:', error);

      return {
        stats: {
          totalInvestigators: 0,
          avgCasesPerInvestigator: 0,
          avgResolutionTime: 0,
          caseClosureRate: 0,
        },
        workloadData: [],
        volumeTrend: [],
        efficiencyData: [],
        outcomeData: [],
        performanceData: [],
      };
    }
  }

  async getTaskCompletionData(dateRange?: string): Promise<TaskCompletionData> {
    try {
      const response = await apiClient.get<TaskCompletionData>(
        `/api/v1/reports/task-completion?dateRange=${dateRange ?? 'last30'}`,
      );

      const processedResponse: TaskCompletionData = {
        ...response,
        stats: {
          totalTasks: ReportsService.safeFallback(response.stats.totalTasks, 0),
          completionRate: ReportsService.safeFallback(response.stats.completionRate, 0),
          avgCompletionTime: ReportsService.safeFallback(
            response.stats.avgCompletionTime,
            0,
          ),
          overdueTasks: ReportsService.safeFallback(response.stats.overdueTasks, 0),
        },
        completionByType: response.completionByType,
        avgCompletionTime: response.avgCompletionTime,
        completionTrend: response.completionTrend,
        statusDistribution: response.statusDistribution,
        taskDetails: response.taskDetails,
      };

      return processedResponse;
    } catch (error) {
      console.error('Failed to fetch task completion data:', error);

      return {
        stats: {
          totalTasks: 0,
          completionRate: 0,
          avgCompletionTime: 0,
          overdueTasks: 0,
        },
        completionByType: [],
        avgCompletionTime: [],
        completionTrend: [],
        statusDistribution: [],
        taskDetails: [],
      };
    }
  }

  async generateFraudReport(
    data: UploadReportDto,
  ): Promise<UploadReportResponse> {
    try {
      const formData = new FormData();
      formData.append('file', data.file);
      formData.append('caseId', data.caseId.toString());
      formData.append('reportType', data.reportType);
      formData.append('investigatorInputs', data.investigatorInputs ?? '');
      formData.append('supervisorRemarks', data.supervisorRemarks ?? '');
      formData.append('outcome', data.outcome ?? '');
      formData.append('description', data.description ?? '');

      const response = await apiClient.upload<UploadReportResponse>(
        '/api/v1/reports/fraud/generate',
        formData,
      );

      return response;
    } catch (error) {
      throw ReportsService.handleError(error, 'upload evidence');
    }
  }

  async getAuditLogsData(dateRange?: string): Promise<AuditLogsData> {
    try {
      const response = await apiClient.get<AuditLogsData>(
        `/api/v1/reports/audit-logs?dateRange=${dateRange ?? 'last30'}`,
      );

      const processedResponse: AuditLogsData = {
        ...response,
        stats: {
          totalLogs: ReportsService.safeFallback(response.stats.totalLogs, 0),
          caseActions: ReportsService.safeFallback(response.stats.caseActions, 0),
          userSessions: ReportsService.safeFallback(response.stats.userSessions, 0),
          systemWarnings: ReportsService.safeFallback(response.stats.systemWarnings, 0),
        },
        auditLogs: response.auditLogs,
      };

      return processedResponse;
    } catch (error) {
      console.error('Failed to fetch audit logs data:', error);
      return {
        stats: {
          totalLogs: 0,
          caseActions: 0,
          userSessions: 0,
          systemWarnings: 0,
        },
        auditLogs: [],
      };
    }
  }

  async getCaseAgeingData(dateRange?: string): Promise<CaseAgeingData> {
    try {
      const response = await apiClient.get<CaseAgeingData>(
        `/api/v1/reports/case-ageing?dateRange=${dateRange ?? 'last30'}`,
      );

      const processedResponse: CaseAgeingData = {
        ...response,
        stats: {
          avgCaseAge: ReportsService.safeFallback(response.stats.avgCaseAge, 0),
          avgResolutionTime: ReportsService.safeFallback(
            response.stats.avgResolutionTime,
            0,
          ),
          casesOver15Days: ReportsService.safeFallback(
            response.stats.casesOver15Days,
            0,
          ),
          casesOver30Days: ReportsService.safeFallback(
            response.stats.casesOver30Days,
            0,
          ),
        },
        ageingByStatus: response.ageingByStatus,
        resolutionTrend: response.resolutionTrend,
        ageingDistribution: response.ageingDistribution,
        caseTypeResolution: response.caseTypeResolution,
        caseDetails: response.caseDetails,
      };

      return processedResponse;
    } catch (error) {
      console.error('Failed to fetch case ageing data:', error);

      return {
        stats: {
          avgCaseAge: 0,
          avgResolutionTime: 0,
          casesOver15Days: 0,
          casesOver30Days: 0,
        },
        ageingByStatus: [],
        resolutionTrend: [],
        ageingDistribution: [],
        caseTypeResolution: [],
        caseDetails: [],
      };
    }
  }

  async getEvidenceFindingsData(
    _dateRange?: string,
  ): Promise<EvidenceFindingsData> {
    try {
      // Fetch all cases first - use correct endpoint
      const casesResponse = await apiClient.get<
        Record<string, unknown> | Array<Record<string, unknown>>
      >('/api/v1/cases/all');

      const cases = Array.isArray(casesResponse)
        ? casesResponse
        : ((casesResponse.data ?? casesResponse.cases ?? []) as Array<Record<string, unknown>>);

      if (cases.length === 0) {
        console.warn(
          '[Evidence Report] No cases found, returning empty findings',
        );
        return {
          stats: {
            totalFindings: 0,
            evidenceItems: 0,
            confirmedFindings: 0,
            refutedFindings: 0,
            inconclusiveFindings: 0,
            inProgressFindings: 0,
          },
          statusDistribution: {
            confirmed: 0,
            refuted: 0,
            inProgress: 0,
            inconclusive: 0,
          },
          evidenceItems: [],
          findings: [],
        };
      }

      // Aggregate evidence from all cases
      const allFindings: EvidenceFindingsData['findings'] = [];
      let totalEvidenceItems = 0;
      let confirmedCount = 0;
      let refutedCount = 0;
      let inconclusiveCount = 0;
      const inprogressCount = 0;

      // For each case, fetch all evidence by case ID (the backend should handle finding evidence with any taskId)
      for (const caseItem of cases) {
        if (
          caseItem.status === 'STATUS_00_DRAFT' ||
          caseItem.status === 'STATUS_99_ABANDONED' ||
          caseItem.status === 'STATUS_01_PENDING_CASE_CREATION_APPROVAL'
        ) {
          continue;
        }
        let caseEvidence: Array<Record<string, unknown>> = [];

        try {
          // Query evidence for this case
          // eslint-disable-next-line no-await-in-loop -- Sequential API calls to avoid overloading the server
          const caseEvidenceResponse = await apiClient.get<
            Record<string, unknown>
          >(`/api/v1/evidence/case/${String(caseItem.case_id)}`);

          if ('evidence' in caseEvidenceResponse) {
            const { evidence } = caseEvidenceResponse;
            if (Array.isArray(evidence)) {
              caseEvidence = evidence;
            }
          } else if (Array.isArray(caseEvidenceResponse)) {
            caseEvidence = caseEvidenceResponse;
          }
        } catch (caseErr) {
          console.warn(
            `[Evidence Report] Failed to fetch evidence for case ${String(caseItem.case_id)}:`,
            caseErr,
          );
        }

        caseEvidence = caseEvidence.filter(
          (e: Record<string, unknown>) => !e.reportId,
        );

        if (caseEvidence.length > 0) {
          totalEvidenceItems += caseEvidence.length;

          // Map evidence to include full object with all available fields
          caseEvidence.map(
            (e: Record<string, unknown>) => {
              const evidenceId =
                (e.id as string) ||
                (e.evidenceId as string) ||
                (e.evidence_id as string) ||
                `unknown_${Date.now()}`;

              // Extract fileName from attachments array if it exists there
              const attachments = e.attachments as
                | Array<Record<string, unknown>>
                | undefined;
              const firstAttachment = attachments?.[0];

              const fileName =
                (e.fileName as string) ||
                (e.file_name as string) ||
                (firstAttachment?.fileName as string) ||
                'Unknown Document';

              const fileSize =
                (e.fileSize as number) ||
                (firstAttachment?.fileSize as number) ||
                undefined;

              const mimeType =
                (e.mimeType as string) ||
                (firstAttachment?.mimeType as string) ||
                undefined;

              const hash =
                (e.hash as string) ||
                (firstAttachment?.hash as string) ||
                undefined;

              return {
                id: evidenceId,
                fileName,
                fileSize,
                mimeType,
                evidenceType: (e.evidenceType as string) || undefined,
                uploadedBy: (e.uploadedBy as string) || undefined,
                uploadedByName: (e.uploadedByName as string) || undefined,
                uploadedAt: (e.uploadedAt as string) || undefined,
                description: (e.description as string) || undefined,
                hash,
              };
            },
          );

          const evidenceByTask: Record<string, Array<Record<string, unknown>>> = {};
          caseEvidence.forEach((e) => {
            const rawTaskId = e.taskId ?? e.task_id;
            const taskId = typeof rawTaskId === 'string' || typeof rawTaskId === 'number' ? String(rawTaskId) : 'unknown_task';
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Dynamic key access may return undefined at runtime
            evidenceByTask[taskId] ||= [];
            evidenceByTask[taskId].push(e);
          });

          const tasks = Object.entries(evidenceByTask).map(
            ([taskId, evidences]) => ({
              taskId: taskId === 'unknown_task' ? undefined : Number(taskId),
              supportingEvidence: evidences.map((e) => {
                const attachments = e.attachments as Array<Record<string, unknown>> | undefined;
                const firstAttachment = attachments?.[0];

                return {
                  id:
                    ((e.id as string | undefined) ?? '') ||
                    ((e.evidenceId as string | undefined) ?? '') ||
                    `unknown_${String(Date.now())}`,
                  fileName: (e.fileName ?? e.file_name ?? firstAttachment?.fileName ?? 'Unknown Document') as string,
                  fileSize: (e.fileSize ?? firstAttachment?.fileSize) as number | undefined,
                  mimeType: (e.mimeType ?? firstAttachment?.mimeType) as string | undefined,
                  evidenceType: e.evidenceType as string | undefined,
                  uploadedBy: e.uploadedBy as string | undefined,
                  uploadedByName: e.uploadedByName as string | undefined,
                  uploadedAt: e.uploadedAt as string | undefined,
                  description: e.description as string | undefined,
                  hash: (e.hash ?? firstAttachment?.hash) as string | undefined,
                };
              }),
            }),
          );

          let conclusion:
            | 'Confirmed'
            | 'Refuted'
            | 'Inconclusive'
            | 'InProgress';
          const status = caseItem.status as string;

          if (
            status === 'STATUS_82_CLOSED_CONFIRMED' ||
            status === 'STATUS_71_AUTOCLOSED_CONFIRMED'
          ) {
            conclusion = 'Confirmed';
            confirmedCount += 1;
          } else if (
            status === 'STATUS_81_CLOSED_REFUTED' ||
            status === 'STATUS_72_AUTOCLOSED_REFUTED'
          ) {
            conclusion = 'Refuted';
            refutedCount += 1;
          } else if (status === 'STATUS_83_CLOSED_INCONCLUSIVE') {
            conclusion = 'Inconclusive';
            inconclusiveCount += 1;
          } else {
            conclusion = 'InProgress';
          }

          // Push ONE finding per case
          allFindings.push({
            caseId: Number(caseItem.case_id),
            finding: `Evidence collected for case ${String(caseItem.case_id)}`,
            conclusion,
            evidenceCount: caseEvidence.length,
            tasks,
            dateIdentified:
              (caseItem.created_at as string) || new Date().toISOString(),
          });
        }
      }

      const processedResponse: EvidenceFindingsData = {
        stats: {
          totalFindings: allFindings.length,
          evidenceItems: totalEvidenceItems,
          confirmedFindings: confirmedCount,
          refutedFindings: refutedCount,
          inconclusiveFindings: inconclusiveCount,
          inProgressFindings: inprogressCount,
        },
        statusDistribution: {
          confirmed: confirmedCount,
          refuted: refutedCount,
          inconclusive: inconclusiveCount,
          inProgress: inprogressCount,
        },
        evidenceItems: [],
        findings: allFindings.length > 0 ? allFindings : [],
      };

      return processedResponse;
    } catch (error) {
      console.error(
        '[Evidence Report] Error in getEvidenceFindingsData:',
        error,
      );
      return {
        stats: {
          totalFindings: 0,
          evidenceItems: 0,
          confirmedFindings: 0,
          refutedFindings: 0,
          inconclusiveFindings: 0,
          inProgressFindings: 0,
        },
        statusDistribution: {
          confirmed: 0,
          refuted: 0,
          inconclusive: 0,
          inProgress: 0,
        },
        evidenceItems: [],
        findings: [],
      };
    }
  }

  private static safeFallback(
    value: number | null | undefined,
    fallback: number,
  ): number {
    if (
      value === null ||
      value === undefined ||
      isNaN(value) ||
      !isFinite(value)
    ) {
      return fallback;
    }
    return value;
  }

  public formatDisplayValue(
    value: number | null | undefined,
    unit?: string,
  ): string {
    const safeValue = ReportsService.safeFallback(value, 0);
    if (unit) {
      return `${safeValue}${unit}`;
    }
    return safeValue.toString();
  }

  private static handleError(error: unknown, operation: string): Error {
    console.error(`EvidenceService Error - ${operation}:`, error);

    if (error instanceof Error) {
      return error;
    }

    const err = error as {
      response?: { data?: { message?: string } };
      message?: string;
    };
    if (err.response?.data) {
      return new Error(err.response.data.message ?? `Failed to ${operation}`);
    }

    if (err.message) {
      return new Error(err.message);
    }

    return new Error(`Failed to ${operation}`);
  }
}

// Export both named and default export for better IDE support
export const reportsService = new ReportsService();
export default reportsService;
/* eslint-enable max-lines */
/* eslint-enable @typescript-eslint/class-methods-use-this */
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
