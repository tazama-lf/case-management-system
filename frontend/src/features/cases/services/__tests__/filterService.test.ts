import { describe, it, expect, vi, beforeEach } from 'vitest';
import { filterService } from '../filterService';
import apiClient from '@/shared/services/apiClient';

vi.mock('@/shared/services/apiClient', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);
const mockPost = vi.mocked(apiClient.post);

describe('FilterService', () => {
  beforeEach(() => vi.clearAllMocks());

  // ─── getFilters ───────────────────────────────────────────────

  it('returns filters array on success', async () => {
    const filters = [{ filter_Id: 1, user_id: 'u1', filter_type: 'ALERT' }];
    mockGet.mockResolvedValue(filters as any);

    const result = await filterService.getFilters('u1', 'ALERT');
    expect(mockGet).toHaveBeenCalledWith('/api/v1/filter/user/u1/filterType/ALERT');
    expect(result).toEqual(filters);
  });

  it('returns empty array when response is not an array', async () => {
    mockGet.mockResolvedValue({ not: 'array' } as any);

    const result = await filterService.getFilters('u1', 'ALERT');
    expect(result).toEqual([]);
  });

  it('throws with response.data.message on error', async () => {
    mockGet.mockRejectedValue({
      response: { data: { message: 'forbidden' } },
    });

    await expect(filterService.getFilters('u1', 'ALERT')).rejects.toThrow('forbidden');
  });

  it('throws with Error.message', async () => {
    mockGet.mockRejectedValue(new Error('network'));

    await expect(filterService.getFilters('u1', 'ALERT')).rejects.toThrow(
      'Failed to get user defined filter failed: network',
    );
  });

  it('throws generic for unknown error', async () => {
    mockGet.mockRejectedValue(42);

    await expect(filterService.getFilters('u1', 'ALERT')).rejects.toThrow(
      'Failed to get user defined filter failed',
    );
  });

  // ─── createFilter ─────────────────────────────────────────────

  it('creates a filter and validates response', async () => {
    const filter = { filter_Id: 1, user_id: 'u1', filter_type: 'CASE' };
    mockPost.mockResolvedValue(filter as any);

    const result = await filterService.createFilter({
      user_id: 'u1',
      userFilters: '{}',
      filterType: 'CASE',
    });
    expect(mockPost).toHaveBeenCalledWith('/api/v1/filter/create', expect.any(Object));
    expect(result).toEqual(filter);
  });

  it('throws FILTER_ALREADY_EXISTS on 409 conflict', async () => {
    mockPost.mockRejectedValue({
      response: { status: 409, data: { message: 'duplicate' } },
    });

    await expect(
      filterService.createFilter({ userFilters: '{}', filterType: 'CASE' }),
    ).rejects.toThrow('FILTER_ALREADY_EXISTS');
  });

  it('throws with response.data.message on non-409 error', async () => {
    mockPost.mockRejectedValue({
      response: { status: 500, data: { message: 'server error' } },
    });

    await expect(
      filterService.createFilter({ userFilters: '{}', filterType: 'CASE' }),
    ).rejects.toThrow('server error');
  });

  it('throws generic for unknown create error', async () => {
    mockPost.mockRejectedValue(null);

    await expect(
      filterService.createFilter({ userFilters: '{}', filterType: 'CASE' }),
    ).rejects.toThrow('Failed to create filter');
  });

  // ─── validateFilterResponse ───────────────────────────────────

  it('throws for null/non-object filter response', async () => {
    mockPost.mockResolvedValue(null as any);

    await expect(
      filterService.createFilter({ userFilters: '{}', filterType: 'CASE' }),
    ).rejects.toThrow('Invalid filter data received');
  });

  it('returns data when filter_Id is present', async () => {
    const filter = { filter_Id: 5 };
    mockPost.mockResolvedValue(filter as any);

    const result = await filterService.createFilter({ userFilters: '{}', filterType: 'X' });
    expect(result.filter_Id).toBe(5);
  });

  it('returns data even without filter_Id (fallthrough)', async () => {
    const filter = { user_id: 'u1' };
    mockPost.mockResolvedValue(filter as any);

    const result = await filterService.createFilter({ userFilters: '{}', filterType: 'X' });
    expect(result).toEqual(filter);
  });
});
