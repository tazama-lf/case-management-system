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

  describe('handleApproveReopenSubmit', () => {
    it('approves case reopening with STATUS_10_ASSIGNED', async () => {
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
        expect(mockSuccess).toHaveBeenCalledWith(
          'Case Reopening Approved',
          expect.stringContaining('STATUS_10_ASSIGNED'),
        );
        expect(mockRefreshCases).toHaveBeenCalled();
      });
    });

    it('approves case reopening with STATUS_10_ASSIGNED without assigned_to', async () => {
      const mockResponse = {
        case: { status: 'STATUS_10_ASSIGNED' },
        investigation_task: { task_id: 'TASK-123' },
      };
      (caseService.approveCaseReopening as vi.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useCaseReopenActions(mockRefreshCases),
      );

      await result.current.handleApproveReopenSubmit('CASE-123');

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith(
          'Case Reopening Approved',
          expect.stringContaining('STATUS_10_ASSIGNED'),
        );
      });
    });

    it('approves case reopening with STATUS_02_READY_FOR_ASSIGNMENT', async () => {
      const mockResponse = {
        case: { status: 'STATUS_02_READY_FOR_ASSIGNMENT' },
        investigation_task: { task_id: 'TASK-123', candidateGroup: 'Investigations' },
      };
      (caseService.approveCaseReopening as vi.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useCaseReopenActions(mockRefreshCases),
      );

      await result.current.handleApproveReopenSubmit('CASE-123');

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith(
          'Case Reopening Approved',
          expect.stringContaining('STATUS_02_READY_FOR_ASSIGNMENT'),
        );
      });
    });

    it('approves case reopening with STATUS_31_REOPENED', async () => {
      const mockResponse = {
        case: { status: 'STATUS_31_REOPENED' },
        investigation_task: { task_id: 'TASK-123' },
      };
      (caseService.approveCaseReopening as vi.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useCaseReopenActions(mockRefreshCases),
      );

      await result.current.handleApproveReopenSubmit('CASE-123');

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith(
          'Case Reopening Approved',
          expect.stringContaining('STATUS_31_REOPENED'),
        );
      });
    });

    it('handles missing investigation_task', async () => {
      const mockResponse = {
        case: { status: 'STATUS_10_ASSIGNED' },
      };
      (caseService.approveCaseReopening as vi.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useCaseReopenActions(mockRefreshCases),
      );

      await result.current.handleApproveReopenSubmit('CASE-123');

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalled();
      });
    });

    it('handles error when approval fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Approval failed');
      (caseService.approveCaseReopening as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useCaseReopenActions(mockRefreshCases),
      );

      await expect(
        result.current.handleApproveReopenSubmit('CASE-123'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Reopening Failed',
          'Approval failed',
        );
      });
      consoleErrorSpy.mockRestore();
    });

    it('handles non-Error rejection', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (caseService.approveCaseReopening as vi.Mock).mockRejectedValue('String error');

      const { result } = renderHook(() =>
        useCaseReopenActions(mockRefreshCases),
      );

      await expect(
        result.current.handleApproveReopenSubmit('CASE-123'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Reopening Failed',
          'Failed to approve case reopening',
        );
      });
      consoleErrorSpy.mockRestore();
    });
  });

  describe('handleRejectReopenSubmit', () => {
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

    it('uses rejection_reason from response if available', async () => {
      const mockResponse = {
        case: { status: 'STATUS_82_CLOSED_CONFIRMED' },
        rejection_reason: 'Response reason',
      };
      (caseService.rejectCaseReopening as vi.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useCaseReopenActions(mockRefreshCases),
      );

      await result.current.handleRejectReopenSubmit('CASE-123', 'Input reason');

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith(
          'Case Reopening Rejected',
          expect.stringContaining('Response reason'),
        );
      });
    });

    it('handles STATUS_8x closed status', async () => {
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
        expect(mockSuccess).toHaveBeenCalledWith(
          'Case Reopening Rejected',
          expect.stringContaining('STATUS_82_CLOSED_CONFIRMED'),
        );
      });
    });

    it('handles STATUS_7x closed status', async () => {
      const mockResponse = {
        case: { status: 'STATUS_71_AUTOCLOSED_CONFIRMED' },
        rejection_reason: 'Test reason',
      };
      (caseService.rejectCaseReopening as vi.Mock).mockResolvedValue(mockResponse);

      const { result } = renderHook(() =>
        useCaseReopenActions(mockRefreshCases),
      );

      await result.current.handleRejectReopenSubmit('CASE-123', 'Test reason');

      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith(
          'Case Reopening Rejected',
          expect.stringContaining('STATUS_71_AUTOCLOSED_CONFIRMED'),
        );
      });
    });

    it('handles error when rejection fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Rejection failed');
      (caseService.rejectCaseReopening as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useCaseReopenActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectReopenSubmit('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalled();
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Reopening Failed',
          'Rejection failed',
        );
      });
      consoleErrorSpy.mockRestore();
    });

    it('handles non-Error rejection', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      (caseService.rejectCaseReopening as vi.Mock).mockRejectedValue('String error');

      const { result } = renderHook(() =>
        useCaseReopenActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectReopenSubmit('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Reopening Failed',
          'Failed to reject case reopening',
        );
      });
      consoleErrorSpy.mockRestore();
    });
  });
});

