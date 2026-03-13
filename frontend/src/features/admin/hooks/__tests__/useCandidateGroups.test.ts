import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useCandidateGroups } from '../useCandidateGroups';
import workQueueService from '@/features/admin/services/workQueueService';

vi.mock('@/features/admin/services/workQueueService', () => ({
  default: {
    getCandidateGroups: vi.fn(),
  },
}));

const mockGetCandidateGroups = vi.mocked(workQueueService.getCandidateGroups);

describe('useCandidateGroups', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCandidateGroups.mockResolvedValue({
      items: [],
      totalCount: 0,
    });
  });

  it('fetches candidate groups on mount', async () => {
    const items = [
      { id: '1', name: 'Group1', type: 'ROLE' },
      { id: '2', name: 'Group2', type: 'ROLE' },
    ];
    mockGetCandidateGroups.mockResolvedValue({ items, totalCount: 2 });

    const { result } = renderHook(() => useCandidateGroups());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workQueues).toHaveLength(2);
    expect(result.current.workQueues[0]).toEqual({ id: '1', name: 'Group1', type: 'ROLE' });
    expect(result.current.pagination.totalItems).toBe(2);
    expect(result.current.error).toBeNull();
  });

  it('uses default params (page 1, size 10)', async () => {
    const { result } = renderHook(() => useCandidateGroups());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetCandidateGroups).toHaveBeenCalledWith({ size: 10, start: 0 });
  });

  it('uses custom initial params', async () => {
    const { result } = renderHook(() =>
      useCandidateGroups({ currentPage: 2, pageSize: 25 }),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(mockGetCandidateGroups).toHaveBeenCalledWith({ size: 25, start: 25 });
  });

  it('sets error on fetch failure with Error', async () => {
    mockGetCandidateGroups.mockRejectedValue(new Error('boom'));

    const { result } = renderHook(() => useCandidateGroups());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('boom');
    expect(result.current.workQueues).toEqual([]);
  });

  it('sets generic error for non-Error', async () => {
    mockGetCandidateGroups.mockRejectedValue('string-error');

    const { result } = renderHook(() => useCandidateGroups());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('Failed to fetch candidate groups');
  });

  it('onPageChange updates current page and refetches', async () => {
    const { result } = renderHook(() => useCandidateGroups());

    await waitFor(() => expect(result.current.loading).toBe(false));

    mockGetCandidateGroups.mockClear();
    act(() => result.current.onPageChange(3));

    await waitFor(() => {
      expect(mockGetCandidateGroups).toHaveBeenCalledWith({ size: 10, start: 20 });
    });

    expect(result.current.pagination.currentPage).toBe(3);
  });

  it('onPageSizeChange resets to page 1 and refetches', async () => {
    const { result } = renderHook(() => useCandidateGroups());

    await waitFor(() => expect(result.current.loading).toBe(false));

    mockGetCandidateGroups.mockClear();
    act(() => result.current.onPageSizeChange(50));

    await waitFor(() => {
      expect(mockGetCandidateGroups).toHaveBeenCalledWith({ size: 50, start: 0 });
    });

    expect(result.current.pagination.pageSize).toBe(50);
    expect(result.current.pagination.currentPage).toBe(1);
  });

  it('refetch re-fetches data', async () => {
    const { result } = renderHook(() => useCandidateGroups());

    await waitFor(() => expect(result.current.loading).toBe(false));

    const callCount = mockGetCandidateGroups.mock.calls.length;
    await act(async () => { await result.current.refetch(); });

    expect(mockGetCandidateGroups.mock.calls.length).toBeGreaterThan(callCount);
  });

  it('calculates totalPages correctly', async () => {
    mockGetCandidateGroups.mockResolvedValue({
      items: Array(10).fill({ id: '1', name: 'G', type: 'R' }),
      totalCount: 25,
    });

    const { result } = renderHook(() => useCandidateGroups());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.pagination.totalPages).toBe(3); // ceil(25/10)
  });
});
