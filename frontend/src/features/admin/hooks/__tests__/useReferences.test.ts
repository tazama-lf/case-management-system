import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useReferenceLookup } from '../useReferences';
import referenceIdService from '../../services/referenceIdService';

vi.mock('../../services/referenceIdService', () => ({
  default: { getReferenceIds: vi.fn(), createReferenceIds: vi.fn() },
}));

const mockGetRefs = vi.mocked(referenceIdService.getReferenceIds);
const mockCreateRefs = vi.mocked(referenceIdService.createReferenceIds);

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ success: mockSuccess, error: mockError }),
}));

describe('useReferenceLookup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default mock for auto-fetch on mount
    mockGetRefs.mockResolvedValue({ items: [], totalCount: 0 });
  });

  it('starts with empty results after mount fetch returns empty', async () => {
    const { result } = renderHook(() => useReferenceLookup());

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.results).toHaveLength(0);
  });

  it('fetchReferences populates results on success', async () => {
    const items = [{ id: '1', txTp: 'TRANSFER', referenceIdName: 'REF-001' }];
    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockGetRefs.mockResolvedValueOnce({ items: items as any, totalCount: 1 });
    await act(() => result.current.fetchReferences());

    expect(result.current.results).toHaveLength(1);
    expect(result.current.pagination.totalItems).toBe(1);
  });

  it('calls error toast when fetchReferences fails', async () => {
    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockGetRefs.mockRejectedValueOnce(new Error('Fetch failed'));
    await act(() => result.current.fetchReferences());

    expect(mockError).toHaveBeenCalledWith('Fetch failed');
  });

  it('addReference creates and refetches on success', async () => {
    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockCreateRefs.mockResolvedValueOnce({ items: [], totalCount: 0 });
    await act(() => result.current.addReference('TRANSFER', 'REF-002'));

    expect(mockCreateRefs).toHaveBeenCalledWith({
      txTp: 'TRANSFER',
      referenceIdName: 'REF-002',
    });
    expect(mockSuccess).toHaveBeenCalled();
  });

  it('addReference does nothing when txnType or referenceId is empty', async () => {
    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(() => result.current.addReference('', 'REF-003'));
    await act(() => result.current.addReference('TRANSFER', ''));

    expect(mockCreateRefs).not.toHaveBeenCalled();
  });

  it('calls error toast when addReference fails', async () => {
    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    mockCreateRefs.mockRejectedValueOnce(new Error('Create failed'));
    await act(() => result.current.addReference('TRANSFER', 'REF-003'));

    expect(mockError).toHaveBeenCalledWith(
      'Failed to add Reference',
      'Create failed',
    );
  });

  it('onPageChange updates pagination currentPage', async () => {
    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.onPageChange(3));

    expect(result.current.pagination.currentPage).toBe(3);
  });

  it('onPageSizeChange updates pagination pageSize', async () => {
    const { result } = renderHook(() => useReferenceLookup());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => result.current.onPageSizeChange(25));

    expect(result.current.pagination.pageSize).toBe(25);
  });
});
