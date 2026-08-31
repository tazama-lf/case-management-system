/* eslint-disable @typescript-eslint/no-unsafe-assignment -- Service handles dynamic API response data */
/* eslint-disable @typescript-eslint/class-methods-use-this -- Service methods are called on instances */

import type {
  UploadReportDto,
  UploadReportResponse,
} from '@/features/cases/services/types/report.types';
import apiClient from '../../../shared/services/apiClient';
import getClientDateRange from '../helpers/getClientDateRange';
import mapEvidenceToTasks from '../helpers/mapEvidenceToTasks';
import type {
  ReportsData,
  InvestigatorWorkloadData,
  TaskCompletionData,
  CaseAgeingData,
  EvidenceFindingsData,
} from '../types/reports.types';

const EMPTY_EVIDENCE_FINDINGS: EvidenceFindingsData = {
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

class ReportsService {
  async getReportsData(
    dateRange?: string,
    filters?: { caseType?: string; priority?: string; investigator?: string },
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
          closedCases: ReportsService.safeFallback(
            response.stats.closedCases,
            0,
          ),
          openAssignedCases: ReportsService.safeFallback(
            response.stats.openAssignedCases,
            0,
          ),
          openCases: ReportsService.safeFallback(response.stats.openCases, 0),
          avgResolutionTime: response.stats.avgResolutionTime ?? null,
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
          openAssignedCases: 0,
          avgResolutionTime: null,
        },
        statusDistribution: {
          draft: 0,
          pendingCaseCreationApproval: 0,
          readyForAssignment: 0,
          assigned: 0,
          inProgress: 0,
          suspended: 0,
          pendingFinalApproval: 0,
          pendingCaseReopeningApproval: 0,
          autoclosedConfirmed: 0,
          autoclosedRefuted: 0,
          closedRefuted: 0,
          closedConfirmed: 0,
          closedInconclusive: 0,
          abandoned: 0,
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
    filters?: { caseType?: string; priority?: string; investigator?: string },
  ): Promise<InvestigatorWorkloadData> {
    try {
      const params = new URLSearchParams();
      params.append('dateRange', dateRange ?? 'last30');
      if (filters?.caseType) params.append('caseType', filters.caseType);
      if (filters?.priority) params.append('priority', filters.priority);
      if (filters?.investigator) {
        params.append('investigator', filters.investigator);
      }

      const response = await apiClient.get<InvestigatorWorkloadData>(
        `/api/v1/reports/investigator-workload?${params.toString()}`,
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
          completionRate: ReportsService.safeFallback(
            response.stats.completionRate,
            0,
          ),
          avgCompletionTime: ReportsService.safeFallback(
            response.stats.avgCompletionTime,
            0,
          ),
          overdueTasks: ReportsService.safeFallback(
            response.stats.overdueTasks,
            0,
          ),
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

  async getCaseAgeingData(
    dateRange?: string,
    filters?: { caseType?: string; priority?: string; investigator?: string },
  ): Promise<CaseAgeingData> {
    try {
      const params = new URLSearchParams();
      params.append('dateRange', dateRange ?? 'last30');
      if (filters?.caseType) params.append('caseType', filters.caseType);
      if (filters?.priority) params.append('priority', filters.priority);
      if (filters?.investigator) {
        params.append('investigator', filters.investigator);
      }

      const response = await apiClient.get<CaseAgeingData>(
        `/api/v1/reports/case-ageing?${params.toString()}`,
      );

      const processedResponse: CaseAgeingData = {
        ...response,
        stats: {
          // null is a real state here (empty open-case population / no cases
          // closed in the window), not a fallback-to-0 case - see
          // CaseAgeingStats jsdoc.
          avgCaseAge: response.stats.avgCaseAge ?? null,
          avgResolutionTime: response.stats.avgResolutionTime ?? null,
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
        resolutionByOutcome: response.resolutionByOutcome,
        caseDetails: response.caseDetails,
      };

      return processedResponse;
    } catch (error) {
      console.error('Failed to fetch case ageing data:', error);

      return {
        stats: {
          avgCaseAge: null,
          avgResolutionTime: null,
          casesOver15Days: 0,
          casesOver30Days: 0,
        },
        ageingByStatus: [],
        resolutionTrend: [],
        ageingDistribution: [],
        caseTypeResolution: [],
        resolutionByOutcome: [],
        caseDetails: [],
      };
    }
  }

  async getEvidenceFindingsData(
    dateRange?: string,
    filters?: { caseType?: string; priority?: string; investigator?: string },
  ): Promise<EvidenceFindingsData> {
    try {
      // Fetch all cases first - use correct endpoint
      const casesResponse = await apiClient.get<
        Record<string, unknown> | Array<Record<string, unknown>>
      >('/api/v1/cases/all');

      const allCases = Array.isArray(casesResponse)
        ? casesResponse
        : ((casesResponse.data ?? casesResponse.cases ?? []) as Array<
            Record<string, unknown>
          >);

      // There's no dedicated evidence-findings backend endpoint, so
      // dateRange/caseType/priority/investigator are applied client-side to
      // the case population before evidence is fetched per case.
      const { startDate, endDate } = getClientDateRange(dateRange);
      const cases = allCases.filter((caseItem) => {
        const createdAt = caseItem.created_at
          ? new Date(caseItem.created_at as string)
          : null;
        if (createdAt && (createdAt < startDate || createdAt > endDate)) {
          return false;
        }
        if (filters?.caseType && caseItem.case_type !== filters.caseType) {
          return false;
        }
        if (filters?.priority && caseItem.priority !== filters.priority) {
          return false;
        }
        if (
          filters?.investigator &&
          caseItem.case_owner_user_id !== filters.investigator
        ) {
          return false;
        }
        return true;
      });

      if (cases.length === 0) {
        console.warn(
          '[Evidence Report] No cases found, returning empty findings',
        );
        return EMPTY_EVIDENCE_FINDINGS;
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

          const tasks = mapEvidenceToTasks(caseEvidence);

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
      return EMPTY_EVIDENCE_FINDINGS;
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

/* eslint-enable @typescript-eslint/class-methods-use-this */
/* eslint-enable @typescript-eslint/no-unsafe-assignment */
