import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useReopenCaseActions } from '../useReopenCaseActions';
import { caseService } from '../../services/caseService';
import { useToast } from '../../../../shared/providers/ToastProvider';

vi.mock('../../services/caseService');
vi.mock('../../../../shared/providers/ToastProvider');

describe('useReopenCaseActions', () => {
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

  it('reopens case successfully', async () => {
    (caseService.reopenCase as vi.Mock).mockResolvedValue({});

    const { result } = renderHook(() => useReopenCaseActions(mockRefreshCases));

    await result.current.handleReopenSubmit('CASE-123', 'Test reason');

    await waitFor(() => {
      expect(caseService.reopenCase).toHaveBeenCalledWith('CASE-123', {
        reason: 'Test reason',
      });
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('trims reason before sending', async () => {
    (caseService.reopenCase as vi.Mock).mockResolvedValue({});

    const { result } = renderHook(() => useReopenCaseActions(mockRefreshCases));

    await result.current.handleReopenSubmit('CASE-123', '  Test reason  ');

    await waitFor(() => {
      expect(caseService.reopenCase).toHaveBeenCalledWith('CASE-123', {
        reason: 'Test reason',
      });
    });
  });

  it('handles not in a reopenable state error', async () => {
    const error = new Error('not in a reopenable state');
    (caseService.reopenCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useReopenCaseActions(mockRefreshCases));

    await expect(
      result.current.handleReopenSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Reopen Case Failed',
        expect.stringContaining('Unable to request reopening for this case'),
      );
    });
  });

  it('handles unauthorized error', async () => {
    const error = new Error('Unauthorized');
    (caseService.reopenCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useReopenCaseActions(mockRefreshCases));

    await expect(
      result.current.handleReopenSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Reopen Case Failed',
        expect.stringContaining('Access denied'),
      );
    });
  });

  it('handles 403 error', async () => {
    const error = new Error('403');
    (caseService.reopenCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useReopenCaseActions(mockRefreshCases));

    await expect(
      result.current.handleReopenSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Reopen Case Failed',
        expect.stringContaining('Access denied'),
      );
    });
  });

  it('handles not found error', async () => {
    const error = new Error('Case not found');
    (caseService.reopenCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useReopenCaseActions(mockRefreshCases));

    await expect(
      result.current.handleReopenSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Reopen Case Failed',
        expect.stringContaining('Case not found'),
      );
    });
  });

  it('handles 404 error', async () => {
    const error = new Error('404');
    (caseService.reopenCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useReopenCaseActions(mockRefreshCases));

    await expect(
      result.current.handleReopenSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Reopen Case Failed',
        expect.stringContaining('Case not found'),
      );
    });
  });

  it('handles generic error with message', async () => {
    const error = new Error('Generic error message');
    (caseService.reopenCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useReopenCaseActions(mockRefreshCases));

    await expect(
      result.current.handleReopenSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Reopen Case Failed',
        expect.stringContaining('Generic error message'),
      );
    });
  });

  it('handles error without message', async () => {
    const error = new Error('');
    (caseService.reopenCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useReopenCaseActions(mockRefreshCases));

    await expect(
      result.current.handleReopenSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Reopen Case Failed',
        expect.stringContaining('Something went wrong'),
      );
    });
  });
});
