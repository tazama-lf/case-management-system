import { describe, it, expect } from 'vitest';
import * as TransactionHistoryExports from '../index';

describe('transactionhistory barrel exports', () => {
  it('exports BenfordsAnalysis', () => {
    expect(TransactionHistoryExports.BenfordsAnalysis).toBeDefined();
  });

  it('exports TransactionHistoryCharts', () => {
    expect(TransactionHistoryExports.TransactionHistoryCharts).toBeDefined();
  });
});
