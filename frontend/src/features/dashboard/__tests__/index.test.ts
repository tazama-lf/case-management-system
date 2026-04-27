import { describe, it, expect } from 'vitest';

describe('dashboard index barrel exports', () => {
  it('exports Dashboard', async () => {
    const mod = await import('../index');
    expect(mod.Dashboard).toBeDefined();
  });

  it('exports StatsCard', async () => {
    const mod = await import('../index');
    expect(mod.StatsCard).toBeDefined();
  });

  it('exports StatsCards', async () => {
    const mod = await import('../index');
    expect(mod.StatsCards).toBeDefined();
  });

  it('exports DashboardSection', async () => {
    const mod = await import('../index');
    expect(mod.DashboardSection).toBeDefined();
  });

  it('exports AlertSummaryItem', async () => {
    const mod = await import('../index');
    expect(mod.AlertSummaryItem).toBeDefined();
  });

  it('exports CaseSummaryItem', async () => {
    const mod = await import('../index');
    expect(mod.CaseSummaryItem).toBeDefined();
  });

  it('exports useDashboard hook', async () => {
    const mod = await import('../index');
    expect(mod.useDashboard).toBeDefined();
  });

  it('exports useDashboardStats hook', async () => {
    const mod = await import('../index');
    expect(mod.useDashboardStats).toBeDefined();
  });

  it('exports dashboardService', async () => {
    const mod = await import('../index');
    expect(mod.dashboardService).toBeDefined();
  });
});
