import { describe, it, expect, vi, beforeEach } from 'vitest';
import referenceIdService from '../referenceIdService';
import apiClient from '@/shared/services/apiClient';

vi.mock('@/shared/services/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

describe('referenceIdService', () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── getReferenceIds ──────────────────────────────────────────

  it('returns items and totalCount on success', async () => {
    const data = [{ txTp: 'A', referenceIdName: 'R1' }];
    mockGet.mockResolvedValue(data as any);

    const result = await referenceIdService.getReferenceIds();
    expect(mockGet).toHaveBeenCalledWith('/admin/referencesIds/all');
    expect(result).toEqual({ items: data, totalCount: 1 });
  });

  it('throws with response.data.message on API error', async () => {
    mockGet.mockRejectedValue({
      response: { data: { message: 'server error' } },
    });

    await expect(referenceIdService.getReferenceIds()).rejects.toThrow('server error');
  });

  it('throws with Error.message when Error is thrown', async () => {
    mockGet.mockRejectedValue(new Error('network fail'));

    await expect(referenceIdService.getReferenceIds()).rejects.toThrow('network fail');
  });

  it('throws generic message for unknown error shape', async () => {
    mockGet.mockRejectedValue(42);

    await expect(referenceIdService.getReferenceIds()).rejects.toThrow('Failed to get reference ids');
  });

  // ─── createReferenceIds ───────────────────────────────────────

  it('creates a reference id', async () => {
    const payload = { txTp: 'pacs.008', referenceIdName: 'REF-1' };
    const response = { items: [payload], totalCount: 1 };
    mockPost.mockResolvedValue(response as any);

    const result = await referenceIdService.createReferenceIds(payload);
    expect(mockPost).toHaveBeenCalledWith('/admin/reference-id', payload);
    expect(result).toEqual(response);
  });

  it('throws with response.data.message on create error', async () => {
    mockPost.mockRejectedValue({
      response: { data: { message: 'duplicate' } },
    });

    await expect(
      referenceIdService.createReferenceIds({ txTp: 'a', referenceIdName: 'b' }),
    ).rejects.toThrow('duplicate');
  });

  it('throws with Error.message on create Error', async () => {
    mockPost.mockRejectedValue(new Error('timeout'));

    await expect(
      referenceIdService.createReferenceIds({ txTp: 'a', referenceIdName: 'b' }),
    ).rejects.toThrow('timeout');
  });

  it('throws generic message for unknown create error', async () => {
    mockPost.mockRejectedValue(null);

    await expect(
      referenceIdService.createReferenceIds({ txTp: 'a', referenceIdName: 'b' }),
    ).rejects.toThrow('Failed to create reference id');
  });

  // ─── handleError: response.data without message ───────────────

  it('falls back to operation message when response.data has no message', async () => {
    mockGet.mockRejectedValue({
      response: { data: {} },
    });

    await expect(referenceIdService.getReferenceIds()).rejects.toThrow(
      'Failed to get reference ids',
    );
  });
});
