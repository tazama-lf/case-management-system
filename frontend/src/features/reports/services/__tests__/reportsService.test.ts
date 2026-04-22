import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportsService } from '../reportsService';
import apiClient from '../../../../shared/services/apiClient';

// Mock apiClient
vi.mock('../../../../shared/services/apiClient', () => ({
  default: {
    get: vi.fn(),
    upload: vi.fn(),
  },
}));

describe('ReportsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getReportsData', () => {
    it('should fetch and process reports data successfully', async () => {
      const mockResponse = {
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
        caseTypes: [{ name: 'FRAUD', count: 50, color: '#3b82f6' }],
        outcomes: {
          resolved: 50,
          confirmed: 10,
          inconclusive: 0,
          pending: 0,
        },
        monthlyTrend: [],
        statusDetails: [],
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await reportsService.getReportsData('last30', {
        caseType: 'FRAUD',
        priority: 'HIGH',
        investigator: 'user-1',
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reports/case-status'),
      );
      expect(result.stats.totalCases).toBe(100);
      expect(result.statusDistribution.assigned).toBe(10);
    });

    it('should handle missing data with safe fallbacks', async () => {
      const mockResponse = {
        stats: null,
        statusDistribution: undefined,
        caseTypes: null,
        outcomes: undefined,
        monthlyTrend: null,
        statusDetails: undefined,
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse as any);

      const result = await reportsService.getReportsData();

      expect(result.stats.totalCases).toBe(0);
      expect(result.statusDistribution.assigned).toBe(0);
      expect(result.caseTypes).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      const result = await reportsService.getReportsData();

      expect(result.stats.totalCases).toBe(0);
      expect(result.statusDistribution.assigned).toBe(0);
      expect(result.caseTypes).toEqual([]);
    });

    it('should include filters in query params', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({
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
        outcomes: { resolved: 0, confirmed: 0, inconclusive: 0, pending: 0 },
        monthlyTrend: [],
        statusDetails: [],
      });

      await reportsService.getReportsData('last7', {
        caseType: 'FRAUD',
        priority: 'HIGH',
        investigator: 'user-1',
      });

      const callUrl = vi.mocked(apiClient.get).mock.calls[0][0] as string;
      expect(callUrl).toContain('dateRange=last7');
      expect(callUrl).toContain('caseType=FRAUD');
      expect(callUrl).toContain('priority=HIGH');
      expect(callUrl).toContain('investigator=user-1');
    });
  });

  describe('getInvestigatorWorkloadData', () => {
    it('should fetch and process investigator workload data successfully', async () => {
      const mockResponse = {
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

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await reportsService.getInvestigatorWorkloadData('last30');

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reports/investigator-workload'),
      );
      expect(result.stats.totalInvestigators).toBe(10);
    });

    it('should handle missing stats with safe fallbacks', async () => {
      const mockResponse = {
        stats: null,
        workloadData: undefined,
        volumeTrend: null,
        efficiencyData: undefined,
        outcomeData: null,
        performanceData: undefined,
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse as any);

      const result = await reportsService.getInvestigatorWorkloadData();

      expect(result.stats.totalInvestigators).toBe(0);
      expect(result.workloadData).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      const result = await reportsService.getInvestigatorWorkloadData();

      expect(result.stats.totalInvestigators).toBe(0);
      expect(result.workloadData).toEqual([]);
    });
  });

  describe('getTaskCompletionData', () => {
    it('should fetch and process task completion data successfully', async () => {
      const mockResponse = {
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

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await reportsService.getTaskCompletionData('last30');

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reports/task-completion'),
      );
      expect(result.stats.totalTasks).toBe(100);
    });

    it('should handle missing data with safe fallbacks', async () => {
      const mockResponse = {
        stats: null,
        completionByType: undefined,
        avgCompletionTime: null,
        completionTrend: undefined,
        statusDistribution: null,
        taskDetails: undefined,
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse as any);

      const result = await reportsService.getTaskCompletionData();

      expect(result.stats.totalTasks).toBe(0);
      expect(result.completionByType).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      const result = await reportsService.getTaskCompletionData();

      expect(result.stats.totalTasks).toBe(0);
      expect(result.completionByType).toEqual([]);
    });
  });

  describe('getAuditLogsData', () => {
    it('should fetch and process audit logs data successfully', async () => {
      const mockResponse = {
        stats: {
          totalLogs: 1000,
          caseActions: 500,
          userSessions: 300,
          systemWarnings: 10,
        },
        auditLogs: [],
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await reportsService.getAuditLogsData('last30');

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reports/audit-logs'),
      );
      expect(result.stats.totalLogs).toBe(1000);
    });

    it('should handle missing stats with safe fallbacks', async () => {
      const mockResponse = {
        stats: null,
        auditLogs: undefined,
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse as any);

      const result = await reportsService.getAuditLogsData();

      expect(result.stats.totalLogs).toBe(0);
      expect(result.auditLogs).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      const result = await reportsService.getAuditLogsData();

      expect(result.stats.totalLogs).toBe(0);
      expect(result.auditLogs).toEqual([]);
    });
  });

  describe('getCaseAgeingData', () => {
    it('should fetch and process case ageing data successfully', async () => {
      const mockResponse = {
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

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

      const result = await reportsService.getCaseAgeingData('last30');

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/reports/case-ageing'),
      );
      expect(result.stats.avgCaseAge).toBe(13);
    });

    it('should handle missing data with safe fallbacks', async () => {
      const mockResponse = {
        stats: null,
        ageingByStatus: undefined,
        resolutionTrend: null,
        ageingDistribution: undefined,
        caseTypeResolution: null,
        caseDetails: undefined,
      };

      vi.mocked(apiClient.get).mockResolvedValue(mockResponse as any);

      const result = await reportsService.getCaseAgeingData();

      expect(result.stats.avgCaseAge).toBe(0);
      expect(result.ageingByStatus).toEqual([]);
    });

    it('should handle errors gracefully', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      const result = await reportsService.getCaseAgeingData();

      expect(result.stats.avgCaseAge).toBe(0);
      expect(result.ageingByStatus).toEqual([]);
    });
  });

  describe('safeFallback (via formatDisplayValue)', () => {
    it('should return fallback for null values', () => {
      expect(reportsService.formatDisplayValue(null)).toBe('0');
    });

    it('should return fallback for undefined values', () => {
      expect(reportsService.formatDisplayValue(undefined)).toBe('0');
    });

    it('should return fallback for NaN values', () => {
      expect(reportsService.formatDisplayValue(NaN)).toBe('0');
    });

    it('should return fallback for Infinity values', () => {
      expect(reportsService.formatDisplayValue(Infinity)).toBe('0');
    });

    it('should return value for valid numbers', () => {
      expect(reportsService.formatDisplayValue(42)).toBe('42');
    });
  });

  describe('formatDisplayValue', () => {
    it('should format value with unit', () => {
      const result = reportsService.formatDisplayValue(42, 'days');
      expect(result).toBe('42days');
    });

    it('should format value without unit', () => {
      const result = reportsService.formatDisplayValue(42);
      expect(result).toBe('42');
    });

    it('should handle null values', () => {
      const result = reportsService.formatDisplayValue(null);
      expect(result).toBe('0');
    });

    it('should handle undefined values', () => {
      const result = reportsService.formatDisplayValue(undefined);
      expect(result).toBe('0');
    });

    it('should format zero with unit', () => {
      const result = reportsService.formatDisplayValue(0, '%');
      expect(result).toBe('0%');
    });

    it('should format negative infinity with unit', () => {
      const result = reportsService.formatDisplayValue(-Infinity, 'days');
      expect(result).toBe('0days');
    });
  });

  describe('generateFraudReport', () => {
    it('should upload fraud report successfully', async () => {
      const mockFile = new File(['test'], 'report.pdf', {
        type: 'application/pdf',
      });
      const mockData = {
        file: mockFile,
        caseId: 1,
        reportType: 'FRAUD',
        investigatorInputs: 'Some notes',
        supervisorRemarks: 'Approved',
        outcome: 'Confirmed',
        description: 'Fraud report',
      };
      const mockResponse = {
        id: 'report-1',
        caseId: 1,
        fileName: 'report.pdf',
        reportType: 'FRAUD',
        fileSize: 4,
        mimeType: 'application/pdf',
        hash: 'abc123',
        uploadedBy: 'user-1',
        uploadedAt: new Date(),
        filePath: '/reports/report.pdf',
      };

      vi.mocked(apiClient.upload).mockResolvedValue(mockResponse);

      const result = await reportsService.generateFraudReport(mockData);

      expect(apiClient.upload).toHaveBeenCalledWith(
        '/api/v1/reports/fraud/generate',
        expect.any(FormData),
      );
      expect(result.id).toBe('report-1');
    });

    it('should upload fraud report with optional fields empty', async () => {
      const mockFile = new File(['test'], 'report.pdf', {
        type: 'application/pdf',
      });
      const mockData = {
        file: mockFile,
        caseId: 2,
        reportType: 'FRAUD',
      };
      const mockResponse = {
        id: 'report-2',
        caseId: 2,
        fileName: 'report.pdf',
        reportType: 'FRAUD',
        fileSize: 4,
        mimeType: 'application/pdf',
        hash: 'def456',
        uploadedBy: 'user-1',
        uploadedAt: new Date(),
        filePath: '/reports/report.pdf',
      };

      vi.mocked(apiClient.upload).mockResolvedValue(mockResponse);

      const result = await reportsService.generateFraudReport(mockData);

      expect(result.id).toBe('report-2');
    });

    it('should throw error on upload failure with Error instance', async () => {
      const mockFile = new File(['test'], 'report.pdf', {
        type: 'application/pdf',
      });
      const mockData = {
        file: mockFile,
        caseId: 1,
        reportType: 'FRAUD',
      };

      vi.mocked(apiClient.upload).mockRejectedValue(new Error('Upload failed'));

      await expect(
        reportsService.generateFraudReport(mockData),
      ).rejects.toThrow('Upload failed');
    });

    it('should throw error on upload failure with response data', async () => {
      const mockFile = new File(['test'], 'report.pdf', {
        type: 'application/pdf',
      });
      const mockData = {
        file: mockFile,
        caseId: 1,
        reportType: 'FRAUD',
      };

      vi.mocked(apiClient.upload).mockRejectedValue({
        response: { data: { message: 'File too large' } },
      });

      await expect(
        reportsService.generateFraudReport(mockData),
      ).rejects.toThrow('File too large');
    });

    it('should throw error on upload failure with message property', async () => {
      const mockFile = new File(['test'], 'report.pdf', {
        type: 'application/pdf',
      });
      const mockData = {
        file: mockFile,
        caseId: 1,
        reportType: 'FRAUD',
      };

      vi.mocked(apiClient.upload).mockRejectedValue({
        message: 'Server error',
      });

      await expect(
        reportsService.generateFraudReport(mockData),
      ).rejects.toThrow('Server error');
    });

    it('should throw generic error on upload failure with unknown error', async () => {
      const mockFile = new File(['test'], 'report.pdf', {
        type: 'application/pdf',
      });
      const mockData = {
        file: mockFile,
        caseId: 1,
        reportType: 'FRAUD',
      };

      vi.mocked(apiClient.upload).mockRejectedValue({});

      await expect(
        reportsService.generateFraudReport(mockData),
      ).rejects.toThrow('Failed to upload evidence');
    });

    it('should throw error on upload failure with response but no message', async () => {
      const mockFile = new File(['test'], 'report.pdf', {
        type: 'application/pdf',
      });
      const mockData = {
        file: mockFile,
        caseId: 1,
        reportType: 'FRAUD',
      };

      vi.mocked(apiClient.upload).mockRejectedValue({
        response: { data: {} },
      });

      await expect(
        reportsService.generateFraudReport(mockData),
      ).rejects.toThrow('Failed to upload evidence');
    });
  });

  describe('getEvidenceFindingsData', () => {
    it('should return empty findings when no cases exist', async () => {
      vi.mocked(apiClient.get).mockResolvedValue([]);

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.stats.totalFindings).toBe(0);
      expect(result.findings).toEqual([]);
    });

    it('should return empty findings when casesResponse has data property', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ data: [] });

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.stats.totalFindings).toBe(0);
    });

    it('should return empty findings when casesResponse has cases property', async () => {
      vi.mocked(apiClient.get).mockResolvedValue({ cases: [] });

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.stats.totalFindings).toBe(0);
    });

    it('should skip draft, abandoned, and pending approval cases', async () => {
      const cases = [
        { case_id: 1, status: 'STATUS_00_DRAFT' },
        { case_id: 2, status: 'STATUS_99_ABANDONED' },
        { case_id: 3, status: 'STATUS_01_PENDING_CASE_CREATION_APPROVAL' },
      ];

      vi.mocked(apiClient.get).mockResolvedValue(cases);

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.stats.totalFindings).toBe(0);
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });

    it('should aggregate evidence from confirmed cases', async () => {
      const cases = [
        {
          case_id: 10,
          status: 'STATUS_82_CLOSED_CONFIRMED',
          created_at: '2024-01-01',
        },
      ];
      const evidence = [{ id: 'ev-1', fileName: 'doc.pdf', taskId: 100 }];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(cases)
        .mockResolvedValueOnce({ evidence });

      const result = await reportsService.getEvidenceFindingsData('last30');

      expect(result.stats.totalFindings).toBe(1);
      expect(result.stats.confirmedFindings).toBe(1);
      expect(result.stats.evidenceItems).toBe(1);
      expect(result.findings[0].conclusion).toBe('Confirmed');
    });

    it('should aggregate evidence from autoclosed confirmed cases', async () => {
      const cases = [
        {
          case_id: 11,
          status: 'STATUS_71_AUTOCLOSED_CONFIRMED',
          created_at: '2024-01-01',
        },
      ];
      const evidence = [{ id: 'ev-2', fileName: 'doc.pdf', taskId: 200 }];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(cases)
        .mockResolvedValueOnce({ evidence });

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.findings[0].conclusion).toBe('Confirmed');
    });

    it('should aggregate evidence from refuted cases', async () => {
      const cases = [
        {
          case_id: 20,
          status: 'STATUS_81_CLOSED_REFUTED',
          created_at: '2024-02-01',
        },
      ];
      const evidence = [{ id: 'ev-3', fileName: 'evidence.pdf', taskId: 300 }];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(cases)
        .mockResolvedValueOnce({ evidence });

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.stats.refutedFindings).toBe(1);
      expect(result.findings[0].conclusion).toBe('Refuted');
    });

    it('should aggregate evidence from autoclosed refuted cases', async () => {
      const cases = [
        {
          case_id: 21,
          status: 'STATUS_72_AUTOCLOSED_REFUTED',
          created_at: '2024-02-01',
        },
      ];
      const evidence = [{ id: 'ev-4', fileName: 'doc.pdf', taskId: 400 }];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(cases)
        .mockResolvedValueOnce({ evidence });

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.findings[0].conclusion).toBe('Refuted');
    });

    it('should aggregate evidence from inconclusive cases', async () => {
      const cases = [
        {
          case_id: 30,
          status: 'STATUS_83_CLOSED_INCONCLUSIVE',
          created_at: '2024-03-01',
        },
      ];
      const evidence = [{ id: 'ev-5', fileName: 'doc.pdf', taskId: 500 }];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(cases)
        .mockResolvedValueOnce({ evidence });

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.stats.inconclusiveFindings).toBe(1);
      expect(result.findings[0].conclusion).toBe('Inconclusive');
    });

    it('should mark in-progress cases correctly', async () => {
      const cases = [
        {
          case_id: 40,
          status: 'STATUS_20_IN_PROGRESS',
          created_at: '2024-04-01',
        },
      ];
      const evidence = [{ id: 'ev-6', fileName: 'doc.pdf', taskId: 600 }];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(cases)
        .mockResolvedValueOnce({ evidence });

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.findings[0].conclusion).toBe('InProgress');
    });

    it('should handle evidence returned as array directly', async () => {
      const cases = [
        {
          case_id: 50,
          status: 'STATUS_82_CLOSED_CONFIRMED',
          created_at: '2024-01-01',
        },
      ];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(cases)
        .mockResolvedValueOnce([
          { id: 'ev-7', fileName: 'file.pdf', taskId: 700 },
        ]);

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.stats.totalFindings).toBe(1);
    });

    it('should filter out evidence with reportId', async () => {
      const cases = [
        {
          case_id: 60,
          status: 'STATUS_82_CLOSED_CONFIRMED',
          created_at: '2024-01-01',
        },
      ];
      const evidence = [
        { id: 'ev-8', fileName: 'doc.pdf', taskId: 800 },
        { id: 'ev-9', fileName: 'report.pdf', taskId: 801, reportId: 'r-1' },
      ];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(cases)
        .mockResolvedValueOnce({ evidence });

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.stats.evidenceItems).toBe(1);
    });

    it('should group evidence by task and handle unknown taskId', async () => {
      const cases = [
        {
          case_id: 70,
          status: 'STATUS_82_CLOSED_CONFIRMED',
          created_at: '2024-01-01',
        },
      ];
      const evidence = [
        { id: 'ev-10', fileName: 'doc.pdf', taskId: 900 },
        { id: 'ev-11', fileName: 'doc2.pdf' },
      ];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(cases)
        .mockResolvedValueOnce({ evidence });

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.findings[0].tasks.length).toBe(2);
    });

    it('should handle evidence fetch failure for a case gracefully', async () => {
      const cases = [
        {
          case_id: 80,
          status: 'STATUS_82_CLOSED_CONFIRMED',
          created_at: '2024-01-01',
        },
      ];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(cases)
        .mockRejectedValueOnce(new Error('Evidence fetch failed'));

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.stats.totalFindings).toBe(0);
    });

    it('should return empty on top-level error', async () => {
      vi.mocked(apiClient.get).mockRejectedValue(new Error('Network error'));

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.stats.totalFindings).toBe(0);
      expect(result.findings).toEqual([]);
    });

    it('should handle multiple cases with mixed statuses', async () => {
      const cases = [
        {
          case_id: 1,
          status: 'STATUS_82_CLOSED_CONFIRMED',
          created_at: '2024-01-01',
        },
        {
          case_id: 2,
          status: 'STATUS_81_CLOSED_REFUTED',
          created_at: '2024-01-02',
        },
        { case_id: 3, status: 'STATUS_00_DRAFT' },
      ];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(cases)
        .mockResolvedValueOnce({
          evidence: [{ id: 'e1', fileName: 'a.pdf', taskId: 1 }],
        })
        .mockResolvedValueOnce({
          evidence: [{ id: 'e2', fileName: 'b.pdf', taskId: 2 }],
        });

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.stats.totalFindings).toBe(2);
      expect(result.stats.confirmedFindings).toBe(1);
      expect(result.stats.refutedFindings).toBe(1);
      expect(result.statusDistribution.confirmed).toBe(1);
      expect(result.statusDistribution.refuted).toBe(1);
    });

    it('should handle evidence with attachments', async () => {
      const cases = [
        {
          case_id: 90,
          status: 'STATUS_82_CLOSED_CONFIRMED',
          created_at: '2024-01-01',
        },
      ];
      const evidence = [
        {
          id: 'ev-12',
          taskId: 1000,
          attachments: [
            {
              fileName: 'attached.pdf',
              fileSize: 1024,
              mimeType: 'application/pdf',
              hash: 'hash1',
            },
          ],
        },
      ];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(cases)
        .mockResolvedValueOnce({ evidence });

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.stats.totalFindings).toBe(1);
      expect(result.findings[0].tasks[0].supportingEvidence[0].fileName).toBe(
        'attached.pdf',
      );
    });

    it('should use created_at as dateIdentified or fallback to current date', async () => {
      const cases = [{ case_id: 100, status: 'STATUS_82_CLOSED_CONFIRMED' }];
      const evidence = [{ id: 'ev-13', fileName: 'doc.pdf', taskId: 1100 }];

      vi.mocked(apiClient.get)
        .mockResolvedValueOnce(cases)
        .mockResolvedValueOnce({ evidence });

      const result = await reportsService.getEvidenceFindingsData();

      expect(result.findings[0].dateIdentified).toBeDefined();
    });
  });
});
