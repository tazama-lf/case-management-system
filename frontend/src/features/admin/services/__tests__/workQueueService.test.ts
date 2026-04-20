import workQueueService from '../workQueueService';
import apiClient from '@/shared/services/apiClient';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockApi = apiClient as unknown as {
  get: vi.Mock;
  post: vi.Mock;
};

describe('workQueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getCandidateGroups', () => {
    it('fetches candidate groups with default params', async () => {
      const mockGroups = [{ id: '1', name: 'AML Group' }];
      mockApi.get.mockResolvedValueOnce(mockGroups);

      const result = await workQueueService.getCandidateGroups();

      expect(mockApi.get).toHaveBeenCalledWith(
        '/api/v1/workqueue/candidate-groups?size=10&start=0',
      );
      expect(result).toEqual({ items: mockGroups, totalCount: 1 });
    });

    it('fetches candidate groups with custom params', async () => {
      const mockGroups = [{ id: '1', name: 'AML Group' }, { id: '2', name: 'FRAUD Group' }];
      mockApi.get.mockResolvedValueOnce(mockGroups);

      const result = await workQueueService.getCandidateGroups({ size: 25, start: 10 });

      expect(mockApi.get).toHaveBeenCalledWith(
        '/api/v1/workqueue/candidate-groups?size=25&start=10',
      );
      expect(result.totalCount).toBe(2);
    });

    it('throws a formatted error when the API call fails', async () => {
      mockApi.get.mockRejectedValueOnce(new Error('Network failure'));

      await expect(workQueueService.getCandidateGroups()).rejects.toThrow(
        'Network failure',
      );
    });

    it('throws with response data message when available', async () => {
      const apiError = { response: { data: { message: 'Unauthorized' } } };
      mockApi.get.mockRejectedValueOnce(apiError);

      await expect(workQueueService.getCandidateGroups()).rejects.toThrow(
        'Unauthorized',
      );
    });

    it('throws a generic message when error has no message', async () => {
      mockApi.get.mockRejectedValueOnce({});

      await expect(workQueueService.getCandidateGroups()).rejects.toThrow(
        'Failed to get candidate groups',
      );
    });
  });

  describe('createCandidateGroup', () => {
    it('posts a new candidate group and returns it', async () => {
      const payload = { name: 'AML Queue', type: 'FRAUD' };
      mockApi.post.mockResolvedValueOnce(payload);

      const result = await workQueueService.createCandidateGroup(payload as any);

      expect(mockApi.post).toHaveBeenCalledWith(
        '/api/v1/workqueue/candidate-group',
        payload,
      );
      expect(result).toEqual(payload);
    });

    it('throws a formatted error when creation fails', async () => {
      mockApi.post.mockRejectedValueOnce(new Error('Conflict'));

      await expect(
        workQueueService.createCandidateGroup({ name: 'X' } as any),
      ).rejects.toThrow('Conflict');
    });
  });
});
