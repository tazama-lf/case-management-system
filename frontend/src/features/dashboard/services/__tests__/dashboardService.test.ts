import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashboardService, dashboardService } from '../dashboardService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('DashboardService', () => {
  let service: DashboardService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new DashboardService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── getDashboardStats ────────────────────────────────────────

  describe('getDashboardStats', () => {
    it('transforms API response into DashboardStats', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        stats: { totalCases: 10, openCases: 3, closedCases: 7 },
        caseTypes: [{ name: 'FRAUD', count: 5 }],
      });

      const result = await service.getDashboardStats();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reports/case-status?dateRange=last30');
      expect(result).toEqual({
        totalAlerts: 10,
        highPriorityAlerts: 5,
        openCases: 3,
        casesResolvedThisWeek: 7,
      });
    });

    it('returns defaults when stats is missing', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        caseTypes: [],
      });

      const result = await service.getDashboardStats();

      expect(result).toEqual({
        totalAlerts: 0,
        highPriorityAlerts: 0,
        openCases: 0,
        casesResolvedThisWeek: 0,
      });
    });

    it('returns 0 highPriorityAlerts when no FRAUD type', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        stats: { totalCases: 10, openCases: 3, closedCases: 7 },
        caseTypes: [{ name: 'AML', count: 5 }],
      });

      const result = await service.getDashboardStats();

      expect(result.highPriorityAlerts).toBe(0);
    });

    it('returns fallback data when API fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

      const result = await service.getDashboardStats();

      expect(result).toEqual({
        totalAlerts: 42,
        highPriorityAlerts: 8,
        openCases: 12,
        casesResolvedThisWeek: 24,
      });
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch dashboard stats:', expect.any(Error));
      consoleSpy.mockRestore();
    });

    it('handles missing caseTypes in response', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        stats: { totalCases: 5 },
      });

      const result = await service.getDashboardStats();

      expect(result.highPriorityAlerts).toBe(0);
    });
  });

  // ─── getRecentAlerts ──────────────────────────────────────────

  describe('getRecentAlerts', () => {
    it('maps caseTypes to AlertSummary array', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        caseTypes: [
          { name: 'FRAUD', count: 5 },
          { name: 'AML', count: 3 },
        ],
      });

      const result = await service.getRecentAlerts();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reports/case-status?dateRange=last7');
      expect(result).toEqual([
        { priority: 'high', count: 5, description: 'fraud cases requiring attention' },
        { priority: 'medium', count: 3, description: 'aml cases requiring attention' },
      ]);
    });

    it('returns empty array for empty caseTypes', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({ caseTypes: [] });

      const result = await service.getRecentAlerts();

      expect(result).toEqual([]);
    });

    it('handles missing caseTypes (undefined)', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.getRecentAlerts();

      expect(result).toEqual([]);
    });

    it('returns fallback alerts when API fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

      const result = await service.getRecentAlerts();

      expect(result).toHaveLength(3);
      expect(result[0].priority).toBe('high');
      expect(result[1].priority).toBe('medium');
      expect(result[2].priority).toBe('low');
      consoleSpy.mockRestore();
    });
  });

  // ─── getActiveCases ───────────────────────────────────────────

  describe('getActiveCases', () => {
    it('maps statusDistribution to CaseSummary array', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        statusDistribution: { assigned: 5, pendingApproval: 3, closed: 8 },
      });

      const result = await service.getActiveCases();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reports/case-status?dateRange=last30');
      expect(result).toEqual([
        { status: 'assigned', count: 5, description: 'cases requiring your action' },
        { status: 'pending', count: 3, description: 'cases awaiting your approval' },
        { status: 'closed', count: 8, description: 'cases resolved recently' },
      ]);
    });

    it('handles missing statusDistribution', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({});

      const result = await service.getActiveCases();

      expect(result).toEqual([
        { status: 'assigned', count: undefined, description: 'cases requiring your action' },
        { status: 'pending', count: undefined, description: 'cases awaiting your approval' },
        { status: 'closed', count: undefined, description: 'cases resolved recently' },
      ]);
    });

    it('returns fallback cases when API fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (apiClient.get as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('API error'));

      const result = await service.getActiveCases();

      expect(result).toEqual([
        { status: 'assigned', count: 5, description: 'cases requiring your action' },
        { status: 'pending', count: 3, description: 'cases awaiting your approval' },
        { status: 'closed', count: 8, description: 'cases resolved in the past week' },
      ]);
      consoleSpy.mockRestore();
    });
  });

  // ─── getDashboardData ─────────────────────────────────────────

  describe('getDashboardData', () => {
    it('combines stats, alerts, and cases', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>)
        // getDashboardStats call
        .mockResolvedValueOnce({
          stats: { totalCases: 10, openCases: 3, closedCases: 7 },
          caseTypes: [{ name: 'FRAUD', count: 5 }],
        })
        // getRecentAlerts call
        .mockResolvedValueOnce({
          caseTypes: [{ name: 'FRAUD', count: 5 }],
        })
        // getActiveCases call
        .mockResolvedValueOnce({
          statusDistribution: { assigned: 3, pendingApproval: 1, closed: 2 },
        });

      const result = await service.getDashboardData();

      expect(result).toEqual({
        stats: {
          totalAlerts: 10,
          highPriorityAlerts: 5,
          openCases: 3,
          casesResolvedThisWeek: 7,
        },
        recentAlerts: [
          expect.objectContaining({ priority: 'high', count: 5 }),
        ],
        activeCases: [
          expect.objectContaining({ status: 'assigned', count: 3 }),
          expect.objectContaining({ status: 'pending', count: 1 }),
          expect.objectContaining({ status: 'closed', count: 2 }),
        ],
      });
    });

    it('throws with cause when sub-calls all fail', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      // When ALL three calls fail, getDashboardData's Promise.all will get three results
      // but since each sub-method catches its own error, they won't throw.
      // We need to make getDashboardData's own try/catch get triggered.
      // Actually, sub-methods catch their own errors and return fallbacks.
      // So getDashboardData won't fail unless something unexpected happens.
      // Let's test the catch by spying on the method.

      // Simulate unexpected error in getDashboardData
      const original = service.getDashboardStats.bind(service);
      service.getDashboardStats = vi.fn().mockRejectedValue(new Error('unexpected'));
      service.getRecentAlerts = vi.fn().mockRejectedValue(new Error('unexpected'));
      service.getActiveCases = vi.fn().mockRejectedValue(new Error('unexpected'));

      await expect(service.getDashboardData()).rejects.toThrow('Failed to load dashboard data');
      expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch dashboard data:', expect.any(Error));
      consoleSpy.mockRestore();
    });
  });

  // ─── mapCaseTypeToPriority (private static) ───────────────────

  describe('mapCaseTypeToPriority via getRecentAlerts', () => {
    it('maps FRAUD to high', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        caseTypes: [{ name: 'FRAUD', count: 1 }],
      });
      const result = await service.getRecentAlerts();
      expect(result[0].priority).toBe('high');
    });

    it('maps FRAUD_AND_AML to high', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        caseTypes: [{ name: 'FRAUD_AND_AML', count: 1 }],
      });
      const result = await service.getRecentAlerts();
      expect(result[0].priority).toBe('high');
    });

    it('maps AML to medium', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        caseTypes: [{ name: 'AML', count: 1 }],
      });
      const result = await service.getRecentAlerts();
      expect(result[0].priority).toBe('medium');
    });

    it('maps unknown types to low', async () => {
      (apiClient.get as ReturnType<typeof vi.fn>).mockResolvedValue({
        caseTypes: [{ name: 'OTHER', count: 1 }],
      });
      const result = await service.getRecentAlerts();
      expect(result[0].priority).toBe('low');
    });
  });

  // ─── Exported singleton ───────────────────────────────────────

  it('exports a singleton instance', () => {
    expect(dashboardService).toBeInstanceOf(DashboardService);
  });
});
