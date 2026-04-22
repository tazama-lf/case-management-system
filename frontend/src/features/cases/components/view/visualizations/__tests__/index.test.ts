import { describe, it, expect } from 'vitest';

describe('visualizations index barrel exports', () => {
  it('exports AlertNavigatorTab', async () => {
    const mod = await import('../index');
    expect(mod.AlertNavigatorTab).toBeDefined();
  }, 10000);

  it('exports alertNavigatorService', async () => {
    const mod = await import('../index');
    expect(mod.alertNavigatorService).toBeDefined();
  }, 10000);

  it('exports AlertHistoryTab', async () => {
    const mod = await import('../index');
    expect(mod.AlertHistoryTab).toBeDefined();
  }, 10000);

  it('exports ConditionsTab', async () => {
    const mod = await import('../index');
    expect(mod.ConditionsTab).toBeDefined();
  }, 10000);

  it('exports TransactionDetailsTab', async () => {
    const mod = await import('../index');
    expect(mod.TransactionDetailsTab).toBeDefined();
  }, 10000);

  it('exports TransactionHistoryTab', async () => {
    const mod = await import('../index');
    expect(mod.TransactionHistoryTab).toBeDefined();
  }, 10000);

  it('exports NetworkAnalysisTab', async () => {
    const mod = await import('../index');
    expect(mod.NetworkAnalysisTab).toBeDefined();
  }, 10000);
});
