import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReopenCaseActions } from '../useReopenCaseActions';
import { caseService } from '../../services/caseService';
import { useToast } from '../../../../shared/providers/ToastProvider';

vi.mock('../../services/caseService');
vi.mock('../../../../shared/providers/ToastProvider');

describe('useReopenCaseActions', () => {
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

  it('reopens case successfully', async () => {
    (caseService.reopenCase as vi.Mock).mockResolvedValue({});

    const { result } = renderHook(() =>
      useReopenCaseActions(mockRefreshCases),
    );

    await result.current.handleReopenSubmit('CASE-123', 'Test reason');

    await waitFor(() => {
      expect(caseService.reopenCase).toHaveBeenCalledWith('CASE-123', {
        reason: 'Test reason',
      });
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('handles error when case cannot be reopened', async () => {
    const error = new Error('not in a reopenable state');
    (caseService.reopenCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useReopenCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleReopenSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });
});

