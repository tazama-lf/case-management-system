import { describe, it, expect } from 'vitest';

// Test that all exports from index.ts are available
describe('cases/components/dashboard/index.ts exports', () => {
  it('exports CaseFilters component', async () => {
    const module = await import('../index');
    expect(module.CaseFilters).toBeDefined();
  });

  it('exports CaseModals component', async () => {
    const module = await import('../index');
    expect(module.CaseModals).toBeDefined();
  });

  it('exports DashboardHeader component', async () => {
    const module = await import('../index');
    expect(module.DashboardHeader).toBeDefined();
  });
});
