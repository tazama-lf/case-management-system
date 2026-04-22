import { describe, it, expect } from 'vitest';

describe('admin barrel exports', () => {
  it('exports DashboardSection', async () => {
    const mod = await import('../index');
    expect(mod.DashboardSection).toBeDefined();
  }, 10000);

  it('exports WorkQueueManagement', async () => {
    const mod = await import('../index');
    expect(mod.WorkQueueManagement).toBeDefined();
  }, 10000);

  it('exports AdminDashboard', async () => {
    const mod = await import('../index');
    expect(mod.AdminDashboard).toBeDefined();
  }, 10000);
});
