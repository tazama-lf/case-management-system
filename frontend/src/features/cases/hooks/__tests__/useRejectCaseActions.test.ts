import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useRejectCaseActions } from '../useRejectCaseActions';
import { caseService } from '../../services/caseService';
import { useToast } from '../../../../shared/providers/ToastProvider';

vi.mock('../../services/caseService');
vi.mock('../../../../shared/providers/ToastProvider');

describe('useRejectCaseActions', () => {
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

  it('rejects case creation successfully', async () => {
    const mockRejectedCase = {
      id: 'CASE-123',
      status: 'STATUS_91_REJECTED',
    };
    (caseService.rejectCaseCreation as vi.Mock).mockResolvedValue(mockRejectedCase);

    const { result } = renderHook(() =>
      useRejectCaseActions(mockRefreshCases),
    );

    await result.current.handleRejectCaseCreation('CASE-123', 'Test reason');

    await waitFor(() => {
      expect(caseService.rejectCaseCreation).toHaveBeenCalledWith('CASE-123', {
        reason: 'Test reason',
      });
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('handles error when rejection fails', async () => {
    const error = new Error('Approval task validation failed');
    (caseService.rejectCaseCreation as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useRejectCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleRejectCaseCreation('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });
});

