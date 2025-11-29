import { describe, it, expect, vi, beforeEach } from 'vitest';
import { profileService } from '../profileService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

describe('ProfileService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('generates transaction profile', async () => {
    const mockProfile = {
      caseId: 'CASE-123',
      metrics: {
        totalVolume: 100000,
        totalValue: 100000,
        avgTicketSize: 1000,
        crossBorderCount: 5,
      },
    };
    (apiClient.post as vi.Mock).mockResolvedValue(mockProfile);

    const result = await profileService.generateProfile({
      caseId: 'CASE-123',
      notes: 'Test notes',
    });

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/dwh/profile/generate',
      {
        caseId: 'CASE-123',
        notes: 'Test notes',
      },
    );
    expect(result).toEqual(mockProfile);
  });

  it('gets transaction profile', async () => {
    const mockProfile = {
      caseId: 'CASE-123',
      metrics: {
        totalVolume: 100000,
        totalValue: 100000,
        avgTicketSize: 1000,
        crossBorderCount: 5,
      },
    };
    (apiClient.get as vi.Mock).mockResolvedValue(mockProfile);

    const result = await profileService.getProfile('CASE-123');

    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/dwh/profile/CASE-123');
    expect(result).toEqual(mockProfile);
  });

  it('handles errors when generating profile fails', async () => {
    const error = new Error('Failed to generate profile');
    (apiClient.post as vi.Mock).mockRejectedValue(error);

    await expect(
      profileService.generateProfile({ caseId: 'CASE-123' }),
    ).rejects.toThrow();
  });
});

