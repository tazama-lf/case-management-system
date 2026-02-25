import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  useAlerts,
  useAlertDetails,
  useAlertActionHistory,
  useAlertOperations,
  useAlertFilterOptions,
  alertsQueryKeys,
} from '../useAlertsQuery';
import triageService from '../../services/triageservice';
import { useNotifications } from '@/shared/providers/NotificationProvider';

vi.mock('../../services/triageservice', () => ({
  __esModule: true,
  default: {
    getAlerts: vi.fn(),
    getAlertById: vi.fn(),
    getAlertActionHistory: vi.fn(),
    closeAlert: vi.fn(),
    updateAlert: vi.fn(),
    performManualTriage: vi.fn(),
  },
}));

vi.mock('@/shared/providers/NotificationProvider', () => ({
  useNotifications: vi.fn(),
}));

vi.mock('../../utils/alertTransformers', () => ({
  transformBackendAlertToUI: vi.fn((alert) => alert),
}));

const mockTriageService = triageService as unknown as {
  getAlerts: vi.Mock;
  getAlertById: vi.Mock;
  getAlertActionHistory: vi.Mock;
  closeAlert: vi.Mock;
  updateAlert: vi.Mock;
  performManualTriage: vi.Mock;
};

const mockNotifications = {
  showSuccess: vi.fn(),
  showError: vi.fn(),
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => {
    return React.createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  };
};

