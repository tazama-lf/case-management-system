import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useCaseReopenActions } from '../useCaseReopenActions';
import { caseService } from '../../services/caseService';
import { useToast } from '../../../../shared/providers/ToastProvider';

vi.mock('../../services/caseService');
vi.mock('../../../../shared/providers/ToastProvider');

describe('useCaseReopenActions', () => {
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

  it('approves case reopening successfully', async () => {
    const mockResponse = {
      case: { status: 'STATUS_10_ASSIGNED' },
      investigation_task: { task_id: 'TASK-123', assigned_to: 'user-1' },
    };
    (caseService.approveCaseReopening as vi.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() =>
      useCaseReopenActions(mockRefreshCases),
    );

    await result.current.handleApproveReopenSubmit('CASE-123');

    await waitFor(() => {
      expect(caseService.approveCaseReopening).toHaveBeenCalledWith('CASE-123');
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('rejects case reopening successfully', async () => {
    const mockResponse = {
      case: { status: 'STATUS_82_CLOSED_CONFIRMED' },
      rejection_reason: 'Test reason',
    };
    (caseService.rejectCaseReopening as vi.Mock).mockResolvedValue(mockResponse);

    const { result } = renderHook(() =>
      useCaseReopenActions(mockRefreshCases),
    );

    await result.current.handleRejectReopenSubmit('CASE-123', 'Test reason');

    await waitFor(() => {
      expect(caseService.rejectCaseReopening).toHaveBeenCalledWith('CASE-123', 'Test reason');
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('handles error when approval fails', async () => {
    const error = new Error('Approval failed');
    (caseService.approveCaseReopening as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useCaseReopenActions(mockRefreshCases),
    );

    await expect(
      result.current.handleApproveReopenSubmit('CASE-123'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
    });
  });
});

