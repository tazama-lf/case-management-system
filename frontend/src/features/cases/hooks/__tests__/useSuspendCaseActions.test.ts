import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSuspendCaseActions } from '../useSuspendCaseActions';
import { caseService } from '../../services/caseService';
import { useToast } from '../../../../shared/providers/ToastProvider';

vi.mock('../../services/caseService');
vi.mock('../../../../shared/providers/ToastProvider');

describe('useSuspendCaseActions', () => {
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

  it('suspends case successfully', async () => {
    const mockSuspendedCase = {
      id: 'CASE-123',
      status: 'STATUS_40_SUSPENDED',
    };
    (caseService.suspendCase as vi.Mock).mockResolvedValue(mockSuspendedCase);

    const { result } = renderHook(() =>
      useSuspendCaseActions(mockRefreshCases),
    );

    await result.current.handleSuspendSubmit('CASE-123', 'Test reason');

    await waitFor(() => {
      expect(caseService.suspendCase).toHaveBeenCalledWith('CASE-123', {
        reason: 'Test reason',
      });
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('handles error when case cannot be suspended', async () => {
    const error = new Error('not in a suspendable state');
    (caseService.suspendCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useSuspendCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleSuspendSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });
});

