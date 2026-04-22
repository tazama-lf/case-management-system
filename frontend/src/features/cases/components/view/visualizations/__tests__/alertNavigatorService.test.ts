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
          rules: [{ ruleId: 'r1', name: 'Rule 1' }],
        },
      ],
    };
    vi.mocked(apiClient.get).mockResolvedValue(mockResponse);

    const result = await alertNavigatorService.getAlertNavigator(1, 'T1');
    expect(result.typologies[0].rules).toEqual([
      { ruleId: 'r1', name: 'Rule 1' },
    ]);
  });
});
