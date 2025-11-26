import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCloseCaseActions } from '../useCloseCaseActions';
import { caseService } from '../../services/caseService';
import { useToast } from '../../../../shared/providers/ToastProvider';

vi.mock('../../services/caseService');
vi.mock('../../../../shared/providers/ToastProvider');

describe('useCloseCaseActions', () => {
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

  it('closes case successfully', async () => {
    const mockResponse = {
      closed_case: {
        id: 'CASE-123',
        status: 'STATUS_70_PENDING_APPROVAL',
      },
    };
    (caseService.closeCase as vi.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() =>
      useCloseCaseActions(mockRefreshCases),
    );

    await result.current.handleCloseCaseSubmit('CASE-123', {
      investigationSummary: 'Test summary',
      recommendations: 'Test recommendations',
      finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
    });

    await waitFor(() => {
      expect(caseService.closeCase).toHaveBeenCalled();
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('handles error when case cannot be closed', async () => {
    const error = new Error('Investigation task is not completed');
    (caseService.closeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useCloseCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleCloseCaseSubmit('CASE-123', {
        investigationSummary: 'Test',
        recommendations: 'Test',
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
      }),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });
});

