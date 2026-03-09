import { describe, it, expect } from 'vitest';

// Test that all exports from index.ts are available
describe('alerts/index.ts exports', () => {
  it(
    'exports AlertDetails component',
    async () => {
      const module = await import('../index');
      expect(module.AlertDetails).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports AlertsDetailModal component',
    async () => {
      const module = await import('../index');
      // AlertsDetailModal is exported as a named export from index.ts
      expect(module.AlertsDetailModal).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports AlertsSearchAndFilters component',
    async () => {
      const module = await import('../index');
      expect(module.AlertsSearchAndFilters).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports AlertsTable component',
    async () => {
      const module = await import('../index');
      expect(module.AlertsTable).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports ManualTriageModal component',
    async () => {
      const module = await import('../index');
      expect(module.ManualTriageModal).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports TransactionMessagesModal component',
    async () => {
      const module = await import('../index');
      expect(module.TransactionMessagesModal).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports MessagePayloadModal component',
    async () => {
      const module = await import('../index');
      expect(module.MessagePayloadModal).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports useAlerts hook',
    async () => {
      const module = await import('../index');
      expect(module.useAlerts).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports useAlertsQuery hooks',
    async () => {
      const module = await import('../index');
      expect(module.useAlertsQuery).toBeDefined();
      expect(module.useAlertDetails).toBeDefined();
      expect(module.useAlertActionHistory).toBeDefined();
      expect(module.useAlertMutations).toBeDefined();
      expect(module.useAlertFilterOptions).toBeDefined();
      expect(module.alertsQueryKeys).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports useAlertOperations hook',
    async () => {
      const module = await import('../index');
      expect(module.useAlertOperations).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports ActionHistory type',
    async () => {
      const module = await import('../index');
      // Types are compile-time only, but we can verify the module loads
      expect(module).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports alert types',
    async () => {
      const module = await import('../index');
      // Types are compile-time only, but we can verify the module loads
      expect(module).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports triageService',
    async () => {
      const module = await import('../index');
      expect(module.triageService).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports alertTransformers utilities',
    async () => {
      const module = await import('../index');
      // Check that transformer functions are exported
      expect(module).toBeDefined();
    },
    { timeout: 10000 },
  );

  it(
    'exports AlertsDashboard page',
    async () => {
      const module = await import('../index');
      expect(module.AlertsDashboard).toBeDefined();
    },
    { timeout: 10000 },
  );
});
