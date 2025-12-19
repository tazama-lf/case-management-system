import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAbandonCaseActions } from '../useAbandonCaseActions';
import { caseService } from '../../services/caseService';
import { useToast } from '../../../../shared/providers/ToastProvider';

vi.mock('../../services/caseService');
vi.mock('../../../../shared/providers/ToastProvider');

describe('useAbandonCaseActions', () => {
  const mockSuccess = vi.fn();
  const mockError = vi.fn();
  const mockRefreshCases = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useToast as vi.Mock).mockReturnValue({
      success: mockSuccess,
      error: mockError,
    });
  });

  it('abandons case successfully', async () => {
    const mockAbandonedCase = {
      id: 'CASE-123',
      status: 'STATUS_90_ABANDONED',
    };
    (caseService.abandonCase as vi.Mock).mockResolvedValue(mockAbandonedCase);

    const { result } = renderHook(() =>
      useAbandonCaseActions(mockRefreshCases),
    );

    await result.current.handleAbandonSubmit('CASE-123', 'Test reason');

    await waitFor(() => {
      expect(caseService.abandonCase).toHaveBeenCalledWith('CASE-123', {
        reason: 'Test reason',
      });
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('handles error when case cannot be abandoned', async () => {
    const error = new Error('Cannot abandon case other than draft status');
    (caseService.abandonCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useAbandonCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleAbandonSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
      expect(mockRefreshCases).not.toHaveBeenCalled();
    });
  });

  it('handles unauthorized error', async () => {
    const error = new Error('Unauthorized');
    (caseService.abandonCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useAbandonCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleAbandonSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });
});

