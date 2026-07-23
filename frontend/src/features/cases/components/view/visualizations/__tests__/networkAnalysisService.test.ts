import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/services/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

import apiClient from '@/shared/services/apiClient';

// Import after mocking
import { default as NetworkAnalysisService } from '../network-analysis/services/networkAnalysisService';

describe('NetworkAnalysisService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches account network data', async () => {
    const mockResponse = {
      network: { nodes: [], edges: [] },
      accountDetails: { accountId: 'ACC-001' },
    };
    vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

    const result = await NetworkAnalysisService.getAccountNetwork(
      'ACC-001',
      'DEFAULT',
    );
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/lakehouse/network-analysis/account/ACC-001?tenantId=DEFAULT',
    );
    expect(result.accountDetails.accountId).toBe('ACC-001');
  });

  it('throws error when accountId is empty', async () => {
    await expect(NetworkAnalysisService.getAccountNetwork('')).rejects.toThrow(
      'Account ID is required',
    );
  });
});
