import { describe, it, expect, vi, beforeEach } from 'vitest';
import { profileService } from '../profileService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

describe('ProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Set up localStorage with valid user/tenantId
    localStorage.setItem('user', JSON.stringify({ tenantId: 'tenant-1' }));
  });

  it('generates transaction profile with alertId', async () => {
    const mockProfile = { alertId: 123, data: {} };
    (apiClient.post as vi.Mock).mockResolvedValue(mockProfile);

    const result = await profileService.generateProfile(123);

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/lakehouse/profile/generate/123',
      expect.objectContaining({ tenantId: 'tenant-1' }),
    );
    expect(result).toEqual(mockProfile);
  });

  it('rejects when alertId is missing', async () => {
    await expect(profileService.generateProfile(0)).rejects.toThrow(
      'Alert ID is required',
    );
  });

  it('handles errors when generating profile fails', async () => {
    (apiClient.post as vi.Mock).mockRejectedValue(new Error('Network error'));

    await expect(profileService.generateProfile(123)).rejects.toThrow(
      'Failed to generate transaction profile',
    );
  });
});
