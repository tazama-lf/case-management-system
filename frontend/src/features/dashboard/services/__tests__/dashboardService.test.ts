import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { dashboardService } from '../dashboardService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('dashboardService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('getDashboardData', () => {
    it('fetches and combines dashboard data successfully', async () => {
      const mockStats = {
        totalAlerts: 10,
        highPriorityAlerts: 5,
        openCases: 3,
        casesResolvedThisWeek: 7,
      };

      const mockAlerts = [
        { priority: 'high', count: 5, description: 'High priority alerts' },
      ];

      const mockCases = [
        { status: 'assigned', count: 3, description: 'Assigned cases' },
      ];

      (apiClient.get as vi.Mock)
        .mockResolvedValueOnce({
          stats: { totalCases: 10, openCases: 3, closedCases: 7 },
          caseTypes: [{ name: 'FRAUD', count: 5 }],
        })
        .mockResolvedValueOnce({
          caseTypes: [{ name: 'FRAUD', count: 5 }],
        })
        .mockResolvedValueOnce({
          statusDistribution: { assigned: 3, pendingApproval: 0, closed: 0 },
        });

      const result = await dashboardService.getDashboardData();

      expect(result).toEqual({
        stats: mockStats,
        recentAlerts: expect.arrayContaining([
          expect.objectContaining({ priority: 'high' }),
        ]),
        activeCases: expect.arrayContaining([
          expect.objectContaining({ status: 'assigned' }),
        ]),
      });
    });

    it('handles errors and throws with message', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('Network error');

      // Mock getDashboardStats to throw, which will cause Promise.all to reject
      vi.spyOn(dashboardService, 'getDashboardStats').mockRejectedValue(error);
      vi.spyOn(dashboardService, 'getRecentAlerts').mockRejectedValue(error);
      vi.spyOn(dashboardService, 'getActiveCases').mockRejectedValue(error);

      await expect(dashboardService.getDashboardData()).rejects.toThrow(
        'Failed to load dashboard data',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch dashboard data:',
        expect.any(Error),
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getDashboardStats', () => {
    it('fetches and transforms dashboard stats successfully', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue({
        stats: { totalCases: 10, openCases: 3, closedCases: 7 },
        caseTypes: [{ name: 'FRAUD', count: 5 }],
      });

      const result = await dashboardService.getDashboardStats();

      expect(result).toEqual({
        totalAlerts: 10,
        highPriorityAlerts: 5,
        openCases: 3,
        casesResolvedThisWeek: 7,
      });
    });

    it('returns default values when API call fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue(new Error('API error'));

      const result = await dashboardService.getDashboardStats();

      expect(result).toEqual({
        totalAlerts: 42,
        highPriorityAlerts: 8,
        openCases: 12,
        casesResolvedThisWeek: 24,
      });

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('handles missing stats in response', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue({
        caseTypes: [],
      });

      const result = await dashboardService.getDashboardStats();

      expect(result).toEqual({
        totalAlerts: 0,
        highPriorityAlerts: 0,
        openCases: 0,
        casesResolvedThisWeek: 0,
      });
    });

    it('handles missing FRAUD case type', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue({
        stats: { totalCases: 10, openCases: 3, closedCases: 7 },
        caseTypes: [{ name: 'AML', count: 5 }],
      });

      const result = await dashboardService.getDashboardStats();

      expect(result.highPriorityAlerts).toBe(0);
    });
  });

  describe('getRecentAlerts', () => {
    it('fetches and transforms recent alerts successfully', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue({
        caseTypes: [
          { name: 'FRAUD', count: 5 },
          { name: 'AML', count: 3 },
        ],
      });

      const result = await dashboardService.getRecentAlerts();

      expect(result).toEqual([
        {
          priority: 'high',
          count: 5,
          description: 'fraud cases requiring attention',
        },
        {
          priority: 'medium',
          count: 3,
          description: 'aml cases requiring attention',
        },
      ]);
    });

    it('returns default alerts when API call fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue(new Error('API error'));

      const result = await dashboardService.getRecentAlerts();

      expect(result).toEqual([
        {
          priority: 'high',
          count: 8,
          description: 'alerts requiring immediate attention',
        },
        {
          priority: 'medium',
          count: 15,
          description: 'alerts pending review',
        },
        {
          priority: 'low',
          count: 19,
          description: 'alerts for routine checking',
        },
      ]);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('handles empty case types array', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue({
        caseTypes: [],
      });

      const result = await dashboardService.getRecentAlerts();

      expect(result).toEqual([]);
    });
  });

  describe('getActiveCases', () => {
    it('fetches and transforms active cases successfully', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue({
        statusDistribution: {
          assigned: 5,
          pendingApproval: 3,
          closed: 8,
        },
      });

      const result = await dashboardService.getActiveCases();

      expect(result).toEqual([
        {
          status: 'assigned',
          count: 5,
          description: 'cases requiring your action',
        },
        {
          status: 'pending',
          count: 3,
          description: 'cases awaiting your approval',
        },
        {
          status: 'closed',
          count: 8,
          description: 'cases resolved recently',
        },
      ]);
    });

    it('returns default cases when API call fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue(new Error('API error'));

      const result = await dashboardService.getActiveCases();

      expect(result).toEqual([
        {
          status: 'assigned',
          count: 5,
          description: 'cases requiring your action',
        },
        {
          status: 'pending',
          count: 3,
          description: 'cases awaiting your approval',
        },
        {
          status: 'closed',
          count: 8,
          description: 'cases resolved in the past week',
        },
      ]);

      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('handles missing status distribution', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue({});

      const result = await dashboardService.getActiveCases();

      expect(result).toEqual([
        {
          status: 'assigned',
          count: 0,
          description: 'cases requiring your action',
        },
        {
          status: 'pending',
          count: 0,
          description: 'cases awaiting your approval',
        },
        {
          status: 'closed',
          count: 0,
          description: 'cases resolved recently',
        },
      ]);
    });
  });

  describe('mapCaseTypeToPriority', () => {
    it('maps FRAUD to high priority', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue({
        caseTypes: [{ name: 'FRAUD', count: 5 }],
      });

      const result = await dashboardService.getRecentAlerts();

      expect(result[0].priority).toBe('high');
    });

    it('maps FRAUD_AND_AML to high priority', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue({
        caseTypes: [{ name: 'FRAUD_AND_AML', count: 5 }],
      });

      const result = await dashboardService.getRecentAlerts();

      expect(result[0].priority).toBe('high');
    });

    it('maps AML to medium priority', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue({
        caseTypes: [{ name: 'AML', count: 5 }],
      });

      const result = await dashboardService.getRecentAlerts();

      expect(result[0].priority).toBe('medium');
    });

    it('maps unknown case types to low priority', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue({
        caseTypes: [{ name: 'UNKNOWN', count: 5 }],
      });

      const result = await dashboardService.getRecentAlerts();

      expect(result[0].priority).toBe('low');
    });
  });
});
