import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCandidateGroups } from '../useCandidateGroups';
import workQueueService from '../../services/workQueueService';

vi.mock('../../services/workQueueService', () => ({
  default: { getCandidateGroups: vi.fn() },
}));

const mockGetCandidateGroups = vi.mocked(workQueueService.getCandidateGroups);

describe('useCandidateGroups', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches and returns candidate groups on mount', async () => {
    mockGetCandidateGroups.mockResolvedValueOnce({
      items: [{ id: '1', name: 'AML Queue', type: 'FRAUD' }],
      totalCount: 1,
    });

    const { result } = renderHook(() => useCandidateGroups());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.workQueues).toHaveLength(1);
    expect(result.current.workQueues[0].name).toBe('AML Queue');
    expect(result.current.error).toBeNull();
  });

  it('sets error when fetch fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetCandidateGroups.mockRejectedValueOnce(new Error('API down'));

    const { result } = renderHook(() => useCandidateGroups());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('API down');
    expect(result.current.workQueues).toHaveLength(0);
    consoleSpy.mockRestore();
  });

  it('uses default pagination (page 1, size 10)', async () => {
    mockGetCandidateGroups.mockResolvedValueOnce({ items: [], totalCount: 0 });

    renderHook(() => useCandidateGroups());

    await waitFor(() =>
      expect(mockGetCandidateGroups).toHaveBeenCalledWith({
        size: 10,
        start: 0,
      }),
    );
  });

  it('respects custom pageSize param', async () => {
    mockGetCandidateGroups.mockResolvedValueOnce({ items: [], totalCount: 0 });

    renderHook(() => useCandidateGroups({ pageSize: 25 }));

    await waitFor(() =>
      expect(mockGetCandidateGroups).toHaveBeenCalledWith({
        size: 25,
        start: 0,
      }),
    );
  });

  it('refetches when onPageChange is called', async () => {
    mockGetCandidateGroups
      .mockResolvedValueOnce({ items: [], totalCount: 20 })
      .mockResolvedValueOnce({
        items: [{ id: '2', name: 'Q2', type: 'AML' }],
        totalCount: 20,
      });

    const { result } = renderHook(() => useCandidateGroups());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.onPageChange(2));

    await waitFor(() =>
      expect(mockGetCandidateGroups).toHaveBeenCalledWith({
        size: 10,
        start: 10,
      }),
    );
  });

  it('resets to page 1 on onPageSizeChange', async () => {
    mockGetCandidateGroups.mockResolvedValue({ items: [], totalCount: 0 });

    const { result } = renderHook(() => useCandidateGroups({ currentPage: 2 }));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.onPageSizeChange(50));

    await waitFor(() =>
      expect(mockGetCandidateGroups).toHaveBeenCalledWith({
        size: 50,
        start: 0,
      }),
    );
  });

  it('calculates totalPages correctly', async () => {
    mockGetCandidateGroups.mockResolvedValueOnce({ items: [], totalCount: 25 });

    const { result } = renderHook(() => useCandidateGroups({ pageSize: 10 }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.pagination.totalPages).toBe(3);
  });
});
