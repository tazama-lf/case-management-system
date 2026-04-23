import { describe, it, expect, vi, beforeEach } from 'vitest';
import transactionDetailsService from '../transactiondetails/services/service';

vi.mock('@/shared/services/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

import apiClient from '@/shared/services/apiClient';

describe('TransactionDetailsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches transaction details', async () => {
    const mockResponse = {
      transactionId: 'TXN-001',
      amount: 5000,
      currency: 'USD',
    };
    vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

    const result = await transactionDetailsService.getTransactionDetails(
      'TXN-001',
      'DEFAULT',
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/lakehouse/transaction-detail/TXN-001?tenantId=DEFAULT',
    );
    expect(result.transactionId).toBe('TXN-001');
  });

  it('throws error when transactionId is empty', async () => {
    await expect(
      transactionDetailsService.getTransactionDetails('', 'DEFAULT'),
    ).rejects.toThrow('Transaction ID is required');
  });
});
