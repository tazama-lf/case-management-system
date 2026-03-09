import { describe, it, expect, vi, beforeEach } from 'vitest';
import { reportsService } from '../reportsService';
import apiClient from '../../../../shared/services/apiClient';

// Mock apiClient
vi.mock('../../../../shared/services/apiClient', () => ({
  default: {
    get: vi.fn(),
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

  describe('safeFallback', () => {
    it('should return fallback for null values', () => {
      const result = (reportsService as any).safeFallback(null, 0);
      expect(result).toBe(0);
    });

    it('should return fallback for undefined values', () => {
      const result = (reportsService as any).safeFallback(undefined, 0);
      expect(result).toBe(0);
    });

    it('should return fallback for NaN values', () => {
      const result = (reportsService as any).safeFallback(NaN, 0);
      expect(result).toBe(0);
    });

    it('should return fallback for Infinity values', () => {
      const result = (reportsService as any).safeFallback(Infinity, 0);
      expect(result).toBe(0);
    });

    it('should return value for valid numbers', () => {
      const result = (reportsService as any).safeFallback(42, 0);
      expect(result).toBe(42);
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
  });
});
