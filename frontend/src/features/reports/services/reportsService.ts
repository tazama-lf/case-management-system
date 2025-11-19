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
      if (filters?.investigator)
        params.append('investigator', filters.investigator);

      const response = await apiClient.get<ReportsData>(
        `/api/v1/reports/case-status?${params.toString()}`,
      );

      const processedResponse: ReportsData = {
        ...response,
        stats: {
          totalCases: this.safeFallback(response.stats?.totalCases, 0),
          closedCases: this.safeFallback(response.stats?.closedCases, 0),
          openCases: this.safeFallback(response.stats?.openCases, 0),
          avgResolutionTime: this.safeFallback(
            response.stats?.avgResolutionTime,
            0,
          ),
        },
        statusDistribution: response.statusDistribution || {
          assigned: 0,
          inProgress: 0,
          draft: 0,
          suspended: 0,
          pendingApproval: 0,
          closed: 0,
        },
        caseTypes: response.caseTypes || [],
        outcomes: response.outcomes || {
          resolved: 0,
          confirmed: 0,
          inconclusive: 0,
          pending: 0,
        },
        monthlyTrend: response.monthlyTrend || [],
        statusDetails: response.statusDetails || [],
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
        `/api/v1/reports/investigator-workload?dateRange=${dateRange || 'last30'}`,
      );

      const processedResponse: InvestigatorWorkloadData = {
        ...response,
        stats: {
          totalInvestigators: this.safeFallback(
            response.stats?.totalInvestigators,
            0,
          ),
          avgCasesPerInvestigator: this.safeFallback(
            response.stats?.avgCasesPerInvestigator,
            0,
          ),
          avgResolutionTime: this.safeFallback(
            response.stats?.avgResolutionTime,
            0,
          ),
          caseClosureRate: this.safeFallback(
            response.stats?.caseClosureRate,
            0,
          ),
        },
        workloadData: response.workloadData || [],
        volumeTrend: response.volumeTrend || [],
        efficiencyData: response.efficiencyData || [],
        outcomeData: response.outcomeData || [],
        performanceData: response.performanceData || [],
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
        `/api/v1/reports/task-completion?dateRange=${dateRange || 'last30'}`,
      );

      const processedResponse: TaskCompletionData = {
        ...response,
        stats: {
          totalTasks: this.safeFallback(response.stats?.totalTasks, 0),
          completionRate: this.safeFallback(response.stats?.completionRate, 0),
          avgCompletionTime: this.safeFallback(
            response.stats?.avgCompletionTime,
            0,
          ),
          overdueTasks: this.safeFallback(response.stats?.overdueTasks, 0),
        },
        completionByType: response.completionByType || [],
        avgCompletionTime: response.avgCompletionTime || [],
        completionTrend: response.completionTrend || [],
        statusDistribution: response.statusDistribution || [],
        taskDetails: response.taskDetails || [],
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

  async getAuditLogsData(dateRange?: string): Promise<AuditLogsData> {
    try {
      const response = await apiClient.get<AuditLogsData>(
        `/api/v1/reports/audit-logs?dateRange=${dateRange || 'last30'}`,
      );

      const processedResponse: AuditLogsData = {
        ...response,
        stats: {
          totalLogs: this.safeFallback(response.stats?.totalLogs, 0),
          caseActions: this.safeFallback(response.stats?.caseActions, 0),
          userSessions: this.safeFallback(response.stats?.userSessions, 0),
          systemWarnings: this.safeFallback(response.stats?.systemWarnings, 0),
        },
        auditLogs: response.auditLogs || [],
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
        `/api/v1/reports/case-ageing?dateRange=${dateRange || 'last30'}`,
      );

      const processedResponse: CaseAgeingData = {
        ...response,
        stats: {
          avgCaseAge: this.safeFallback(response.stats?.avgCaseAge, 0),
          avgResolutionTime: this.safeFallback(
            response.stats?.avgResolutionTime,
            0,
          ),
          casesOver15Days: this.safeFallback(
            response.stats?.casesOver15Days,
            0,
          ),
          casesOver30Days: this.safeFallback(
            response.stats?.casesOver30Days,
            0,
          ),
        },
        ageingByStatus: response.ageingByStatus || [],
        resolutionTrend: response.resolutionTrend || [],
        ageingDistribution: response.ageingDistribution || [],
        caseTypeResolution: response.caseTypeResolution || [],
        caseDetails: response.caseDetails || [],
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
      const casesResponse = await apiClient.get<Record<string, unknown> | Record<string, unknown>[]>(
        `/api/v1/cases/all`,
      );
      console.log('[Evidence Report] Cases Response:', casesResponse);
      
      const cases = Array.isArray(casesResponse)
        ? casesResponse
        : (casesResponse && typeof casesResponse === 'object'
            ? ((casesResponse.data as Record<string, unknown>[]) ||
                (casesResponse.cases as Record<string, unknown>[]) ||
                [])
            : []);
      console.log('[Evidence Report] Cases:', cases);

      if (!cases || cases.length === 0) {
        console.warn('[Evidence Report] No cases found, returning empty findings');
        return {
          stats: {
            totalFindings: 0,
            evidenceItems: 0,
            confirmedFindings: 0,
            refutedFindings: 0,
          },
          statusDistribution: {
            confirmed: 0,
            refuted: 0,
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

      // For each case, fetch all evidence by case ID (the backend should handle finding evidence with any taskId)
      for (const caseItem of cases) {
        let caseEvidence: Record<string, unknown>[] = [];
        
        try {
          console.log(`[Evidence Report] Fetching evidence for case ${caseItem.case_id}`);
          
          // Query evidence for this case
          const caseEvidenceResponse = await apiClient.get<Record<string, unknown>>(
            `/api/v1/evidence/case/${caseItem.case_id}`,
          );
          console.log(`[Evidence Report] Case evidence response for case ${caseItem.case_id}:`, caseEvidenceResponse);
          
          if (
            caseEvidenceResponse &&
            typeof caseEvidenceResponse === 'object' &&
            'evidence' in caseEvidenceResponse
          ) {
            const evidence = caseEvidenceResponse.evidence;
            if (Array.isArray(evidence)) {
              caseEvidence = evidence;
            }
          } else if (Array.isArray(caseEvidenceResponse)) {
            caseEvidence = caseEvidenceResponse;
          }
          
          console.log(`[Evidence Report] Total evidence retrieved for case ${caseItem.case_id}: ${caseEvidence.length} items`);
        } catch (caseErr) {
          console.warn(`[Evidence Report] Failed to fetch evidence for case ${caseItem.case_id}:`, caseErr);
        }

        if (caseEvidence.length > 0) {
          totalEvidenceItems += caseEvidence.length;

          // Determine conclusion from case status
          let conclusion: 'Confirmed' | 'Refuted' | 'Inconclusive' = 'Inconclusive';
          const caseStatus = caseItem.status as string;
          if (
            caseStatus?.includes('CONFIRMED') ||
            caseStatus === 'STATUS_82_CLOSED_CONFIRMED' ||
            caseStatus === 'STATUS_71_AUTOCLOSED_CONFIRMED'
          ) {
            conclusion = 'Confirmed';
            confirmedCount++;
          } else if (
            caseStatus?.includes('REFUTED') ||
            caseStatus === 'STATUS_81_CLOSED_REFUTED' ||
            caseStatus === 'STATUS_72_AUTOCLOSED_REFUTED'
          ) {
            conclusion = 'Refuted';
            refutedCount++;
          } else {
            inconclusiveCount++;
          }

          // Map evidence to include full object with all available fields
          const supportingEvidence = caseEvidence.map((e: Record<string, unknown>) => {
            const evidenceId =
              (e.id as string) ||
              (e.evidenceId as string) ||
              (e.evidence_id as string) ||
              `unknown_${Date.now()}`;

            // Extract fileName from attachments array if it exists there
            const attachments = e.attachments as Array<Record<string, unknown>> | undefined;
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

            console.log(
              `[Evidence Report] Mapping evidence: ID=${evidenceId}, FileName=${fileName}, TaskID=${(e.taskId as string) || (e.task_id as string)}, UploadedBy=${(e.uploadedBy as string)}, UploadedAt=${(e.uploadedAt as string)}`,
            );

            return {
              id: evidenceId,
              fileName: fileName,
              fileSize,
              mimeType,
              evidenceType: (e.evidenceType as string) || undefined,
              uploadedBy: (e.uploadedBy as string) || undefined,
              uploadedByName: (e.uploadedByName as string) || undefined,
              uploadedAt: (e.uploadedAt as string) || undefined,
              description: (e.description as string) || undefined,
              hash,
            };
          });
          
          console.log(
            `[Evidence Report] Created ${supportingEvidence.length} supporting evidence items for case ${String(caseItem.case_id)}`,
          );
          
          // Get the first task ID from evidence (all evidence in a finding should be from the same task initially)
          const firstTaskId = (caseEvidence[0]?.taskId as string) ||
            (caseEvidence[0]?.task_id as string);
          
          // Create finding entry for each case with evidence
          allFindings.push({
            caseId: String(caseItem.case_id),
            taskId: firstTaskId,
            finding: `Evidence collected for task ${firstTaskId || 'unknown'}`,
            conclusion,
            evidenceCount: caseEvidence.length,
            supportingEvidence,
            dateIdentified: (caseItem.created_at as string) || new Date().toISOString(),
          });
        } else {
          console.log(`[Evidence Report] No evidence found for case ${String(caseItem.case_id)}`);
        }
      }

      console.log('[Evidence Report] All Findings:', allFindings);

      const processedResponse: EvidenceFindingsData = {
        stats: {
          totalFindings: allFindings.length,
          evidenceItems: totalEvidenceItems,
          confirmedFindings: confirmedCount,
          refutedFindings: refutedCount,
        },
        statusDistribution: {
          confirmed: confirmedCount,
          refuted: refutedCount,
          inconclusive: inconclusiveCount,
        },
        evidenceItems: [],
        findings: allFindings.length > 0 ? allFindings : [],
      };

      console.log('[Evidence Report] Final Response:', processedResponse);
      return processedResponse;
    } catch (error) {
      console.error('[Evidence Report] Error in getEvidenceFindingsData:', error);
      return {
        stats: {
          totalFindings: 0,
          evidenceItems: 0,
          confirmedFindings: 0,
          refutedFindings: 0,
        },
        statusDistribution: {
          confirmed: 0,
          refuted: 0,
          inconclusive: 0,
        },
        evidenceItems: [],
        findings: [],
      };
    }
  }

  private safeFallback(
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
    const safeValue = this.safeFallback(value, 0);
    if (unit) {
      return `${safeValue}${unit}`;
    }
    return safeValue.toString();
  }
}

export const reportsService = new ReportsService();
export default reportsService;
