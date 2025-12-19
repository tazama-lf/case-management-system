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

  describe('handleRejectCaseCreation', () => {
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

    it('trims reason before sending', async () => {
      const mockRejectedCase = {
        id: 'CASE-123',
        status: 'STATUS_91_REJECTED',
      };
      (caseService.rejectCaseCreation as vi.Mock).mockResolvedValue(mockRejectedCase);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await result.current.handleRejectCaseCreation('CASE-123', '  Test reason  ');

      await waitFor(() => {
        expect(caseService.rejectCaseCreation).toHaveBeenCalledWith('CASE-123', {
          reason: 'Test reason',
        });
      });
    });

    it('handles approval task validation error', async () => {
      const error = new Error('Approval task validation failed');
      (caseService.rejectCaseCreation as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectCaseCreation('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Creation Failed',
          expect.stringContaining('Unable to reject case creation right now'),
        );
      });
    });

    it('handles not found error', async () => {
      const error = new Error('Case not found');
      (caseService.rejectCaseCreation as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectCaseCreation('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Creation Failed',
          expect.stringContaining('Case not found'),
        );
      });
    });

    it('handles 404 error', async () => {
      const error = new Error('404');
      (caseService.rejectCaseCreation as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectCaseCreation('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Creation Failed',
          expect.stringContaining('Case not found'),
        );
      });
    });

    it('handles unauthorized error', async () => {
      const error = new Error('Unauthorized');
      (caseService.rejectCaseCreation as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectCaseCreation('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Creation Failed',
          expect.stringContaining('Access denied'),
        );
      });
    });

    it('handles 403 error', async () => {
      const error = new Error('403');
      (caseService.rejectCaseCreation as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectCaseCreation('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Creation Failed',
          expect.stringContaining('Access denied'),
        );
      });
    });

    it('handles generic error with message', async () => {
      const error = new Error('Generic error message');
      (caseService.rejectCaseCreation as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectCaseCreation('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Creation Failed',
          expect.stringContaining('Generic error message'),
        );
      });
    });

    it('handles error without message', async () => {
      const error = new Error('');
      (caseService.rejectCaseCreation as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectCaseCreation('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Creation Failed',
          expect.stringContaining('Something went wrong'),
        );
      });
    });
  });

  describe('handleRejectCase', () => {
    it('rejects case successfully', async () => {
      const mockRejectedCase = {
        id: 'CASE-123',
        status: 'STATUS_91_REJECTED',
      };
      (caseService.rejectCase as vi.Mock).mockResolvedValue(mockRejectedCase);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await result.current.handleRejectCase('CASE-123', 'Test reason');

      await waitFor(() => {
        expect(caseService.rejectCase).toHaveBeenCalledWith('CASE-123', {
          rejectionReason: 'Test reason',
        });
        expect(mockSuccess).toHaveBeenCalled();
        expect(mockRefreshCases).toHaveBeenCalled();
      });
    });

    it('trims rejection reason before sending', async () => {
      const mockRejectedCase = {
        id: 'CASE-123',
        status: 'STATUS_91_REJECTED',
      };
      (caseService.rejectCase as vi.Mock).mockResolvedValue(mockRejectedCase);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await result.current.handleRejectCase('CASE-123', '  Test reason  ');

      await waitFor(() => {
        expect(caseService.rejectCase).toHaveBeenCalledWith('CASE-123', {
          rejectionReason: 'Test reason',
        });
      });
    });

    it('handles approval task validation error', async () => {
      const error = new Error('Approval task validation failed');
      (caseService.rejectCase as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectCase('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Failed',
          expect.stringContaining('Unable to reject case right now'),
        );
      });
    });

    it('handles not found error', async () => {
      const error = new Error('Case not found');
      (caseService.rejectCase as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectCase('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Failed',
          expect.stringContaining('Case not found'),
        );
      });
    });

    it('handles unauthorized error', async () => {
      const error = new Error('Unauthorized');
      (caseService.rejectCase as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectCase('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Failed',
          expect.stringContaining('Access denied'),
        );
      });
    });
  });

  describe('handleRejectReopening', () => {
    it('rejects case reopening successfully', async () => {
      const mockResult = {
        message: 'Case reopening rejected',
      };
      (caseService.rejectCaseReopening as vi.Mock).mockResolvedValue(mockResult);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await result.current.handleRejectReopening('CASE-123', 'Test reason');

      await waitFor(() => {
        expect(caseService.rejectCaseReopening).toHaveBeenCalledWith(
          'CASE-123',
          'Test reason',
        );
        expect(mockSuccess).toHaveBeenCalled();
        expect(mockRefreshCases).toHaveBeenCalled();
      });
    });

    it('handles approval task validation error', async () => {
      const error = new Error('Approval task validation failed');
      (caseService.rejectCaseReopening as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectReopening('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Reopening Failed',
          expect.stringContaining('Unable to reject case reopening right now'),
        );
      });
    });

    it('handles not found error', async () => {
      const error = new Error('Case not found');
      (caseService.rejectCaseReopening as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectReopening('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Reopening Failed',
          expect.stringContaining('Case not found'),
        );
      });
    });

    it('handles unauthorized error', async () => {
      const error = new Error('Unauthorized');
      (caseService.rejectCaseReopening as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useRejectCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleRejectReopening('CASE-123', 'Test reason'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Reject Case Reopening Failed',
          expect.stringContaining('Access denied'),
        );
      });
    });
  });
});

