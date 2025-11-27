import { describe, it, expect } from 'vitest';
import type {
  CaseStatusStats,
  CaseStatusDistribution,
  CaseType,
  CaseOutcome,
  MonthlyCaseTrend,
  CaseStatusDetail,
  ReportsData,
  ReportFilters,
  InvestigatorStats,
  InvestigatorWorkload,
  VolumeTrend,
  ResolutionEfficiency,
  OutcomeDistribution,
  InvestigatorPerformance,
  InvestigatorWorkloadData,
  TaskStats,
  TaskCompletionByType,
  CompletionTime,
  CompletionTrend,
  TaskStatusDistribution,
  TaskDetail,
  TaskCompletionData,
  AuditLogsStats,
  AuditLog,
  AuditLogsData,
  CaseAgeingStats,
  AgeingByStatus,
  ResolutionTrend,
  AgeingDistribution,
  CaseTypeResolution,
  CaseAgeingDetail,
  CaseAgeingData,
  EvidenceFindingsStats,
  FindingStatusDistribution,
  EvidenceItem,
  FindingDetail,
  EvidenceFindingsData,
} from '../reports.types';

describe('Reports Types', () => {
  describe('CaseStatusStats', () => {
    it('should define CaseStatusStats interface', () => {
      const stats: CaseStatusStats = {
        totalCases: 100,
        closedCases: 60,
        openCases: 40,
        avgResolutionTime: 12.5,
      };
      expect(stats.totalCases).toBe(100);
      expect(stats.closedCases).toBe(60);
      expect(stats.openCases).toBe(40);
      expect(stats.avgResolutionTime).toBe(12.5);
    });
  });

  describe('CaseStatusDistribution', () => {
    it('should define CaseStatusDistribution interface', () => {
      const distribution: CaseStatusDistribution = {
        assigned: 10,
        inProgress: 15,
        draft: 5,
        suspended: 2,
        pendingApproval: 8,
        closed: 60,
      };
      expect(distribution.assigned).toBe(10);
      expect(distribution.closed).toBe(60);
    });
  });

  describe('CaseType', () => {
    it('should define CaseType interface', () => {
      const caseType: CaseType = {
        name: 'FRAUD',
        count: 50,
        color: '#3b82f6',
      };
      expect(caseType.name).toBe('FRAUD');
      expect(caseType.count).toBe(50);
    });
  });

  describe('CaseOutcome', () => {
    it('should define CaseOutcome interface', () => {
      const outcome: CaseOutcome = {
        resolved: 50,
        confirmed: 10,
        inconclusive: 0,
        pending: 0,
      };
      expect(outcome.resolved).toBe(50);
      expect(outcome.confirmed).toBe(10);
    });
  });

  describe('MonthlyCaseTrend', () => {
    it('should define MonthlyCaseTrend interface', () => {
      const trend: MonthlyCaseTrend = {
        month: '2024-01',
        casesCreated: 10,
        casesClosed: 8,
      };
      expect(trend.month).toBe('2024-01');
      expect(trend.casesCreated).toBe(10);
    });
  });

  describe('CaseStatusDetail', () => {
    it('should define CaseStatusDetail interface', () => {
      const detail: CaseStatusDetail = {
        status: 'Assigned',
        count: 10,
        percentage: '25%',
        avgTimeInStatus: '5 days',
        currentTrendPeriod: '+2',
      };
      expect(detail.status).toBe('Assigned');
      expect(detail.count).toBe(10);
    });
  });

  describe('ReportsData', () => {
    it('should define ReportsData interface', () => {
      const data: ReportsData = {
        stats: {
          totalCases: 100,
          closedCases: 60,
          openCases: 40,
          avgResolutionTime: 12.5,
        },
        statusDistribution: {
          assigned: 10,
          inProgress: 15,
          draft: 5,
          suspended: 2,
          pendingApproval: 8,
          closed: 60,
        },
        caseTypes: [],
        outcomes: {
          resolved: 50,
          confirmed: 10,
          inconclusive: 0,
          pending: 0,
        },
        monthlyTrend: [],
        statusDetails: [],
      };
      expect(data.stats.totalCases).toBe(100);
      expect(data.caseTypes).toEqual([]);
    });
  });

  describe('InvestigatorWorkloadData', () => {
    it('should define InvestigatorWorkloadData interface', () => {
      const data: InvestigatorWorkloadData = {
        stats: {
          totalInvestigators: 10,
          avgCasesPerInvestigator: 15,
          avgResolutionTime: 12,
          caseClosureRate: 85,
        },
        workloadData: [],
        volumeTrend: [],
        efficiencyData: [],
        outcomeData: [],
        performanceData: [],
      };
      expect(data.stats.totalInvestigators).toBe(10);
    });
  });

  describe('TaskCompletionData', () => {
    it('should define TaskCompletionData interface', () => {
      const data: TaskCompletionData = {
        stats: {
          totalTasks: 100,
          completionRate: 85,
          avgCompletionTime: 5,
          overdueTasks: 5,
        },
        completionByType: [],
        avgCompletionTime: [],
        completionTrend: [],
        statusDistribution: [],
        taskDetails: [],
      };
      expect(data.stats.totalTasks).toBe(100);
    });
  });

  describe('AuditLogsData', () => {
    it('should define AuditLogsData interface', () => {
      const data: AuditLogsData = {
        stats: {
          totalLogs: 1000,
          caseActions: 500,
          userSessions: 300,
          systemWarnings: 10,
        },
        auditLogs: [],
      };
      expect(data.stats.totalLogs).toBe(1000);
    });

    it('should define AuditLog interface', () => {
      const log: AuditLog = {
        audit_log_id: 'LOG-1',
        user_id: 'user-1',
        operation: 'CREATE',
        entity_name: 'Case',
        action_performed: 'Case created',
        outcome: 'Success',
        performed_at: '2024-01-01T10:00:00Z',
        type: 'Info',
      };
      expect(log.audit_log_id).toBe('LOG-1');
      expect(log.type).toBe('Info');
    });
  });

  describe('CaseAgeingData', () => {
    it('should define CaseAgeingData interface', () => {
      const data: CaseAgeingData = {
        stats: {
          avgCaseAge: 13,
          avgResolutionTime: 15,
          casesOver15Days: 25,
          casesOver30Days: 10,
        },
        ageingByStatus: [],
        resolutionTrend: [],
        ageingDistribution: [],
        caseTypeResolution: [],
        caseDetails: [],
      };
      expect(data.stats.avgCaseAge).toBe(13);
    });
  });

  describe('EvidenceFindingsData', () => {
    it('should define EvidenceFindingsData interface', () => {
      const data: EvidenceFindingsData = {
        stats: {
          totalFindings: 10,
          evidenceItems: 25,
          confirmedFindings: 5,
          refutedFindings: 3,
        },
        statusDistribution: {
          confirmed: 5,
          refuted: 3,
          inconclusive: 2,
        },
        evidenceItems: [],
        findings: [],
      };
      expect(data.stats.totalFindings).toBe(10);
    });

    it('should define FindingDetail interface', () => {
      const finding: FindingDetail = {
        caseId: 'CASE-1',
        taskId: 'TASK-1',
        finding: 'Evidence collected',
        conclusion: 'Confirmed',
        evidenceCount: 5,
        supportingEvidence: ['evidence-1', 'evidence-2'],
        dateIdentified: '2024-01-01T10:00:00Z',
      };
      expect(finding.caseId).toBe('CASE-1');
      expect(finding.conclusion).toBe('Confirmed');
    });

    it('should define FindingDetail with object evidence', () => {
      const finding: FindingDetail = {
        caseId: 'CASE-1',
        finding: 'Evidence collected',
        conclusion: 'Refuted',
        evidenceCount: 2,
        supportingEvidence: [
          {
            id: 'evidence-1',
            fileName: 'document.pdf',
            fileSize: 1024,
            mimeType: 'application/pdf',
          },
        ],
        dateIdentified: '2024-01-01T10:00:00Z',
      };
      expect(finding.supportingEvidence[0]).toHaveProperty('id');
      expect(typeof finding.supportingEvidence[0]).toBe('object');
    });
  });
});

