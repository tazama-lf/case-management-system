import { describe, it, expect } from 'vitest';

describe('alerts components barrel exports', () => {
  it('exports AlertsTable', async () => {
    const mod = await import('../index');
    expect(mod.AlertsTable).toBeDefined();
  }, 10000);

  it('exports AlertsSearchAndFilters', async () => {
    const mod = await import('../index');
    expect(mod.AlertsSearchAndFilters).toBeDefined();
  }, 10000);
});
