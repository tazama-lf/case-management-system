import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useResumeCaseActions } from '../useResumeCaseActions';
import { caseService } from '../../services/caseService';
import { useToast } from '../../../../shared/providers/ToastProvider';

vi.mock('../../services/caseService');
vi.mock('../../../../shared/providers/ToastProvider');

describe('useResumeCaseActions', () => {
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

  it('resumes case successfully', async () => {
    const mockResumedCase = {
      id: 'CASE-123',
      status: 'STATUS_20_IN_PROGRESS',
    };
    (caseService.resumeCase as vi.Mock).mockResolvedValue(mockResumedCase);

    const { result } = renderHook(() => useResumeCaseActions(mockRefreshCases));

    await result.current.handleResumeSubmit('CASE-123', 'Test reason');

    await waitFor(() => {
      expect(caseService.resumeCase).toHaveBeenCalledWith('CASE-123', {
        reason: 'Test reason',
      });
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('trims reason before sending', async () => {
    const mockResumedCase = {
      id: 'CASE-123',
      status: 'STATUS_20_IN_PROGRESS',
    };
    (caseService.resumeCase as vi.Mock).mockResolvedValue(mockResumedCase);

    const { result } = renderHook(() => useResumeCaseActions(mockRefreshCases));

    await result.current.handleResumeSubmit('CASE-123', '  Test reason  ');

    await waitFor(() => {
      expect(caseService.resumeCase).toHaveBeenCalledWith('CASE-123', {
        reason: 'Test reason',
      });
    });
  });

  it('handles not in a resumable state error', async () => {
    const error = new Error('not in a resumable state');
    (caseService.resumeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useResumeCaseActions(mockRefreshCases));

    await expect(
      result.current.handleResumeSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Resume Case Failed',
        expect.stringContaining('Unable to resume this case right now'),
      );
    });
  });

  it('handles unauthorized error', async () => {
    const error = new Error('Unauthorized');
    (caseService.resumeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useResumeCaseActions(mockRefreshCases));

    await expect(
      result.current.handleResumeSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Resume Case Failed',
        expect.stringContaining('Access denied'),
      );
    });
  });

  it('handles 403 error', async () => {
    const error = new Error('403');
    (caseService.resumeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useResumeCaseActions(mockRefreshCases));

    await expect(
      result.current.handleResumeSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Resume Case Failed',
        expect.stringContaining('Access denied'),
      );
    });
  });

  it('handles not found error', async () => {
    const error = new Error('Case not found');
    (caseService.resumeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useResumeCaseActions(mockRefreshCases));

    await expect(
      result.current.handleResumeSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Resume Case Failed',
        expect.stringContaining('Case not found'),
      );
    });
  });

  it('handles 404 error', async () => {
    const error = new Error('404');
    (caseService.resumeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useResumeCaseActions(mockRefreshCases));

    await expect(
      result.current.handleResumeSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Resume Case Failed',
        expect.stringContaining('Case not found'),
      );
    });
  });

  it('handles generic error with message', async () => {
    const error = new Error('Generic error message');
    (caseService.resumeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useResumeCaseActions(mockRefreshCases));

    await expect(
      result.current.handleResumeSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Resume Case Failed',
        expect.stringContaining('Generic error message'),
      );
    });
  });

  it('handles error without message', async () => {
    const error = new Error('');
    (caseService.resumeCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useResumeCaseActions(mockRefreshCases));

    await expect(
      result.current.handleResumeSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Resume Case Failed',
        expect.stringContaining('Something went wrong'),
      );
    });
  });
});
