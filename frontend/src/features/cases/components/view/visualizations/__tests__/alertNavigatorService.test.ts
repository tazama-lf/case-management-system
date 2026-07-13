import { describe, it, expect, vi, beforeEach } from 'vitest';
import alertNavigatorService from '../alertnavigator/services';

vi.mock('@/shared/services/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

import apiClient from '@/shared/services/apiClient';

describe('AlertNavigatorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches alert navigator data', async () => {
    const mockResponse = {
      alertId: 1,
      score: 85,
      typologies: [{ typologyId: 'typ-1', name: 'ML', score: 90, rules: '[]' }],
    };
    vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

    const result = await alertNavigatorService.getAlertNavigator(1, 'DEFAULT');
    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/lakehouse/alert-navigator/1?tenantId=DEFAULT',
    );
    expect(result.typologies[0].rules).toEqual([]);
  });

  it('handles rules already as array', async () => {
    const mockResponse = {
      alertId: 1,
      typologies: [
        {
          typologyId: 'typ-1',
          name: 'ML',
          score: 90,
          flowProcessorData: 'Block',
          rules: [{ ruleId: 'r1', name: 'Rule 1', data: 'Rule data' }],
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

    const result = await alertNavigatorService.getAlertNavigator(1, 'T1');
    expect(result.typologies[0].rules).toEqual([
      { ruleId: 'r1', name: 'Rule 1', data: 'Rule data' },
    ]);
    expect(result.typologies[0].flowProcessorData).toBe('Block');
  });

  it('handles an empty typologies array', async () => {
    const mockResponse = {
      alertId: 2,
      typologies: [],
    };
    vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

    const result = await alertNavigatorService.getAlertNavigator(2, 'DEFAULT');

    expect(result.typologies).toEqual([]);
  });

  it('parses rules independently across multiple typologies', async () => {
    const mockResponse = {
      alertId: 3,
      typologies: [
        {
          typologyId: 'typ-1',
          name: 'ML',
          score: 90,
          rules: '[{"ruleId":"r1"}]',
        },
        {
          typologyId: 'typ-2',
          name: 'Fraud',
          score: 70,
          rules: [{ ruleId: 'r2', name: 'Rule 2' }],
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

    const result = await alertNavigatorService.getAlertNavigator(3, 'DEFAULT');

    expect(result.typologies[0].rules).toEqual([{ ruleId: 'r1' }]);
    expect(result.typologies[1].rules).toEqual([
      { ruleId: 'r2', name: 'Rule 2' },
    ]);
  });

  it('preserves other response fields untouched', async () => {
    const mockResponse = {
      alertMetadata: { alertId: 4, transactionId: 'txn-1' },
      statistics: { totalTypologies: 1, totalRules: 1 },
      meta: { alertId: 4, tenantId: 'DEFAULT' },
      typologies: [{ typologyId: 'typ-1', rules: '[]' }],
    };
    vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

    const result = await alertNavigatorService.getAlertNavigator(4, 'DEFAULT');

    expect(result.alertMetadata).toEqual(mockResponse.alertMetadata);
    expect(result.statistics).toEqual(mockResponse.statistics);
    expect(result.meta).toEqual(mockResponse.meta);
  });

  it('builds the request URL from alertId and tenantId', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      typologies: [],
    });

    await alertNavigatorService.getAlertNavigator(42, 'TENANT_X');

    expect(apiClient.get).toHaveBeenCalledWith(
      '/api/v1/lakehouse/alert-navigator/42?tenantId=TENANT_X',
    );
  });

  it('propagates errors when the API call fails', async () => {
    const error = new Error('Network error');
    vi.mocked(apiClient.get).mockRejectedValue(error);

    await expect(
      alertNavigatorService.getAlertNavigator(1, 'DEFAULT'),
    ).rejects.toThrow('Network error');
  });

  it('propagates errors when rules JSON is malformed', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      typologies: [{ typologyId: 'typ-1', rules: '{invalid-json' }],
    });

    await expect(
      alertNavigatorService.getAlertNavigator(1, 'DEFAULT'),
    ).rejects.toThrow();
  });
});
