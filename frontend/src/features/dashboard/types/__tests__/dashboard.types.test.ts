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
        priority: 'high',
        count: 5,
        description: 'High priority alerts',
      };

      expect(alert.priority).toBe('high');
      expect(alert.count).toBe(5);
      expect(alert.description).toBe('High priority alerts');
    });

    it('defines AlertSummary interface with medium priority', () => {
      const alert: AlertSummary = {
        priority: 'medium',
        count: 3,
        description: 'Medium priority alerts',
      };

      expect(alert.priority).toBe('medium');
    });

    it('defines AlertSummary interface with low priority', () => {
      const alert: AlertSummary = {
        priority: 'low',
        count: 2,
        description: 'Low priority alerts',
      };

      expect(alert.priority).toBe('low');
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
        recentAlerts: [
          {
            priority: 'high',
            count: 5,
            description: 'High priority alerts',
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
      expect(dashboardData.recentAlerts).toBeDefined();
      expect(dashboardData.activeCases).toBeDefined();
      expect(dashboardData.recentAlerts.length).toBe(1);
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
        recentAlerts: [],
        activeCases: [],
      };

      expect(dashboardData.recentAlerts).toEqual([]);
      expect(dashboardData.activeCases).toEqual([]);
    });
  });
});
