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
    it('approves case reopening and shows success toast', async () => {
      (caseService.approveCaseReopening as vi.Mock).mockResolvedValue({});
      const { result } = renderHook(() => useCaseReopenActions(mockRefreshCases));
      await result.current.handleApproveReopenSubmit('CASE-123' as any);
      await waitFor(() => {
        expect(caseService.approveCaseReopening).toHaveBeenCalledWith('CASE-123');
        expect(mockSuccess).toHaveBeenCalledWith('Case Reopening Approved', expect.stringContaining('CASE-123'));
        expect(mockRefreshCases).toHaveBeenCalled();
      });
    });

    it('approves case reopening with different caseId', async () => {
      (caseService.approveCaseReopening as vi.Mock).mockResolvedValue({});
      const { result } = renderHook(() => useCaseReopenActions(mockRefreshCases));
      await result.current.handleApproveReopenSubmit(456 as any);
      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith('Case Reopening Approved', expect.stringContaining('456'));
      });
    });

    it('calls refreshCases after successful approval', async () => {
      (caseService.approveCaseReopening as vi.Mock).mockResolvedValue({});
      const { result } = renderHook(() => useCaseReopenActions(mockRefreshCases));
      await result.current.handleApproveReopenSubmit('CASE-789' as any);
      await waitFor(() => { expect(mockRefreshCases).toHaveBeenCalled(); });
    });

    it('handles missing investigation_task in response', async () => {
      (caseService.approveCaseReopening as vi.Mock).mockResolvedValue({ case: { status: 'STATUS_10_ASSIGNED' } });
      const { result } = renderHook(() => useCaseReopenActions(mockRefreshCases));
      await result.current.handleApproveReopenSubmit('CASE-123' as any);
      await waitFor(() => { expect(mockSuccess).toHaveBeenCalled(); });
    });

    it('handles error when approval fails', async () => {
      (caseService.approveCaseReopening as vi.Mock).mockRejectedValue(new Error('Approval failed'));
      const { result } = renderHook(() => useCaseReopenActions(mockRefreshCases));
      await expect(result.current.handleApproveReopenSubmit('CASE-123' as any)).rejects.toThrow();
      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('Approve Case Reopening Failed', 'Approval failed');
      });
    });

    it('handles non-Error rejection', async () => {
      (caseService.approveCaseReopening as vi.Mock).mockRejectedValue('String error');
      const { result } = renderHook(() => useCaseReopenActions(mockRefreshCases));
      await expect(result.current.handleApproveReopenSubmit('CASE-123' as any)).rejects.toThrow();
      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('Approve Case Reopening Failed', 'Failed to approve case reopening');
      });
    });
  });

  describe('handleRejectReopenSubmit', () => {
    it('rejects case reopening successfully', async () => {
      (caseService.rejectCaseReopening as vi.Mock).mockResolvedValue({});
      const { result } = renderHook(() => useCaseReopenActions(mockRefreshCases));
      await result.current.handleRejectReopenSubmit('CASE-123' as any, 'Test reason');
      await waitFor(() => {
        expect(caseService.rejectCaseReopening).toHaveBeenCalledWith('CASE-123', 'Test reason');
        expect(mockSuccess).toHaveBeenCalled();
        expect(mockRefreshCases).toHaveBeenCalled();
      });
    });

    it('includes reason in success toast message', async () => {
      (caseService.rejectCaseReopening as vi.Mock).mockResolvedValue({});
      const { result } = renderHook(() => useCaseReopenActions(mockRefreshCases));
      await result.current.handleRejectReopenSubmit('CASE-123' as any, 'Input reason');
      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith('Case Reopening Rejected', expect.stringContaining('Input reason'));
      });
    });

    it('includes caseId in success toast message', async () => {
      (caseService.rejectCaseReopening as vi.Mock).mockResolvedValue({});
      const { result } = renderHook(() => useCaseReopenActions(mockRefreshCases));
      await result.current.handleRejectReopenSubmit('CASE-123' as any, 'Test reason');
      await waitFor(() => {
        expect(mockSuccess).toHaveBeenCalledWith('Case Reopening Rejected', expect.stringContaining('CASE-123'));
      });
    });

    it('calls refreshCases after successful rejection', async () => {
      (caseService.rejectCaseReopening as vi.Mock).mockResolvedValue({});
      const { result } = renderHook(() => useCaseReopenActions(mockRefreshCases));
      await result.current.handleRejectReopenSubmit('CASE-123' as any, 'Test reason');
      await waitFor(() => { expect(mockRefreshCases).toHaveBeenCalled(); });
    });

    it('handles error when rejection fails', async () => {
      (caseService.rejectCaseReopening as vi.Mock).mockRejectedValue(new Error('Rejection failed'));
      const { result } = renderHook(() => useCaseReopenActions(mockRefreshCases));
      await expect(result.current.handleRejectReopenSubmit('CASE-123' as any, 'Test reason')).rejects.toThrow();
      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('Reject Case Reopening Failed', 'Rejection failed');
      });
    });

    it('handles non-Error rejection', async () => {
      (caseService.rejectCaseReopening as vi.Mock).mockRejectedValue('String error');
      const { result } = renderHook(() => useCaseReopenActions(mockRefreshCases));
      await expect(result.current.handleRejectReopenSubmit('CASE-123' as any, 'Test reason')).rejects.toThrow();
      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith('Reject Case Reopening Failed', 'Failed to reject case reopening');
      });
    });
  });
});
