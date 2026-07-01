import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useAlerts } from '../useAlerts';
import triageService from '../../services/triageservice';
import { transformBackendAlertToUI } from '../../utils/alertTransformers';

vi.mock('../../services/triageservice', () => ({
  __esModule: true,
  default: {
    getAlerts: vi.fn(),
  },
}));

vi.mock('../../utils/alertTransformers', () => ({
  transformBackendAlertToUI: vi.fn(),
}));

const mockService = triageService as unknown as { getAlerts: vi.Mock };
const mockTransformer = transformBackendAlertToUI as vi.Mock;

const backendAlert = {
  alert_id: 'ALERT-1',
  priority: 'URGENT',
  created_at: '2024-01-01T00:00:00Z',
};
const uiAlert = {
  alert_id: 'ALERT-1',
  priority: 'URGENT',
  created_at: '2024-01-01T00:00:00Z',
  message: 'Test',
  txtp: 'tx-1',
  source: 'REST API',
  alert_type: 'FRAUD',
};

const createDeferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, resolve, reject };
};

describe('useAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches alerts and exposes paginated results', async () => {
    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(uiAlert);

    const { result } = renderHook(() => useAlerts());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.paginatedAlerts).toHaveLength(1);
    expect(result.current.error).toBeNull();
  });

  it('handles fetch failures', async () => {
    mockService.getAlerts.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('boom');
  });

  it('handles fetch failures with non-Error objects', async () => {
    mockService.getAlerts.mockRejectedValueOnce('string error');

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe('An unknown error occurred');
  });

  it('applies filters and sorting', async () => {
    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(uiAlert);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ priority: 'urgent' });
      result.current.setSort('priority', 'asc');
      result.current.setPageSize(5);
      result.current.setPage(2);
    });

    expect(result.current.pagination.pageSize).toBe(5);
    expect(result.current.pagination.currentPage).toBe(2);
  });

  it('sends query search to the server', async () => {
    mockService.getAlerts.mockResolvedValue({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(uiAlert);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ query: 'fraud' });
    });

    await waitFor(() => {
      expect(mockService.getAlerts).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'fraud' }),
      );
    });
  });

  it('sends displayed ALERT-prefixed ids to the server', async () => {
    mockService.getAlerts.mockResolvedValue({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(uiAlert);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ query: 'ALERT-27' });
    });

    await waitFor(() => {
      expect(mockService.getAlerts).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'ALERT-27' }),
      );
    });
  });

  it('ignores stale responses when a filtered request finishes first', async () => {
    const slowUnfilteredRequest = createDeferred<{
      alerts: (typeof backendAlert)[];
      pagination: { totalItems: number; totalPages: number };
    }>();
    const fastFilteredRequest = createDeferred<{
      alerts: (typeof backendAlert)[];
      pagination: { totalItems: number; totalPages: number };
    }>();

    const unfilteredAlert = { ...backendAlert, alert_id: 'ALERT-27' };
    const filteredAlert = { ...backendAlert, alert_id: 'ALERT-24' };

    mockService.getAlerts
      .mockReturnValueOnce(slowUnfilteredRequest.promise)
      .mockReturnValueOnce(fastFilteredRequest.promise);
    mockTransformer.mockImplementation((alert) => alert);

    const { result } = renderHook(() => useAlerts());

    await waitFor(() => expect(mockService.getAlerts).toHaveBeenCalledTimes(1));

    act(() => {
      result.current.setFilters({ query: '24' });
    });

    await waitFor(() => expect(mockService.getAlerts).toHaveBeenCalledTimes(2));

    await act(async () => {
      fastFilteredRequest.resolve({
        alerts: [filteredAlert],
        pagination: { totalItems: 1, totalPages: 1 },
      });
    });

    await waitFor(() => {
      expect(result.current.paginatedAlerts).toEqual([filteredAlert]);
    });

    await act(async () => {
      slowUnfilteredRequest.resolve({
        alerts: [unfilteredAlert],
        pagination: { totalItems: 10, totalPages: 1 },
      });
    });

    expect(result.current.paginatedAlerts).toEqual([filteredAlert]);
    expect(result.current.pagination.totalItems).toBe(1);
  });

  it('filters alerts by source', async () => {
    const alert1 = { ...uiAlert, source: 'REST API' };

    mockService.getAlerts.mockResolvedValue({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(alert1);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ source: 'REST API' });
    });

    // Source filter is sent server-side
    await waitFor(() => {
      expect(mockService.getAlerts).toHaveBeenCalledWith(
        expect.objectContaining({ source: 'REST API' }),
      );
    });
  });

  it('filters alerts by type', async () => {
    const alert1 = { ...uiAlert, alert_type: 'FRAUD' };

    mockService.getAlerts.mockResolvedValue({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(alert1);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ type: 'FRAUD' });
    });

    // Type filter is sent server-side as alertType
    await waitFor(() => {
      expect(mockService.getAlerts).toHaveBeenCalledWith(
        expect.objectContaining({ alertType: 'FRAUD' }),
      );
    });
  });

  it('filters alerts by priority', async () => {
    const alert1 = { ...uiAlert, priority: 'URGENT' };

    mockService.getAlerts.mockResolvedValue({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(alert1);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ priority: 'URGENT' });
    });

    // Priority filter is sent server-side
    await waitFor(() => {
      expect(mockService.getAlerts).toHaveBeenCalledWith(
        expect.objectContaining({ priority: 'URGENT' }),
      );
    });
  });

  it('sends today time range dates to the server', async () => {
    mockService.getAlerts.mockResolvedValue({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(uiAlert);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ timeRange: 'today' });
    });

    await waitFor(() => {
      expect(mockService.getAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expect.any(String),
          endDate: expect.any(String),
        }),
      );
    });
  });

  it('sends custom date range to the server', async () => {
    const startDate = '2024-01-01';
    const endDate = '2024-01-31';
    const expectedStartDate = new Date(2024, 0, 1, 0, 0, 0, 0).toISOString();
    const expectedEndDate = new Date(
      2024,
      0,
      31,
      23,
      59,
      59,
      999,
    ).toISOString();
    mockService.getAlerts.mockResolvedValue({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(uiAlert);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({
        timeRange: 'custom',
        customDateRange: { startDate, endDate },
      });
    });

    await waitFor(() => {
      expect(mockService.getAlerts).toHaveBeenCalledWith(
        expect.objectContaining({
          startDate: expectedStartDate,
          endDate: expectedEndDate,
        }),
      );
    });
  });

  it('sorts alerts ascending', async () => {
    const alert1 = { ...uiAlert, alert_id: 'ALERT-1', priority: 'A' };
    const alert2 = { ...uiAlert, alert_id: 'ALERT-2', priority: 'B' };

    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert, { ...backendAlert, alert_id: 'ALERT-2' }],
      pagination: { totalItems: 2, totalPages: 1 },
    });
    mockTransformer.mockReturnValueOnce(alert1).mockReturnValueOnce(alert2);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setSort('priority', 'asc');
    });

    await waitFor(() => {
      const filtered = result.current.filteredAlerts;
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  it('sorts alerts descending', async () => {
    const alert1 = { ...uiAlert, alert_id: 'ALERT-1', priority: 'A' };
    const alert2 = { ...uiAlert, alert_id: 'ALERT-2', priority: 'B' };

    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert, { ...backendAlert, alert_id: 'ALERT-2' }],
      pagination: { totalItems: 2, totalPages: 1 },
    });
    mockTransformer.mockReturnValueOnce(alert1).mockReturnValueOnce(alert2);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setSort('priority', 'desc');
    });

    await waitFor(() => {
      const filtered = result.current.filteredAlerts;
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  it('handles pagination correctly', async () => {
    mockService.getAlerts.mockResolvedValue({
      alerts: [backendAlert],
      pagination: { totalItems: 25, totalPages: 3 },
    });
    mockTransformer.mockReturnValue(uiAlert);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setPageSize(10);
    });

    await waitFor(() => {
      expect(result.current.pagination.pageSize).toBe(10);
    });

    act(() => {
      result.current.setPage(2);
    });

    await waitFor(() => {
      expect(result.current.pagination.currentPage).toBe(2);
    });
  });

  it('resets page to 1 when filters change', async () => {
    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(uiAlert);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setPage(3);
      result.current.setFilters({ priority: 'URGENT' });
    });

    expect(result.current.pagination.currentPage).toBe(1);
  });

  it('resets page to 1 when sort changes', async () => {
    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(uiAlert);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setPage(3);
      result.current.setSort('priority', 'asc');
    });

    expect(result.current.pagination.currentPage).toBe(1);
  });

  it('sends transaction-like search terms to the server', async () => {
    mockService.getAlerts.mockResolvedValue({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(uiAlert);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ query: 'tx-123' });
    });

    await waitFor(() => {
      expect(mockService.getAlerts).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'tx-123' }),
      );
    });
  });

  it('refreshes alerts when refreshAlerts is called', async () => {
    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(uiAlert);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.refreshAlerts();
    });

    await waitFor(() => {
      expect(mockService.getAlerts).toHaveBeenCalledTimes(2);
    });
  });
});
