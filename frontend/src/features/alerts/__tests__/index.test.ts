import { describe, it, expect } from 'vitest';
import * as module from '../index';

describe('alerts/index.ts exports', () => {
  it('exports AlertDetails component', () => {
    expect(module.AlertDetails).toBeDefined();
  });

  it('exports AlertsDetailModal component', () => {
    expect(module.AlertsDetailModal).toBeDefined();
  });

  it('exports AlertsSearchAndFilters component', () => {
    expect(module.AlertsSearchAndFilters).toBeDefined();
  });

  it('exports AlertsTable component', () => {
    expect(module.AlertsTable).toBeDefined();
  });

  it('exports ManualTriageModal component', () => {
    expect(module.ManualTriageModal).toBeDefined();
  });

  it('exports TransactionMessagesModal component', () => {
    expect(module.TransactionMessagesModal).toBeDefined();
  });

  it('exports MessagePayloadModal component', () => {
    expect(module.MessagePayloadModal).toBeDefined();
  });

  it('exports hooks/services', () => {
    expect(module.useAlerts).toBeDefined();
    expect(module.useAlertsQuery).toBeDefined();
    expect(module.useAlertDetails).toBeDefined();
    expect(module.useAlertActionHistory).toBeDefined();
    expect(module.useAlertMutations).toBeDefined();
    expect(module.useAlertFilterOptions).toBeDefined();
    expect(module.alertsQueryKeys).toBeDefined();
    expect(module.useAlertOperations).toBeDefined();
    expect(module.triageService).toBeDefined();
  });

  it('exports AlertsDashboard page', () => {
    expect(module.AlertsDashboard).toBeDefined();
  });
});