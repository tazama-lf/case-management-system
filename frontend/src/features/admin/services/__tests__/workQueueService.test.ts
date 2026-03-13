import { describe, it, expect, vi, beforeEach } from 'vitest';
import workQueueService from '../workQueueService';
import apiClient from '@/shared/services/apiClient';

vi.mock('@/shared/services/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

describe('workQueueService', () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── getCandidateGroups ───────────────────────────────────────

  it('fetches candidate groups with default params', async () => {
    const data = [{ id: '1', name: 'Group1', type: 'ROLE' }];
    mockGet.mockResolvedValue(data as any);

    const result = await workQueueService.getCandidateGroups();
    expect(mockGet).toHaveBeenCalledWith(
      expect.stringContaining('/api/v1/workqueue/candidate-groups?'),
    );
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('size=10');
    expect(url).toContain('start=0');
    expect(result).toEqual({ items: data, totalCount: 1 });
  });

  it('fetches candidate groups with custom params', async () => {
    mockGet.mockResolvedValue([] as any);

    await workQueueService.getCandidateGroups({ size: 25, start: 50 });
    const url = mockGet.mock.calls[0][0] as string;
    expect(url).toContain('size=25');
    expect(url).toContain('start=50');
  });

  it('throws with response.data.message on API error', async () => {
    mockGet.mockRejectedValue({
      response: { data: { message: 'forbidden' } },
    });

    await expect(workQueueService.getCandidateGroups()).rejects.toThrow('forbidden');
  });

  it('throws with Error.message on Error', async () => {
    mockGet.mockRejectedValue(new Error('net error'));

    await expect(workQueueService.getCandidateGroups()).rejects.toThrow('net error');
  });

  it('throws generic message for unknown error', async () => {
    mockGet.mockRejectedValue(42);

    await expect(workQueueService.getCandidateGroups()).rejects.toThrow(
      'Failed to get candidate groups',
    );
  });

  // ─── createCandidateGroup ─────────────────────────────────────

  it('creates a candidate group', async () => {
    const payload = { name: 'NewGroup', type: 'ROLE' };
    const resp = { id: '2', ...payload };
    mockPost.mockResolvedValue(resp as any);

    const result = await workQueueService.createCandidateGroup(payload as any);
    expect(mockPost).toHaveBeenCalledWith(
      '/api/v1/workqueue/candidate-group',
      payload,
    );
    expect(result).toEqual(resp);
  });

  it('throws with response.data.message on create error', async () => {
    mockPost.mockRejectedValue({
      response: { data: { message: 'conflict' } },
    });

    await expect(
      workQueueService.createCandidateGroup({ name: 'G', type: 'ROLE' } as any),
    ).rejects.toThrow('conflict');
  });

  it('throws with Error.message on create Error', async () => {
    mockPost.mockRejectedValue(new Error('timeout'));

    await expect(
      workQueueService.createCandidateGroup({ name: 'G', type: 'ROLE' } as any),
    ).rejects.toThrow('timeout');
  });

  it('throws generic for unknown create error', async () => {
    mockPost.mockRejectedValue(null);

    await expect(
      workQueueService.createCandidateGroup({ name: 'G', type: 'ROLE' } as any),
    ).rejects.toThrow('Failed to create candidate group');
  });

  // ─── handleError: response.data without message ───────────────

  it('falls back to operation default when response.data has no message', async () => {
    mockGet.mockRejectedValue({
      response: { data: {} },
    });

    await expect(workQueueService.getCandidateGroups()).rejects.toThrow(
      'Failed to get candidate groups',
    );
  });
});
