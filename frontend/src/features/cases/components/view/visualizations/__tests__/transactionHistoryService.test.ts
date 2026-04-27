import { describe, it, expect, vi, beforeEach } from 'vitest';
import transactionHistoryService from '../transactionhistory/services/service';

vi.mock('@/shared/services/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

import apiClient from '@/shared/services/apiClient';

describe('TransactionHistoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches transaction history', async () => {
    const mockResponse = { transactions: [], summary: {} };
    vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

    const result = await transactionHistoryService.getTransactionHistory(
      'ENT-001',
      'DEFAULT',
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/lakehouse/transaction-history/ENT-001?tenantId=DEFAULT',
    );
    expect(result).toEqual(mockResponse);
  });

  it('throws error when entityId is empty', async () => {
    await expect(
      transactionHistoryService.getTransactionHistory(''),
    ).rejects.toThrow('Entity ID is required');
  });

  it('uses default tenantId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({});
    await transactionHistoryService.getTransactionHistory('ENT-001');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/lakehouse/transaction-history/ENT-001?tenantId=DEFAULT',
    );
  });
});