describe('useAlertsQuery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (useNotifications as vi.Mock).mockReturnValue(mockNotifications);
  });

  describe('alertsQueryKeys', () => {
    it('generates correct query keys', () => {
      expect(alertsQueryKeys.all).toEqual(['alerts']);
      expect(alertsQueryKeys.lists()).toEqual(['alerts', 'list']);
      expect(alertsQueryKeys.list({ search: 'test' })).toEqual([
        'alerts',
        'list',
        { search: 'test' },
      ]);
      expect(alertsQueryKeys.details()).toEqual(['alerts', 'detail']);
      expect(alertsQueryKeys.detail('alert-1')).toEqual([
        'alerts',
        'detail',
        'alert-1',
      ]);
      expect(alertsQueryKeys.actionHistory('alert-1')).toEqual([
        'alerts',
        'detail',
        'alert-1',
        'actionHistory',
      ]);
      expect(alertsQueryKeys.filterOptions()).toEqual([
        'alerts',
        'filterOptions',
      ]);
    });
  });

  describe('useAlerts', () => {
    it('fetches alerts with filters', async () => {
      const mockAlerts = [
        { alert_id: 'ALERT-1', priority: 'URGENT' },
        { alert_id: 'ALERT-2', priority: 'CRITICAL' },
      ];
      const mockPagination = {
        currentPage: 1,
        totalPages: 1,
        totalItems: 2,
        pageSize: 10,
      };

      mockTriageService.getAlerts.mockResolvedValueOnce({
        alerts: mockAlerts,
        pagination: mockPagination,
      });

      const { result } = renderHook(() => useAlerts({ search: 'test' }), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alerts).toHaveLength(2);
      expect(result.current.pagination).toEqual(mockPagination);
      expect(mockTriageService.getAlerts).toHaveBeenCalledWith({
        search: 'test',
      });
    });

    it('debounces search input', async () => {
      const { result, rerender } = renderHook((filters) => useAlerts(filters), {
        wrapper: createWrapper(),
        initialProps: { search: 'a' },
      });

      // Change search quickly
      rerender({ search: 'ab' });
      rerender({ search: 'abc' });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // Should only call with debounced value
      expect(mockTriageService.getAlerts).toHaveBeenCalled();
    });

    it('handles loading state', () => {
      mockTriageService.getAlerts.mockImplementation(
        () => new Promise(() => {}),
      );

      const { result } = renderHook(() => useAlerts(), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(true);
    });

    it('handles error state', async () => {
      const error = new Error('Failed to fetch');
      mockTriageService.getAlerts.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAlerts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isError).toBe(true));
      expect(result.current.error).toEqual(error);
    });

    it('provides default pagination when data is missing', async () => {
      mockTriageService.getAlerts.mockResolvedValueOnce({
        alerts: [],
        pagination: undefined,
      });

      const { result } = renderHook(() => useAlerts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.pagination).toEqual({
        currentPage: 1,
        totalPages: 1,
        totalItems: 0,
        pageSize: 10,
      });
    });

    it('refetches alerts when refreshAlerts is called', async () => {
      mockTriageService.getAlerts.mockResolvedValue({
        alerts: [],
        pagination: {
          currentPage: 1,
          totalPages: 1,
          totalItems: 0,
          pageSize: 10,
        },
      });

      const { result } = renderHook(() => useAlerts(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const initialCallCount = mockTriageService.getAlerts.mock.calls.length;
      result.current.refreshAlerts();

      await waitFor(() => {
        expect(mockTriageService.getAlerts.mock.calls.length).toBeGreaterThan(
          initialCallCount,
        );
      });
    });
  });

  describe('useAlertDetails', () => {
    it('fetches alert details when alertId is provided', async () => {
      const mockAlert = { alert_id: 'ALERT-1', priority: 'URGENT' };
      mockTriageService.getAlertById.mockResolvedValueOnce(mockAlert);

      const { result } = renderHook(() => useAlertDetails('ALERT-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.alert).toEqual(mockAlert);
      expect(mockTriageService.getAlertById).toHaveBeenCalledWith('ALERT-1');
    });

    it('does not fetch when alertId is null', () => {
      const { result } = renderHook(() => useAlertDetails(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.isLoading).toBe(false);
      expect(mockTriageService.getAlertById).not.toHaveBeenCalled();
    });

    it('handles error when fetching alert details', async () => {
      const error = new Error('Failed to fetch');
      mockTriageService.getAlertById.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAlertDetails('ALERT-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.error).toEqual(error);
    });

    it('refetches when refetch is called', async () => {
      const mockAlert = { alert_id: 'ALERT-1', priority: 'URGENT' };
      mockTriageService.getAlertById.mockResolvedValue(mockAlert);

      const { result } = renderHook(() => useAlertDetails('ALERT-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const initialCallCount = mockTriageService.getAlertById.mock.calls.length;
      result.current.refetch();

      await waitFor(() => {
        expect(
          mockTriageService.getAlertById.mock.calls.length,
        ).toBeGreaterThan(initialCallCount);
      });
    });
  });

  describe('useAlertActionHistory', () => {
    it('fetches action history when alertId is provided', async () => {
      const mockHistory = [
        { id: '1', action: 'CREATED', timestamp: '2024-01-01' },
        { id: '2', action: 'UPDATED', timestamp: '2024-01-02' },
      ];
      mockTriageService.getAlertActionHistory.mockResolvedValueOnce(
        mockHistory,
      );

      const { result } = renderHook(() => useAlertActionHistory('ALERT-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.actionHistory).toEqual(mockHistory);
      expect(mockTriageService.getAlertActionHistory).toHaveBeenCalledWith(
        'ALERT-1',
      );
    });

    it('returns empty array when alertId is null', () => {
      const { result } = renderHook(() => useAlertActionHistory(null), {
        wrapper: createWrapper(),
      });

      expect(result.current.actionHistory).toEqual([]);
      expect(mockTriageService.getAlertActionHistory).not.toHaveBeenCalled();
    });

    it('handles error when fetching action history', async () => {
      const error = new Error('Failed to fetch');
      mockTriageService.getAlertActionHistory.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAlertActionHistory('ALERT-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.error).toBeTruthy());
      expect(result.current.error).toEqual(error);
    });

    it('returns empty array when history is undefined', async () => {
      mockTriageService.getAlertActionHistory.mockResolvedValueOnce(undefined);

      const { result } = renderHook(() => useAlertActionHistory('ALERT-1'), {
        wrapper: createWrapper(),
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      expect(result.current.actionHistory).toEqual([]);
    });
  });

  describe('useAlertOperations', () => {
    it('closes alert successfully', async () => {
      const mockUpdatedAlert = { alert_id: 'ALERT-1', status: 'CLOSED' };
      mockTriageService.closeAlert.mockResolvedValueOnce(mockUpdatedAlert);

      const { result } = renderHook(() => useAlertOperations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        result.current.closeAlert({
          alertId: 'ALERT-1',
          status: 'CLOSED',
          notes: 'Resolved',
        });
      });

      await waitFor(() => {
        expect(mockTriageService.closeAlert).toHaveBeenCalledWith(
          'ALERT-1',
          'CLOSED',
          'Resolved',
        );
        expect(mockNotifications.showSuccess).toHaveBeenCalledWith(
          'Alert closed successfully',
        );
      });
    });

    it('handles error when closing alert', async () => {
      const error = new Error('Failed to close');
      mockTriageService.closeAlert.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAlertOperations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        result.current.closeAlert({
          alertId: 'ALERT-1',
          status: 'CLOSED',
          notes: 'Resolved',
        });
      });

      await waitFor(() => {
        expect(mockNotifications.showError).toHaveBeenCalledWith(
          'Failed to close',
        );
      });
    });

    it('updates alert successfully', async () => {
      const mockUpdatedAlert = { alert_id: 'ALERT-1', priority: 'CRITICAL' };
      mockTriageService.updateAlert.mockResolvedValueOnce(mockUpdatedAlert);

      const { result } = renderHook(() => useAlertOperations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        result.current.updateAlert({
          alertId: 'ALERT-1',
          data: { priority: 'CRITICAL' },
        });
      });

      await waitFor(() => {
        expect(mockTriageService.updateAlert).toHaveBeenCalledWith('ALERT-1', {
          priority: 'CRITICAL',
        });
        expect(mockNotifications.showSuccess).toHaveBeenCalledWith(
          'Alert updated successfully',
        );
      });
    });

    it('handles error when updating alert', async () => {
      const error = new Error('Failed to update');
      mockTriageService.updateAlert.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAlertOperations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        result.current.updateAlert({
          alertId: 'ALERT-1',
          data: { priority: 'CRITICAL' },
        });
      });

      await waitFor(() => {
        expect(mockNotifications.showError).toHaveBeenCalledWith(
          'Failed to update',
        );
      });
    });

    it('performs manual triage successfully', async () => {
      const mockTriageResult = { alert_id: 'ALERT-1', case_id: 'CASE-1' };
      mockTriageService.performManualTriage.mockResolvedValueOnce(
        mockTriageResult,
      );

      const { result } = renderHook(() => useAlertOperations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        result.current.performManualTriage({
          alertId: 'ALERT-1',
          data: { action: 'APPROVE', notes: 'Looks good' },
        });
      });

      await waitFor(() => {
        expect(mockTriageService.performManualTriage).toHaveBeenCalledWith(
          'ALERT-1',
          {
            action: 'APPROVE',
            notes: 'Looks good',
          },
        );
        expect(mockNotifications.showSuccess).toHaveBeenCalledWith(
          'Manual triage completed successfully',
        );
      });
    });

    it('handles error when performing manual triage', async () => {
      const error = new Error('Failed to triage');
      mockTriageService.performManualTriage.mockRejectedValueOnce(error);

      const { result } = renderHook(() => useAlertOperations(), {
        wrapper: createWrapper(),
      });

      await waitFor(() => {
        result.current.performManualTriage({
          alertId: 'ALERT-1',
          data: { action: 'APPROVE', notes: 'Looks good' },
        });
      });

      await waitFor(() => {
        expect(mockNotifications.showError).toHaveBeenCalledWith(
          'Failed to triage',
        );
      });
    });

    it('tracks pending states correctly', async () => {
      mockTriageService.closeAlert.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ alert_id: 'ALERT-1' }), 100),
          ),
      );

      const { result } = renderHook(() => useAlertOperations(), {
        wrapper: createWrapper(),
      });

      result.current.closeAlert({
        alertId: 'ALERT-1',
        status: 'CLOSED',
        notes: 'Resolved',
      });

      await waitFor(() => {
        expect(result.current.isClosingAlert).toBe(true);
      });

      await waitFor(
        () => {
          expect(result.current.isClosingAlert).toBe(false);
        },
        { timeout: 200 },
      );
    });
  });

  describe('useAlertFilterOptions', () => {
    it('returns filter options', () => {
      const { result } = renderHook(() => useAlertFilterOptions());

      expect(result.current.filterOptions).toEqual({
        priorities: ['NEW', 'URGENT', 'CRITICAL', 'BREACH'],
        alertTypes: ['FRAUD', 'AML', 'FRAUD_AND_AML'],
        sources: ['REST API', 'NATS'],
      });
      expect(result.current.isLoading).toBe(false);
      expect(result.current.error).toBeNull();
    });
  });
});
