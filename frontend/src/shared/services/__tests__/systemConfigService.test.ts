import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import systemConfigService from '../systemConfigService';
import apiClient from '../apiClient';

vi.mock('../apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

describe('systemConfigService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('fetches system config successfully', async () => {
    const mockConfig = {
      triageType: 'AI' as const,
      confidenceThreshold: 90,
      interdictionEnabled: true,
    };

    (apiClient.get as vi.Mock).mockResolvedValue(mockConfig);

    const result = await systemConfigService.getSystemConfig();

    expect(result).toEqual(mockConfig);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/config/system');
  });

  it('returns default config on error', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new Error('Failed to fetch');
    (apiClient.get as vi.Mock).mockRejectedValue(error);

    const result = await systemConfigService.getSystemConfig();

    expect(result).toEqual({
      triageType: 'MANUAL',
      confidenceThreshold: 95,
      interdictionEnabled: true,
    });
    expect(consoleSpy).toHaveBeenCalledWith('Failed to fetch system config:', error);

    consoleSpy.mockRestore();
  });

  it('handles network errors gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    (apiClient.get as vi.Mock).mockRejectedValue(new Error('Network error'));

    const result = await systemConfigService.getSystemConfig();

    expect(result.triageType).toBe('MANUAL');
    expect(result.confidenceThreshold).toBe(95);
    expect(result.interdictionEnabled).toBe(true);

    consoleSpy.mockRestore();
  });
});

