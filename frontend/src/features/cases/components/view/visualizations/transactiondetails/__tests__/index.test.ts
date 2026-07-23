import { describe, it, expect } from 'vitest';

describe('transactiondetails barrel exports', () => {
  it('exports TransactionOverview', async () => {
    const mod = await import('../index');
    expect(mod.TransactionOverview).toBeDefined();
  }, 10000);

  it('exports TransactionParty', async () => {
    const mod = await import('../index');
    expect(mod.TransactionParty).toBeDefined();
  }, 10000);
});
