import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useAlertOperations } from '../useAlertOperations';
import triageService from '../../services/triageservice';

vi.mock('../../services/triageservice');

describe('useAlertOperations', () => {
  const mockRefreshAlerts = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('initializes with empty operation states', () => {
    const { result } = renderHook(() => useAlertOperations(mockRefreshAlerts));

    expect(result.current.operationStates).toEqual({
      convertingToCase: new Set(),
      closingAlert: new Set(),
      updatingAlert: new Set(),
      loadingDetails: new Set(),
    });
  });

  it('provides handleCloseAlert function', () => {
    const { result } = renderHook(() => useAlertOperations(mockRefreshAlerts));

    expect(result.current.handleCloseAlert).toBeDefined();
    expect(typeof result.current.handleCloseAlert).toBe('function');
  });

  it('closes alert successfully and refreshes alerts', async () => {
    const mockAlert = {
      alert_id: 'alert-123',
      priority: 'URGENT',
    };
    (triageService.closeAlert as vi.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useAlertOperations(mockRefreshAlerts));

    await act(async () => {
      await result.current.handleCloseAlert(
        mockAlert as any,
        'STATUS_81_CLOSED_REFUTED',
        'Test notes',
      );
    });

    expect(triageService.closeAlert).toHaveBeenCalledWith(
      'alert-123',
      'STATUS_81_CLOSED_REFUTED',
      'Test notes',
    );
    expect(mockRefreshAlerts).toHaveBeenCalled();
  });

  it('tracks closing state during operation', async () => {
    const mockAlert = {
      alert_id: 'alert-123',
      priority: 'URGENT',
    };
    let resolveClose: () => void;
    const closePromise = new Promise<void>((resolve) => {
      resolveClose = resolve;
    });
    (triageService.closeAlert as vi.Mock).mockReturnValue(closePromise);

    const { result } = renderHook(() => useAlertOperations(mockRefreshAlerts));

    act(() => {
      result.current.handleCloseAlert(
        mockAlert as any,
        'STATUS_81_CLOSED_REFUTED',
        'Test notes',
      );
    });

    // Check that alert is in closing state
    await waitFor(() => {
      expect(result.current.operationStates.closingAlert.has('alert-123')).toBe(
        true,
      );
    });

    // Resolve the promise
    resolveClose!();
    await act(async () => {
      await closePromise;
    });

    // Check that alert is removed from closing state
    await waitFor(() => {
      expect(result.current.operationStates.closingAlert.has('alert-123')).toBe(
        false,
      );
    });
  });

  it('handles error when closing alert fails', async () => {
    const mockAlert = {
      alert_id: 'alert-123',
      priority: 'URGENT',
    };
    const error = new Error('Failed to close alert');
    (triageService.closeAlert as vi.Mock).mockRejectedValue(error);
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAlertOperations(mockRefreshAlerts));

    await expect(
      act(async () => {
        await result.current.handleCloseAlert(
          mockAlert as any,
          'STATUS_81_CLOSED_REFUTED',
          'Test notes',
        );
      }),
    ).rejects.toThrow('Failed to close alert');

    expect(consoleErrorSpy).toHaveBeenCalledWith('Error closing alert:', error);
    consoleErrorSpy.mockRestore();
  });

  it('cleans up operation state even on error', async () => {
    const mockAlert = {
      alert_id: 'alert-123',
      priority: 'URGENT',
    };
    const error = new Error('Failed to close alert');
    (triageService.closeAlert as vi.Mock).mockRejectedValue(error);
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { result } = renderHook(() => useAlertOperations(mockRefreshAlerts));

    try {
      await act(async () => {
        await result.current.handleCloseAlert(
          mockAlert as any,
          'STATUS_81_CLOSED_REFUTED',
          'Test notes',
        );
      });
    } catch {
      // Expected to throw
    }

    // State should be cleaned up even after error
    await waitFor(() => {
      expect(result.current.operationStates.closingAlert.has('alert-123')).toBe(
        false,
      );
    });
  });
});
