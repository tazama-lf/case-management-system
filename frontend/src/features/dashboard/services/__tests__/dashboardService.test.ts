import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type Mock,
} from 'vitest';
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
    it('fetches and transforms dashboard data successfully', async () => {
      (apiClient.get as Mock).mockResolvedValue({
        stats: {
          totalCases: 10,
          highPriorityCases: 5,
          openCases: 3,
          closedCases: 7,
        },
        recentCases: [{ priority: 'High', count: 5 }],
        statusDistribution: { assigned: 3, pendingApproval: 2, closed: 1 },
      });

      const result = await dashboardService.getDashboardData();

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/reports/case-status?dateRange=last30',
      );
      expect(result).toEqual({
        stats: {
          totalAlerts: 10,
          highPriorityAlerts: 5,
          openCases: 3,
          casesResolvedThisWeek: 7,
        },
        recentCases: [
          {
            priority: 'High',
            count: 5,
            description: 'Breached cases requiring attention',
          },
        ],
        activeCases: [
          {
            status: 'assigned',
            count: 3,
            description: 'cases requiring your action',
          },
          {
            status: 'pending',
            count: 2,
            description: 'cases awaiting your approval',
          },
          {
            status: 'closed',
            count: 1,
            description: 'cases resolved recently',
          },
        ],
      });
    });

    it('returns defaults when response fields are missing', async () => {
      (apiClient.get as Mock).mockResolvedValue({});

      const result = await dashboardService.getDashboardData();

      expect(result).toEqual({
        stats: {
          totalAlerts: 0,
          highPriorityAlerts: 0,
          openCases: 0,
          casesResolvedThisWeek: 0,
        },
        recentCases: [],
        activeCases: [
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
        ],
      });
    });

    it('throws with expected message when API call fails', async () => {
      const consoleSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('Network error');
      (apiClient.get as Mock).mockRejectedValue(error);

      await expect(dashboardService.getDashboardData()).rejects.toThrow(
        'Failed to load dashboard data',
      );

      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to fetch dashboard data:',
        error,
      );
      consoleSpy.mockRestore();
    });
  });

  describe('getDescription', () => {
    it('returns expected description for known priorities', () => {
      expect(dashboardService.getDescription('High')).toBe(
        'Breached cases requiring attention',
      );
      expect(dashboardService.getDescription('Medium')).toBe(
        'Critical/Urgent cases requiring attention',
      );
      expect(dashboardService.getDescription('Low')).toBe(
        'New cases requiring attention',
      );
    });

    it('returns fallback description for unknown priority', () => {
      expect(dashboardService.getDescription('Urgent')).toBe(
        'urgent cases requiring attention',
      );
    });
  });
});
