import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReturnCaseActions } from '../useReturnCaseActions';
import { caseService } from '../../services/caseService';
import { useToast } from '../../../../shared/providers/ToastProvider';

vi.mock('../../services/caseService');
vi.mock('../../../../shared/providers/ToastProvider');

describe('useReturnCaseActions', () => {
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

  it('returns case for review successfully', async () => {
    const mockReturnedCase = {
      id: 'CASE-123',
      status: 'STATUS_70_PENDING_APPROVAL',
    };
    (caseService.returnCaseForReview as vi.Mock).mockResolvedValue(mockReturnedCase);

    const { result } = renderHook(() =>
      useReturnCaseActions(mockRefreshCases),
    );

    await result.current.handleReturnForReview('CASE-123', 'Test comments');

    await waitFor(() => {
      expect(caseService.returnCaseForReview).toHaveBeenCalledWith('CASE-123', {
        reviewComments: 'Test comments',
      });
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('handles error when case cannot be returned', async () => {
    const error = new Error('not in a returnable state');
    (caseService.returnCaseForReview as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useReturnCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleReturnForReview('CASE-123', 'Test comments'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });
});

