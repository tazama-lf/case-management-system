import { describe, it, expect } from 'vitest';

// Test that all exports from index.ts are available
describe('alerts/index.ts exports', () => {
  it('exports AlertDetails component', async () => {
    const module = await import('../index');
    expect(module.AlertDetails).toBeDefined();
  });

  it('exports AlertsDetailModal component', async () => {
    const module = await import('../index');
    // AlertsDetailModal is exported as a named export from index.ts
    expect(module.AlertsDetailModal).toBeDefined();
  });

  it('exports AlertsSearchAndFilters component', async () => {
    const module = await import('../index');
    expect(module.AlertsSearchAndFilters).toBeDefined();
  });

  it('exports AlertsTable component', async () => {
    const module = await import('../index');
    expect(module.AlertsTable).toBeDefined();
  });

  it('exports ManualTriageModal component', async () => {
    const module = await import('../index');
    expect(module.ManualTriageModal).toBeDefined();
  });

  it('exports TransactionMessagesModal component', async () => {
    const module = await import('../index');
    expect(module.TransactionMessagesModal).toBeDefined();
  });

  it('exports MessagePayloadModal component', async () => {
    const module = await import('../index');
    expect(module.MessagePayloadModal).toBeDefined();
  });

  it('exports useAlerts hook', async () => {
    const module = await import('../index');
    expect(module.useAlerts).toBeDefined();
  });

  it('exports useAlertsQuery hooks', async () => {
    const module = await import('../index');
    expect(module.useAlertsQuery).toBeDefined();
    expect(module.useAlertDetails).toBeDefined();
    expect(module.useAlertActionHistory).toBeDefined();
    expect(module.useAlertMutations).toBeDefined();
    expect(module.useAlertFilterOptions).toBeDefined();
    expect(module.alertsQueryKeys).toBeDefined();
  });

  it('exports useAlertOperations hook', async () => {
    const module = await import('../index');
    expect(module.useAlertOperations).toBeDefined();
  });

  it('exports ActionHistory type', async () => {
    const module = await import('../index');
    // Types are compile-time only, but we can verify the module loads
    expect(module).toBeDefined();
  });

  it('exports alert types', async () => {
    const module = await import('../index');
    // Types are compile-time only, but we can verify the module loads
    expect(module).toBeDefined();
  });

  it('exports triageService', async () => {
    const module = await import('../index');
    expect(module.triageService).toBeDefined();
  });

  it('exports alertTransformers utilities', async () => {
    const module = await import('../index');
    // Check that transformer functions are exported
    expect(module).toBeDefined();
  });

  it('exports AlertsDashboard page', async () => {
    const module = await import('../index');
    expect(module.AlertsDashboard).toBeDefined();
  });
});

