import { describe, it, expect, vi, beforeEach } from 'vitest';
import { investigatorService } from '../investigatorService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);

describe('investigatorService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  describe('getBlockedUserIds', () => {
    it('returns the blocked user ids for the case', async () => {
      mockGet.mockResolvedValueOnce({ userIds: ['u1', 'u2'] });

      await expect(investigatorService.getBlockedUserIds(42)).resolves.toEqual([
        'u1',
        'u2',
      ]);
      expect(mockGet).toHaveBeenCalledWith('/api/v1/cases/42/blocked-users');
    });

    it.each([null, undefined, {}, { userIds: 'nope' }])(
      'returns an empty list for a malformed response (%p)',
      async (response) => {
        mockGet.mockResolvedValueOnce(response as never);

        await expect(
          investigatorService.getBlockedUserIds(42),
        ).resolves.toEqual([]);
      },
    );

    it('never throws: a failed request just means the dropdown is not filtered (the backend still refuses a blocked user)', async () => {
      mockGet.mockRejectedValueOnce(new Error('network down'));

      await expect(investigatorService.getBlockedUserIds(42)).resolves.toEqual(
        [],
      );
    });
  });

  describe('getCaseAccessHistory', () => {
    it('returns revoked and unblocked entries', async () => {
      mockGet.mockResolvedValueOnce({
        revoked: [{ id: 1 }],
        unblocked: [{ id: 2 }],
      });

      await expect(
        investigatorService.getCaseAccessHistory(42),
      ).resolves.toEqual({
        revoked: [{ id: 1 }],
        unblocked: [{ id: 2 }],
      });
      expect(mockGet).toHaveBeenCalledWith(
        '/api/v1/cases/42/investigators/history',
      );
    });

    it('normalises a missing or malformed response to empty lists', async () => {
      mockGet.mockResolvedValueOnce(null);

      await expect(
        investigatorService.getCaseAccessHistory(42),
      ).resolves.toEqual({
        revoked: [],
        unblocked: [],
      });
    });

    it('throws on a request failure so the tab can show its error state', async () => {
      mockGet.mockRejectedValueOnce(new Error('boom'));

      await expect(
        investigatorService.getCaseAccessHistory(42),
      ).rejects.toThrow('boom');
    });
  });

  describe('getCaseInvestigators / getCaseBlacklist', () => {
    it('return an empty list when the response is not an array', async () => {
      mockGet
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({ not: 'an array' });

      await expect(
        investigatorService.getCaseInvestigators(42),
      ).resolves.toEqual([]);
      await expect(investigatorService.getCaseBlacklist(42)).resolves.toEqual(
        [],
      );
    });
  });
});
