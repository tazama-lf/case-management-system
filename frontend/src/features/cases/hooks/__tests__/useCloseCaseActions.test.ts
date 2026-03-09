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

    const { result } = renderHook(() => useCloseCaseActions(mockRefreshCases));

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

  it('handles investigation task not completed error', async () => {
    const error = new Error('Investigation task is not completed');
    (caseService.closeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useCloseCaseActions(mockRefreshCases));

    await expect(
      result.current.handleCloseCaseSubmit('CASE-123', {
        investigationSummary: 'Test',
        recommendations: 'Test',
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
      }),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Close Case Failed',
        expect.stringContaining('Investigation task must be completed first'),
      );
    });
  });

  it('handles not in a closeable state error', async () => {
    const error = new Error('not in a closeable state');
    (caseService.closeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useCloseCaseActions(mockRefreshCases));

    await expect(
      result.current.handleCloseCaseSubmit('CASE-123', {
        investigationSummary: 'Test',
        recommendations: 'Test',
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
      }),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Close Case Failed',
        expect.stringContaining('Unable to close this case right now'),
      );
    });
  });

  it('handles unauthorized error', async () => {
    const error = new Error('Unauthorized');
    (caseService.closeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useCloseCaseActions(mockRefreshCases));

    await expect(
      result.current.handleCloseCaseSubmit('CASE-123', {
        investigationSummary: 'Test',
        recommendations: 'Test',
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
      }),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Close Case Failed',
        expect.stringContaining('Access denied'),
      );
    });
  });

  it('handles 403 error', async () => {
    const error = new Error('403');
    (caseService.closeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useCloseCaseActions(mockRefreshCases));

    await expect(
      result.current.handleCloseCaseSubmit('CASE-123', {
        investigationSummary: 'Test',
        recommendations: 'Test',
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
      }),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Close Case Failed',
        expect.stringContaining('Access denied'),
      );
    });
  });

  it('handles not found error', async () => {
    const error = new Error('Case not found');
    (caseService.closeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useCloseCaseActions(mockRefreshCases));

    await expect(
      result.current.handleCloseCaseSubmit('CASE-123', {
        investigationSummary: 'Test',
        recommendations: 'Test',
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
      }),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Close Case Failed',
        expect.stringContaining('Case not found'),
      );
    });
  });

  it('handles 404 error', async () => {
    const error = new Error('404');
    (caseService.closeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useCloseCaseActions(mockRefreshCases));

    await expect(
      result.current.handleCloseCaseSubmit('CASE-123', {
        investigationSummary: 'Test',
        recommendations: 'Test',
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
      }),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Close Case Failed',
        expect.stringContaining('Case not found'),
      );
    });
  });

  it('handles generic error with message', async () => {
    const error = new Error('Generic error message');
    (caseService.closeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useCloseCaseActions(mockRefreshCases));

    await expect(
      result.current.handleCloseCaseSubmit('CASE-123', {
        investigationSummary: 'Test',
        recommendations: 'Test',
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
      }),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Close Case Failed',
        expect.stringContaining('Generic error message'),
      );
    });
  });

  it('handles error without message', async () => {
    const error = new Error('');
    (caseService.closeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useCloseCaseActions(mockRefreshCases));

    await expect(
      result.current.handleCloseCaseSubmit('CASE-123', {
        investigationSummary: 'Test',
        recommendations: 'Test',
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
      }),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Close Case Failed',
        expect.stringContaining('Something went wrong'),
      );
    });
  });
});
