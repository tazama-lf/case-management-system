import { describe, it, expect } from 'vitest';

describe('dashboard barrel exports', () => {
  it('re-exports all dashboard modules', async () => {
    const dashboardModule = await import('../index');

    expect(dashboardModule).toHaveProperty('Dashboard');
    expect(dashboardModule).toHaveProperty('StatsCard');
    expect(dashboardModule).toHaveProperty('StatsCards');
    expect(dashboardModule).toHaveProperty('DashboardSection');
    expect(dashboardModule).toHaveProperty('AlertSummaryItem');
    expect(dashboardModule).toHaveProperty('CaseSummaryItem');
    expect(dashboardModule).toHaveProperty('useDashboard');
    expect(dashboardModule).toHaveProperty('useDashboardStats');
    expect(dashboardModule).toHaveProperty('dashboardService');
  });
});
