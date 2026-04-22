import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAbandonCaseActions } from '../useAbandonCaseActions';
import { caseService } from '../../services/caseService';
import { useToast } from '../../../../shared/providers/ToastProvider';

vi.mock('../../services/caseService');
vi.mock('../../../../shared/providers/ToastProvider');

describe('useAbandonCaseActions', () => {
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

  it('abandons case successfully', async () => {
    const mockAbandonedCase = {
      id: 'CASE-123',
      status: 'STATUS_90_ABANDONED',
    };
    (caseService.abandonCase as vi.Mock).mockResolvedValue(mockAbandonedCase);

    const { result } = renderHook(() =>
      useAbandonCaseActions(mockRefreshCases),
    );

    await result.current.handleAbandonSubmit('CASE-123', 'Test reason');

    await waitFor(() => {
      expect(caseService.abandonCase).toHaveBeenCalledWith('CASE-123', {
        reason: 'Test reason',
      });
      expect(mockSuccess).toHaveBeenCalled();
      expect(mockRefreshCases).toHaveBeenCalled();
    });
  });

  it('handles error when case cannot be abandoned', async () => {
    const error = new Error('Cannot abandon case other than draft status');
    (caseService.abandonCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useAbandonCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleAbandonSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalled();
      expect(mockRefreshCases).not.toHaveBeenCalled();
    });
  });

  it('handles unauthorized error', async () => {
    const error = new Error('Unauthorized');
    (caseService.abandonCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useAbandonCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleAbandonSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Abandon Case Failed',
        expect.stringContaining('Access denied'),
      );
    });
  });

  it('handles 403 error', async () => {
    const error = new Error('403 Forbidden');
    (caseService.abandonCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useAbandonCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleAbandonSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Abandon Case Failed',
        expect.stringContaining('Access denied'),
      );
    });
  });

  it('handles not found error', async () => {
    const error = new Error('Case not found 404');
    (caseService.abandonCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useAbandonCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleAbandonSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Abandon Case Failed',
        expect.stringContaining('Case not found'),
      );
    });
  });

  it('handles No complete new Case Task error', async () => {
    const error = new Error('No complete new Case Task exists');
    (caseService.abandonCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useAbandonCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleAbandonSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Abandon Case Failed',
        expect.stringContaining('Cannot abandon case (pending task)'),
      );
    });
  });

  it('handles generic backend error', async () => {
    const error = new Error('Something unexpected');
    (caseService.abandonCase as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() =>
      useAbandonCaseActions(mockRefreshCases),
    );

    await expect(
      result.current.handleAbandonSubmit('CASE-123', 'Test reason'),
    ).rejects.toThrow();

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Abandon Case Failed',
        'Something unexpected',
      );
    });
  });

  it('trims reason before sending', async () => {
    (caseService.abandonCase as vi.Mock).mockResolvedValue({});

    const { result } = renderHook(() =>
      useAbandonCaseActions(mockRefreshCases),
    );

    await result.current.handleAbandonSubmit('CASE-123', '  trimmed  ');

    expect(caseService.abandonCase).toHaveBeenCalledWith('CASE-123', {
      reason: 'trimmed',
    });
  });
});
