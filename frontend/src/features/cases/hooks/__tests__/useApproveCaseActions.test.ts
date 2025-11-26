import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useApproveCaseActions } from '../useApproveCaseActions';
import { caseService } from '../../services/caseService';
import { useToast } from '../../../../shared/providers/ToastProvider';

vi.mock('../../services/caseService');
vi.mock('../../../../shared/providers/ToastProvider');

describe('useApproveCaseActions', () => {
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

  it('approves case closure successfully', async () => {
    const mockApprovedCase = {
      id: 'CASE-123',
      status: 'STATUS_82_CLOSED_CONFIRMED',
    };
    (caseService.approveCaseClosure as vi.Mock).mockResolvedValue(mockApprovedCase);

    const { result } = renderHook(() =>
      useApproveCaseActions(mockRefreshCases),
    );

    await result.current.handleApproveClosureSubmit(
      'CASE-123',
      'STATUS_82_CLOSED_CONFIRMED',
      'Test comments',
    );

    await waitFor(() => {
      expect(caseService.approveCaseClosure).toHaveBeenCalledWith('CASE-123', {
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
        supervisorComments: 'Test comments',
      });
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('approves case creation successfully', async () => {
    const mockApprovedCase = {
      id: 'CASE-123',
      status: 'STATUS_10_ASSIGNED',
    };
    (caseService.approveCaseCreation as vi.Mock).mockResolvedValue(mockApprovedCase);

    const { result } = renderHook(() =>
      useApproveCaseActions(mockRefreshCases),
    );

    await result.current.handleApproveCreation('CASE-123');

    await waitFor(() => {
      expect(caseService.approveCaseCreation).toHaveBeenCalledWith('CASE-123');
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('approves case reopening successfully', async () => {
    const mockResult = {
      message: 'Case reopened successfully',
    };
    (caseService.approveCaseReopening as vi.Mock).mockResolvedValue(mockResult);

    const { result } = renderHook(() =>
      useApproveCaseActions(mockRefreshCases),
    );

    await result.current.handleApproveReopening('CASE-123');

    await waitFor(() => {
      expect(caseService.approveCaseReopening).toHaveBeenCalledWith('CASE-123');
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('handles error when approval fails', async () => {
    const error = new Error('Approval task validation failed');
    (caseService.approveCaseClosure as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useApproveCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleApproveClosureSubmit(
        'CASE-123',
        'STATUS_82_CLOSED_CONFIRMED',
      ),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });
});

