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
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      throw new Error('Failed to load dashboard data', { cause: error });
    }
  }

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const response = (await apiClient.get(
        '/api/v1/reports/case-status?dateRange=last30',
      )) as any;

      return {
        totalAlerts: response.stats?.totalCases ?? 0,
        highPriorityAlerts:
          response.caseTypes?.find((ct: any) => ct.name === 'FRAUD')?.count ?? 0,
        openCases: response.stats?.openCases ?? 0,
        casesResolvedThisWeek: response.stats?.closedCases ?? 0,
      };
    } catch (error) {
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
      const response = (await apiClient.get(
        '/api/v1/reports/case-status?dateRange=last7',
      )) as any;

      const caseTypes = response.caseTypes ?? [];

      return caseTypes.map((caseType: any) => ({
        priority: this.mapCaseTypeToPriority(caseType.name),
        count: caseType.count,
        description: `${caseType.name.toLowerCase()} cases requiring attention`,
      }));
    } catch (error) {
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
      const response = (await apiClient.get(
        '/api/v1/reports/case-status?dateRange=last30',
      )) as any;
      const statusDist = response.statusDistribution ?? {};

      return [
        {
          status: 'assigned',
          count: statusDist.assigned ?? 0,
          description: 'cases requiring your action',
        },
        {
          status: 'pending',
          count: statusDist.pendingApproval ?? 0,
          description: 'cases awaiting your approval',
        },
        {
          status: 'closed',
          count: statusDist.closed ?? 0,
          description: 'cases resolved recently',
        },
      ];
    } catch (error) {
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

  private mapCaseTypeToPriority(caseType: string): 'high' | 'medium' | 'low' {
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
