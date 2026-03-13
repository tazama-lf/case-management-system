import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useAbandonCaseActions } from '../useAbandonCaseActions';
import { caseService } from '../../services/caseService';
import { useToast } from '../../../../shared/providers/ToastProvider';

vi.mock('../../services/caseService', () => ({
  caseService: { abandonCase: vi.fn() },
}));

vi.mock('../../../../shared/providers/ToastProvider', () => ({
  useToast: vi.fn(),
}));

describe('useAbandonCaseActions', () => {
  const mockSuccess = vi.fn();
  const mockError = vi.fn();
  const mockRefresh = vi.fn().mockResolvedValue(undefined);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useToast).mockReturnValue({ success: mockSuccess, error: mockError } as any);
  });

  it('abandons a case and calls success + refresh', async () => {
    vi.mocked(caseService.abandonCase).mockResolvedValue({ status: 'ABANDONED' } as any);

    const { result } = renderHook(() => useAbandonCaseActions(mockRefresh));
    await result.current.handleAbandonSubmit(123, 'No longer needed');

    expect(caseService.abandonCase).toHaveBeenCalledWith(123, { reason: 'No longer needed' });
    expect(mockSuccess).toHaveBeenCalledWith('Case Abandoned', expect.stringContaining('123'));
    expect(mockRefresh).toHaveBeenCalled();
  });

  it('trims reason string', async () => {
    vi.mocked(caseService.abandonCase).mockResolvedValue({} as any);

    const { result } = renderHook(() => useAbandonCaseActions(mockRefresh));
    await result.current.handleAbandonSubmit(1, '  spaced  ');

    expect(caseService.abandonCase).toHaveBeenCalledWith(1, { reason: 'spaced' });
  });

  it('shows draft-status error', async () => {
    vi.mocked(caseService.abandonCase).mockRejectedValue(new Error('Cannot abandon case other than draft status'));

    const { result } = renderHook(() => useAbandonCaseActions(mockRefresh));
    await expect(result.current.handleAbandonSubmit(1, 'r')).rejects.toThrow();

    expect(mockError).toHaveBeenCalledWith('Abandon Case Failed', expect.stringContaining('Cannot abandon case'));
  });

  it('shows pending-task error', async () => {
    vi.mocked(caseService.abandonCase).mockRejectedValue(new Error('No complete new Case Task exists'));

    const { result } = renderHook(() => useAbandonCaseActions(mockRefresh));
    await expect(result.current.handleAbandonSubmit(1, 'r')).rejects.toThrow();

    expect(mockError).toHaveBeenCalledWith('Abandon Case Failed', expect.stringContaining('pending task'));
  });

  it('shows unauthorized error', async () => {
    vi.mocked(caseService.abandonCase).mockRejectedValue(new Error('Unauthorized'));

    const { result } = renderHook(() => useAbandonCaseActions(mockRefresh));
    await expect(result.current.handleAbandonSubmit(1, 'r')).rejects.toThrow();

    expect(mockError).toHaveBeenCalledWith('Abandon Case Failed', expect.stringContaining('Access denied'));
  });

  it('shows 403 error', async () => {
    vi.mocked(caseService.abandonCase).mockRejectedValue(new Error('403'));

    const { result } = renderHook(() => useAbandonCaseActions(mockRefresh));
    await expect(result.current.handleAbandonSubmit(1, 'r')).rejects.toThrow();

    expect(mockError).toHaveBeenCalledWith('Abandon Case Failed', expect.stringContaining('Access denied'));
  });

  it('shows not-found error', async () => {
    vi.mocked(caseService.abandonCase).mockRejectedValue(new Error('not found'));

    const { result } = renderHook(() => useAbandonCaseActions(mockRefresh));
    await expect(result.current.handleAbandonSubmit(1, 'r')).rejects.toThrow();

    expect(mockError).toHaveBeenCalledWith('Abandon Case Failed', expect.stringContaining('not found'));
  });

  it('shows 404 error', async () => {
    vi.mocked(caseService.abandonCase).mockRejectedValue(new Error('404'));

    const { result } = renderHook(() => useAbandonCaseActions(mockRefresh));
    await expect(result.current.handleAbandonSubmit(1, 'r')).rejects.toThrow();

    expect(mockError).toHaveBeenCalledWith('Abandon Case Failed', expect.stringContaining('not found'));
  });

  it('shows raw backend error for unknown errors', async () => {
    vi.mocked(caseService.abandonCase).mockRejectedValue(new Error('Something unexpected'));

    const { result } = renderHook(() => useAbandonCaseActions(mockRefresh));
    await expect(result.current.handleAbandonSubmit(1, 'r')).rejects.toThrow();

    expect(mockError).toHaveBeenCalledWith('Abandon Case Failed', 'Something unexpected');
  });

  it('shows generic error for non-Error throws', async () => {
    vi.mocked(caseService.abandonCase).mockRejectedValue('string error');

    const { result } = renderHook(() => useAbandonCaseActions(mockRefresh));
    await expect(result.current.handleAbandonSubmit(1, 'r')).rejects.toBe('string error');

    expect(mockError).toHaveBeenCalledWith('Abandon Case Failed', 'Could not abandon case.');
  });

  it('re-throws the error', async () => {
    const err = new Error('fail');
    vi.mocked(caseService.abandonCase).mockRejectedValue(err);

    const { result } = renderHook(() => useAbandonCaseActions(mockRefresh));
    await expect(result.current.handleAbandonSubmit(1, 'r')).rejects.toBe(err);
  });
});
