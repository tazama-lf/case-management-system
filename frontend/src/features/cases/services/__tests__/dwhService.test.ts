import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dwhService } from '../dwhService';
import apiClient from '@/shared/services/apiClient';

vi.mock('@/shared/services/apiClient', () => ({
  default: { get: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);

describe('dwhService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns customer profile on success', async () => {
    const profile = {
      customerDetails: [{ customerId: 'C1', tenantId: 'T1' }],
      address: [{ street: '123 St', city: 'NY', state: 'NY', postalCode: '10001', country: 'US' }],
      accountDetails: { sender: [], receiver: [] },
    };
    mockGet.mockResolvedValue(profile as any);

    const result = await dwhService.getCustomerProfile('txn-1');
    expect(mockGet).toHaveBeenCalledWith('/api/v1/dwh/customer/profile/txn-1');
    expect(result).toEqual(profile);
  });

  it('throws on API error', async () => {
    mockGet.mockRejectedValue(new Error('api fail'));

    await expect(dwhService.getCustomerProfile('txn-2')).rejects.toThrow('api fail');
  });
});
