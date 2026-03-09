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

  it('trims reason before sending', async () => {
    const mockSuspendedCase = {
      id: 'CASE-123',
      status: 'STATUS_40_SUSPENDED',
    };
    (caseService.suspendCase as vi.Mock).mockResolvedValue(mockSuspendedCase);

    const { result } = renderHook(() =>
      useSuspendCaseActions(mockRefreshCases),
    );

    await result.current.handleSuspendSubmit('CASE-123', '  Test reason  ');

    await waitFor(() => {
      expect(caseService.suspendCase).toHaveBeenCalledWith('CASE-123', {
        reason: 'Test reason',
      });
    });
  });

  it('handles not in a suspendable state error', async () => {
    const error = new Error('not in a suspendable state');
    (caseService.suspendCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useSuspendCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleSuspendSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Suspend Case Failed',
        expect.stringContaining('Unable to suspend this case right now'),
      );
    });
  });

  it('handles unauthorized error', async () => {
    const error = new Error('Unauthorized');
    (caseService.suspendCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useSuspendCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleSuspendSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Suspend Case Failed',
        expect.stringContaining('Access denied'),
      );
    });
  });

  it('handles 403 error', async () => {
    const error = new Error('403');
    (caseService.suspendCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useSuspendCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleSuspendSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Suspend Case Failed',
        expect.stringContaining('Access denied'),
      );
    });
  });

  it('handles not found error', async () => {
    const error = new Error('Case not found');
    (caseService.suspendCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useSuspendCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleSuspendSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Suspend Case Failed',
        expect.stringContaining('Case not found'),
      );
    });
  });

  it('handles 404 error', async () => {
    const error = new Error('404');
    (caseService.suspendCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useSuspendCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleSuspendSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Suspend Case Failed',
        expect.stringContaining('Case not found'),
      );
    });
  });

  it('handles generic error with message', async () => {
    const error = new Error('Generic error message');
    (caseService.suspendCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useSuspendCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleSuspendSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Suspend Case Failed',
        expect.stringContaining('Generic error message'),
      );
    });
  });

  it('handles error without message', async () => {
    const error = new Error('');
    (caseService.suspendCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useSuspendCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleSuspendSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Suspend Case Failed',
        expect.stringContaining('Something went wrong'),
      );
    });
  });
});
