import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReferenceLookup } from '../useReferences';
import referenceIdService from '@/features/admin/services/referenceIdService';

vi.mock('@/features/admin/services/referenceIdService', () => ({
  default: {
    getReferenceIds: vi.fn(),
    createReferenceIds: vi.fn(),
  },
}));

const toastMock = { success: vi.fn(), error: vi.fn() };
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => toastMock,
}));

const mockGetRefs = vi.mocked(referenceIdService.getReferenceIds);
const mockCreateRef = vi.mocked(referenceIdService.createReferenceIds);

describe('useReferenceLookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRefs.mockResolvedValue({ items: [], totalCount: 0 });
  });

  it('fetches references on mount', async () => {
    const items = [{ txTp: 'A', referenceIdName: 'R1' }];
    mockGetRefs.mockResolvedValue({ items, totalCount: 1 } as any);

    const { result } = renderHook(() => useReferenceLookup());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.results).toEqual(items);
    expect(result.current.pagination.totalItems).toBe(1);
  });

  it('shows error toast on fetch failure with Error', async () => {
    mockGetRefs.mockRejectedValue(new Error('fetch fail'));

    const { result } = renderHook(() => useReferenceLookup());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(toastMock.error).toHaveBeenCalledWith('fetch fail');
  });

  it('shows generic error toast on fetch failure with non-Error', async () => {
    mockGetRefs.mockRejectedValue('string-err');

    const { result } = renderHook(() => useReferenceLookup());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(toastMock.error).toHaveBeenCalledWith('Failed to fetch references');
  });

  it('addReference creates and refetches on success', async () => {
    mockCreateRef.mockResolvedValue({ items: [], totalCount: 0 } as any);
    mockGetRefs.mockResolvedValue({ items: [], totalCount: 0 } as any);

    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addReference('pacs.008', 'REF-1');
    });

    expect(mockCreateRef).toHaveBeenCalledWith({
      txTp: 'pacs.008',
      referenceIdName: 'REF-1',
    });
    expect(toastMock.success).toHaveBeenCalledWith(
      'Reference Added',
      expect.stringContaining('REF-1'),
    );
  });

  it('addReference shows error toast on failure', async () => {
    mockCreateRef.mockRejectedValue(new Error('create fail'));

    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addReference('pacs.008', 'REF-1');
    });

    expect(toastMock.error).toHaveBeenCalledWith('Failed to add Reference', 'create fail');
  });

  it('addReference shows generic error for non-Error', async () => {
    mockCreateRef.mockRejectedValue(42);

    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addReference('type', 'id');
    });

    expect(toastMock.error).toHaveBeenCalledWith('Failed to add Reference', 'An error occurred');
  });

  it('addReference returns early when txnType is empty', async () => {
    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addReference('', 'REF-1');
    });

    expect(mockCreateRef).not.toHaveBeenCalled();
  });

  it('addReference returns early when referenceId is empty', async () => {
    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.addReference('type', '');
    });

    expect(mockCreateRef).not.toHaveBeenCalled();
  });

  it('onPageChange updates current page', async () => {
    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.onPageChange(3));
    expect(result.current.pagination.currentPage).toBe(3);
  });

  it('onPageSizeChange updates page size', async () => {
    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.onPageSizeChange(50));
    expect(result.current.pagination.pageSize).toBe(50);
  });

  it('fetchReferences can be called manually', async () => {
    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    const callsBefore = mockGetRefs.mock.calls.length;
    await act(async () => { await result.current.fetchReferences(); });
    expect(mockGetRefs.mock.calls.length).toBeGreaterThan(callsBefore);
  });
});
