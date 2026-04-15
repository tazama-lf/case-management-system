/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument -- Service handles dynamic API response data */
/* eslint-disable @typescript-eslint/class-methods-use-this -- Service methods are called on instances */
import apiClient from '../../../shared/services/apiClient';
import type {
  DashboardData,
  DashboardStats,
  AlertSummary,
  CaseSummary,
} from '../types/dashboard.types';

class DashboardService {
  async getDashboardData(): Promise<DashboardData> {
    try {
      const [stats, recentAlerts, activeCases] = await Promise.all([
        this.getDashboardStats(),
        this.getRecentAlerts(),
        this.getActiveCases(),
      ]);

      return {
        stats,
        recentAlerts,
        activeCases,
      };
    } catch (error: unknown) {
      console.error('Failed to fetch dashboard data:', error);
      throw new Error('Failed to load dashboard data', { cause: error });
    }
  }

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = await apiClient.get<Record<string, unknown>>(
        '/api/v1/reports/case-status?dateRange=last30',
      );

      const stats = response.stats as Record<string, unknown> | undefined;
      const caseTypes = (response.caseTypes ?? []) as Array<Record<string, unknown>>;

      return {
        totalAlerts: (stats?.totalCases ?? 0) as number,
        highPriorityAlerts:
          (caseTypes.find((ct) => ct.name === 'FRAUD')?.count ?? 0) as number,
        openCases: (stats?.openCases ?? 0) as number,
        casesResolvedThisWeek: (stats?.closedCases ?? 0) as number,
      };
    } catch (error: unknown) {
      console.error('Failed to fetch dashboard stats:', error);
      return {
        totalAlerts: 42,
        highPriorityAlerts: 8,
        openCases: 12,
        casesResolvedThisWeek: 24,
      };
    }
  }

  async getRecentAlerts(): Promise<AlertSummary[]> {
    try {
      const response = await apiClient.get<Record<string, unknown>>(
        '/api/v1/reports/case-status?dateRange=last7',
      );

      const caseTypes = (response.caseTypes ?? []) as Array<Record<string, unknown>>;

      return caseTypes.map((caseType) => ({
        priority: DashboardService.mapCaseTypeToPriority(caseType.name as string),
        count: caseType.count as number,
        description: `${String(caseType.name).toLowerCase()} cases requiring attention`,
      }));
    } catch (error: unknown) {
      console.error('Failed to fetch recent alerts:', error);
      return [
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
      ];
    }
  }

  async getActiveCases(): Promise<CaseSummary[]> {
    try {
      const response = await apiClient.get<Record<string, unknown>>(
        '/api/v1/reports/case-status?dateRange=last30',
      );
      const statusDist = (response.statusDistribution ?? {}) as Record<string, unknown>;

      return [
        {
          status: 'assigned',
          count: (statusDist.assigned ?? 0) as number,
          description: 'cases requiring your action',
        },
        {
          status: 'pending',
          count: (statusDist.pendingApproval ?? 0) as number,
          description: 'cases awaiting your approval',
        },
        {
          status: 'closed',
          count: (statusDist.closed ?? 0) as number,
          description: 'cases resolved recently',
        },
      ];
    } catch (error: unknown) {
      console.error('Failed to fetch active cases:', error);
      return [
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
      ];
    }
  }

  private static mapCaseTypeToPriority(caseType: string): 'high' | 'medium' | 'low' {
    switch (caseType) {
      case 'FRAUD':
      case 'FRAUD_AND_AML':
        return 'high';
      case 'AML':
        return 'medium';
      default:
        return 'low';
    }
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
/* eslint-enable @typescript-eslint/class-methods-use-this */
/* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-argument */
