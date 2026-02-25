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

  describe('handleApproveClosureSubmit', () => {
    it('approves case closure successfully with comments', async () => {
      const mockApprovedCase = {
        id: 'CASE-123',
        status: 'STATUS_82_CLOSED_CONFIRMED',
      };
      (caseService.approveCaseClosure as vi.Mock).mockResolvedValue(
        mockApprovedCase,
      );

      const { result } = renderHook(() =>
        useApproveCaseActions(mockRefreshCases),
      );

      await result.current.handleApproveClosureSubmit(
        'CASE-123',
        'STATUS_82_CLOSED_CONFIRMED',
        'Test comments',
      );

      await waitFor(() => {
        expect(caseService.approveCaseClosure).toHaveBeenCalledWith(
          'CASE-123',
          {
            finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
            supervisorComments: 'Test comments',
          },
        );
        expect(mockSuccess).toHaveBeenCalled();
        expect(mockRefreshCases).toHaveBeenCalled();
      });
    });

    it('approves case closure successfully without comments', async () => {
      const mockApprovedCase = {
        id: 'CASE-123',
        status: 'STATUS_82_CLOSED_CONFIRMED',
      };
      (caseService.approveCaseClosure as vi.Mock).mockResolvedValue(
        mockApprovedCase,
      );

      const { result } = renderHook(() =>
        useApproveCaseActions(mockRefreshCases),
      );

      await result.current.handleApproveClosureSubmit(
        'CASE-123',
        'STATUS_82_CLOSED_CONFIRMED',
      );

      await waitFor(() => {
        expect(caseService.approveCaseClosure).toHaveBeenCalledWith(
          'CASE-123',
          {
            finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
            supervisorComments: undefined,
          },
        );
      });
    });

    it('trims supervisor comments', async () => {
      const mockApprovedCase = {
        id: 'CASE-123',
        status: 'STATUS_82_CLOSED_CONFIRMED',
      };
      (caseService.approveCaseClosure as vi.Mock).mockResolvedValue(
        mockApprovedCase,
      );

      const { result } = renderHook(() =>
        useApproveCaseActions(mockRefreshCases),
      );

      await result.current.handleApproveClosureSubmit(
        'CASE-123',
        'STATUS_82_CLOSED_CONFIRMED',
        '  Test comments  ',
      );

      await waitFor(() => {
        expect(caseService.approveCaseClosure).toHaveBeenCalledWith(
          'CASE-123',
          {
            finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
            supervisorComments: 'Test comments',
          },
        );
      });
    });

    it('handles approval task validation error', async () => {
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
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Closure Failed',
          expect.stringContaining('Unable to approve case closure right now'),
        );
      });
    });

    it('handles not found error', async () => {
      const error = new Error('Case not found');
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
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Closure Failed',
          expect.stringContaining('Case not found'),
        );
      });
    });

    it('handles 404 error', async () => {
      const error = new Error('404');
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
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Closure Failed',
          expect.stringContaining('Case not found'),
        );
      });
    });

    it('handles unauthorized error', async () => {
      const error = new Error('Unauthorized');
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
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Closure Failed',
          expect.stringContaining('Access denied'),
        );
      });
    });

    it('handles 403 error', async () => {
      const error = new Error('403');
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
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Closure Failed',
          expect.stringContaining('Access denied'),
        );
      });
    });

    it('handles generic error with message', async () => {
      const error = new Error('Generic error message');
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
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Closure Failed',
          expect.stringContaining('Generic error message'),
        );
      });
    });
  });

  describe('handleApproveCreation', () => {
    it('approves case creation successfully', async () => {
      const mockApprovedCase = {
        id: 'CASE-123',
        status: 'STATUS_10_ASSIGNED',
      };
      (caseService.approveCaseCreation as vi.Mock).mockResolvedValue(
        mockApprovedCase,
      );

      const { result } = renderHook(() =>
        useApproveCaseActions(mockRefreshCases),
      );

      await result.current.handleApproveCreation('CASE-123');

      await waitFor(() => {
        expect(caseService.approveCaseCreation).toHaveBeenCalledWith(
          'CASE-123',
        );
        expect(mockSuccess).toHaveBeenCalled();
        expect(mockRefreshCases).toHaveBeenCalled();
      });
    });

    it('handles approval task validation error', async () => {
      const error = new Error('Approval task validation failed');
      (caseService.approveCaseCreation as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useApproveCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleApproveCreation('CASE-123'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Creation Failed',
          expect.stringContaining('Unable to approve case creation right now'),
        );
      });
    });

    it('handles not found error', async () => {
      const error = new Error('Case not found');
      (caseService.approveCaseCreation as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useApproveCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleApproveCreation('CASE-123'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Creation Failed',
          expect.stringContaining('Case not found'),
        );
      });
    });

    it('handles unauthorized error', async () => {
      const error = new Error('Unauthorized');
      (caseService.approveCaseCreation as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useApproveCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleApproveCreation('CASE-123'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Creation Failed',
          expect.stringContaining('Access denied'),
        );
      });
    });
  });

  describe('handleApproveReopening', () => {
    it('approves case reopening successfully', async () => {
      const mockResult = {
        message: 'Case reopened successfully',
      };
      (caseService.approveCaseReopening as vi.Mock).mockResolvedValue(
        mockResult,
      );

      const { result } = renderHook(() =>
        useApproveCaseActions(mockRefreshCases),
      );

      await result.current.handleApproveReopening('CASE-123');

      await waitFor(() => {
        expect(caseService.approveCaseReopening).toHaveBeenCalledWith(
          'CASE-123',
        );
        expect(mockSuccess).toHaveBeenCalled();
        expect(mockRefreshCases).toHaveBeenCalled();
      });
    });

    it('handles approval task validation error', async () => {
      const error = new Error('Approval task validation failed');
      (caseService.approveCaseReopening as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useApproveCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleApproveReopening('CASE-123'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Reopening Failed',
          expect.stringContaining('Unable to approve case reopening right now'),
        );
      });
    });

    it('handles not found error', async () => {
      const error = new Error('Case not found');
      (caseService.approveCaseReopening as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useApproveCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleApproveReopening('CASE-123'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Reopening Failed',
          expect.stringContaining('Case not found'),
        );
      });
    });

    it('handles unauthorized error', async () => {
      const error = new Error('Unauthorized');
      (caseService.approveCaseReopening as vi.Mock).mockRejectedValue(error);

      const { result } = renderHook(() =>
        useApproveCaseActions(mockRefreshCases),
      );

      await expect(
        result.current.handleApproveReopening('CASE-123'),
      ).rejects.toThrow();

      await waitFor(() => {
        expect(mockError).toHaveBeenCalledWith(
          'Approve Case Reopening Failed',
          expect.stringContaining('Access denied'),
        );
      });
    });
  });
});
