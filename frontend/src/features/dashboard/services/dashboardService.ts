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
      const response = await apiClient.get<Record<string, unknown>>(
        '/api/v1/reports/case-status?dateRange=all',
      );

      const stats = this.mapStats(response);
      const recentCases = this.mapRecentCases(response);
      const activeCases = this.mapActiveCases(response);

      return {
        stats,
        recentCases,
        activeCases,
      };
    } catch (error: unknown) {
      console.error('Failed to fetch dashboard data:', error);
      throw new Error('Failed to load dashboard data', { cause: error });
    }
  }

  private mapStats(response: Record<string, unknown>): DashboardStats {
    const stats = response.stats as Record<string, unknown> | undefined;

    return {
      totalAlerts: (stats?.totalCases ?? 0) as number,
      highPriorityAlerts: (stats?.highPriorityCases ?? 0) as number,
      openCases: (stats?.openCases ?? 0) as number,
      casesResolvedThisWeek: (stats?.closedCases ?? 0) as number,
      availableCases: (stats?.availableCases ?? 0) as number,
      openAssignedCases: (stats?.openAssignedCases ?? 0) as number,
      resolvedThisMonth: (stats?.resolvedThisMonth ?? 0) as number,
      overdueCases: (stats?.overdueCases ?? 0) as number,
    };
  }

  private mapRecentCases(response: Record<string, unknown>): AlertSummary[] {
    const recentCases = (response.openPriorityCounts ??
      response.recentCases ??
      []) as Array<Record<string, unknown>>;

    return recentCases.map((caseType) => ({
      priority: caseType.priority as 'High' | 'Medium' | 'Low',
      count: caseType.count as number,
      description:
        (caseType.description as string | undefined) ??
        this.getDescription(caseType.priority as string),
    }));
  }

  private mapActiveCases(response: Record<string, unknown>): CaseSummary[] {
    const openStatusCounts = response.openStatusCounts as
      | Array<Record<string, unknown>>
      | undefined;

    if (openStatusCounts) {
      return openStatusCounts.map((item) => ({
        status: item.status as string,
        count: item.count as number,
        description: '',
      }));
    }

    const statusDist = (response.statusDistribution ?? {}) as Record<
      string,
      number | undefined
    >;
    const sum = (...keys: string[]): number =>
      keys.reduce((total, key) => total + (statusDist[key] ?? 0), 0);

    return [
      {
        status: 'assigned',
        count: sum('assigned'),
        description: 'cases requiring your action',
      },
      {
        status: 'inProgress',
        count: sum('inProgress'),
        description: 'cases you are working on',
      },
      {
        status: 'pending',
        count: sum(
          'pendingCaseCreationApproval',
          'pendingFinalApproval',
          'pendingCaseReopeningApproval',
        ),
        description: 'cases awaiting your approval',
      },
      {
        status: 'closed',
        count: sum(
          'autoclosedConfirmed',
          'autoclosedRefuted',
          'closedRefuted',
          'closedConfirmed',
          'closedInconclusive',
        ),
        description: 'cases resolved recently',
      },
    ];
  }

  getDescription(priority: string): string {
    switch (priority) {
      case 'High':
        return 'High priority cases requiring attention';

      case 'Medium':
        return 'Medium priority cases requiring attention';

      case 'Low':
        return 'Low priority cases requiring attention';

      default:
        return `${priority.toLowerCase()} priority cases requiring attention`;
    }
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
/* eslint-enable @typescript-eslint/class-methods-use-this */
