import { describe, it, expect } from 'vitest';
import {
  type DashboardStats,
  type AlertSummary,
  type CaseSummary,
  type DashboardData,
} from '../dashboard.types';

describe('dashboard.types', () => {
  describe('DashboardStats', () => {
    it('defines DashboardStats interface', () => {
      const stats: DashboardStats = {
        totalAlerts: 10,
        highPriorityAlerts: 5,
        openCases: 3,
        casesResolvedThisWeek: 7,
      };

      expect(stats.totalAlerts).toBe(10);
      expect(stats.highPriorityAlerts).toBe(5);
      expect(stats.openCases).toBe(3);
      expect(stats.casesResolvedThisWeek).toBe(7);
    });
  });

  describe('AlertSummary', () => {
    it('defines AlertSummary interface with high priority', () => {
      const alert: AlertSummary = {
        priority: 'High',
        count: 5,
        description: 'High priority cases',
      };

      expect(alert.priority).toBe('High');
      expect(alert.count).toBe(5);
      expect(alert.description).toBe('High priority cases');
    });

    it('defines AlertSummary interface with medium priority', () => {
      const alert: AlertSummary = {
        priority: 'Medium',
        count: 3,
        description: 'Medium priority cases',
      };

      expect(alert.priority).toBe('Medium');
    });

    it('defines AlertSummary interface with low priority', () => {
      const alert: AlertSummary = {
        priority: 'Low',
        count: 2,
        description: 'Low priority cases',
      };

      expect(alert.priority).toBe('Low');
    });
  });

  describe('CaseSummary', () => {
    it('defines CaseSummary interface with assigned status', () => {
      const caseSummary: CaseSummary = {
        status: 'assigned',
        count: 5,
        description: 'Assigned cases',
      };

      expect(caseSummary.status).toBe('assigned');
      expect(caseSummary.count).toBe(5);
      expect(caseSummary.description).toBe('Assigned cases');
    });

    it('defines CaseSummary interface with pending status', () => {
      const caseSummary: CaseSummary = {
        status: 'pending',
        count: 3,
        description: 'Pending cases',
      };

      expect(caseSummary.status).toBe('pending');
    });

    it('defines CaseSummary interface with closed status', () => {
      const caseSummary: CaseSummary = {
        status: 'closed',
        count: 8,
        description: 'Closed cases',
      };

      expect(caseSummary.status).toBe('closed');
    });
  });

  describe('DashboardData', () => {
    it('defines DashboardData interface with all properties', () => {
      const dashboardData: DashboardData = {
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
            description: 'High priority cases',
          },
        ],
        activeCases: [
          {
            status: 'assigned',
            count: 3,
            description: 'Assigned cases',
          },
        ],
      };

      expect(dashboardData.stats).toBeDefined();
      expect(dashboardData.recentCases).toBeDefined();
      expect(dashboardData.activeCases).toBeDefined();
      expect(dashboardData.recentCases.length).toBe(1);
      expect(dashboardData.activeCases.length).toBe(1);
    });

    it('supports empty arrays', () => {
      const dashboardData: DashboardData = {
        stats: {
          totalAlerts: 0,
          highPriorityAlerts: 0,
          openCases: 0,
          casesResolvedThisWeek: 0,
        },
        recentCases: [],
        activeCases: [],
      };

      expect(dashboardData.recentCases).toEqual([]);
      expect(dashboardData.activeCases).toEqual([]);
    });
  });
});
