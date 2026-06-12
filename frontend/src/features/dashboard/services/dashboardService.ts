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
        '/api/v1/reports/case-status?dateRange=last30',
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
    };
  }

  private mapRecentCases(response: Record<string, unknown>): AlertSummary[] {
    const recentCases = (response.recentCases ?? []) as Array<
      Record<string, unknown>
    >;

    return recentCases.map((caseType) => ({
      priority: caseType.priority as 'High' | 'Medium' | 'Low',
      count: caseType.count as number,
      description: this.getDescription(caseType.priority as string),
    }));
  }

  private mapActiveCases(response: Record<string, unknown>): CaseSummary[] {
    const statusDist = (response.statusDistribution ?? {}) as Record<
      string,
      unknown
    >;

    return [
      {
        status: 'assigned',
        count: (statusDist.assigned ?? 0) as number,
        description: 'cases requiring your action',
      },
      {
        status: 'inProgress',
        count: (statusDist.inProgress ?? 0) as number,
        description: 'cases you are working on',
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
  }

  getDescription(priority: string): string {
    switch (priority) {
      case 'High':
        return 'Breached cases requiring attention';

      case 'Medium':
        return 'Critical/Urgent cases requiring attention';

      case 'Low':
        return 'New cases requiring attention';

      default:
        return `${priority.toLowerCase()} cases requiring attention`;
    }
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
/* eslint-enable @typescript-eslint/class-methods-use-this */
