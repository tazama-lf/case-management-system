import type { DashboardData, DashboardStats, AlertSummary, CaseSummary } from '../types/dashboard.types';

class DashboardService {

  async getDashboardData(): Promise<DashboardData> {
    try {
      const [stats, recentAlerts, activeCases] = await Promise.all([
        this.getDashboardStats(),
        this.getRecentAlerts(),
        this.getActiveCases()
      ]);

      return {
        stats,
        recentAlerts,
        activeCases
      };
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
      throw new Error('Failed to load dashboard data');
    }
  }

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      return {
        totalAlerts: 42,
        highPriorityAlerts: 8,
        openCases: 12,
        casesResolvedThisWeek: 24
      };
    } catch (error) {
      console.error('Failed to fetch dashboard stats:', error);
      throw new Error('Failed to load dashboard statistics');
    }
  }

  async getRecentAlerts(): Promise<AlertSummary[]> {
    try {
      return [
        {
          priority: 'high',
          count: 8,
          description: 'alerts requiring immediate attention'
        },
        {
          priority: 'medium',
          count: 15,
          description: 'alerts pending review'
        },
        {
          priority: 'low',
          count: 19,
          description: 'alerts for routine checking'
        }
      ];
    } catch (error) {
      console.error('Failed to fetch recent alerts:', error);
      throw new Error('Failed to load recent alerts');
    }
  }

  async getActiveCases(): Promise<CaseSummary[]> {
    try {
      return [
        {
          status: 'assigned',
          count: 5,
          description: 'cases requiring your action'
        },
        {
          status: 'pending',
          count: 3,
          description: 'cases awaiting your approval'
        },
        {
          status: 'closed',
          count: 8,
          description: 'cases resolved in the past week'
        }
      ];
    } catch (error) {
      console.error('Failed to fetch active cases:', error);
      throw new Error('Failed to load active cases');
    }
  }
}

export const dashboardService = new DashboardService();
export default dashboardService;
