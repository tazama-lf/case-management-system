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

const backendAlert = { alert_id: 'ALERT-1', priority: 'URGENT', created_at: '2024-01-01T00:00:00Z' };
const uiAlert = { alert_id: 'ALERT-1', priority: 'URGENT', created_at: '2024-01-01T00:00:00Z', message: 'Test', txtp: 'tx-1', source: 'REST API', alert_type: 'FRAUD' };

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

  it('filters alerts by query string', async () => {
    const alert1 = { ...uiAlert, alert_id: 'ALERT-1', message: 'Fraud detected' };
    const alert2 = { ...uiAlert, alert_id: 'ALERT-2', message: 'AML check' };
    
    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert, { ...backendAlert, alert_id: 'ALERT-2' }],
      pagination: { totalItems: 2, totalPages: 1 },
    });
    mockTransformer.mockReturnValueOnce(alert1).mockReturnValueOnce(alert2);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ query: 'fraud' });
    });

    await waitFor(() => {
      const filtered = result.current.filteredAlerts;
      expect(filtered.some(a => a.message?.toLowerCase().includes('fraud'))).toBe(true);
    });
  });

  it('filters alerts by source', async () => {
    const alert1 = { ...uiAlert, source: 'REST API' };
    const alert2 = { ...uiAlert, alert_id: 'ALERT-2', source: 'NATS' };
    
    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert, { ...backendAlert, alert_id: 'ALERT-2' }],
      pagination: { totalItems: 2, totalPages: 1 },
    });
    mockTransformer.mockReturnValueOnce(alert1).mockReturnValueOnce(alert2);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ source: 'REST API' });
    });

    await waitFor(() => {
      const filtered = result.current.filteredAlerts;
      expect(filtered.every(a => (a.source || '').toLowerCase() === 'rest api')).toBe(true);
    });
  });

  it('filters alerts by type', async () => {
    const alert1 = { ...uiAlert, alert_type: 'FRAUD' };
    const alert2 = { ...uiAlert, alert_id: 'ALERT-2', alert_type: 'AML' };
    
    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert, { ...backendAlert, alert_id: 'ALERT-2' }],
      pagination: { totalItems: 2, totalPages: 1 },
    });
    mockTransformer.mockReturnValueOnce(alert1).mockReturnValueOnce(alert2);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ type: 'FRAUD' });
    });

    await waitFor(() => {
      const filtered = result.current.filteredAlerts;
      expect(filtered.every(a => (a.alert_type || '').toLowerCase() === 'fraud')).toBe(true);
    });
  });

  it('filters alerts by priority', async () => {
    const alert1 = { ...uiAlert, priority: 'URGENT' };
    const alert2 = { ...uiAlert, alert_id: 'ALERT-2', priority: 'CRITICAL' };
    
    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert, { ...backendAlert, alert_id: 'ALERT-2' }],
      pagination: { totalItems: 2, totalPages: 1 },
    });
    mockTransformer.mockReturnValueOnce(alert1).mockReturnValueOnce(alert2);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ priority: 'URGENT' });
    });

    await waitFor(() => {
      const filtered = result.current.filteredAlerts;
      expect(filtered.every(a => (a.priority || '').toLowerCase() === 'urgent')).toBe(true);
    });
  });

  it('filters alerts by time range - today', async () => {
    const today = new Date();
    const todayAlert = { ...uiAlert, created_at: today.toISOString() };
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayAlert = { ...uiAlert, alert_id: 'ALERT-2', created_at: yesterday.toISOString() };
    
    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert, { ...backendAlert, alert_id: 'ALERT-2' }],
      pagination: { totalItems: 2, totalPages: 1 },
    });
    mockTransformer.mockReturnValueOnce(todayAlert).mockReturnValueOnce(yesterdayAlert);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ timeRange: 'today' });
    });

    await waitFor(() => {
      const filtered = result.current.filteredAlerts;
      expect(filtered.length).toBeGreaterThan(0);
    });
  });

  it('filters alerts by custom date range', async () => {
    const startDate = '2024-01-01';
    const endDate = '2024-01-31';
    const inRangeAlert = { ...uiAlert, created_at: '2024-01-15T00:00:00Z' };
    const outOfRangeAlert = { ...uiAlert, alert_id: 'ALERT-2', created_at: '2024-02-15T00:00:00Z' };
    
    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert, { ...backendAlert, alert_id: 'ALERT-2' }],
      pagination: { totalItems: 2, totalPages: 1 },
    });
    mockTransformer.mockReturnValueOnce(inRangeAlert).mockReturnValueOnce(outOfRangeAlert);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ 
        timeRange: 'custom',
        customDateRange: { startDate, endDate }
      });
    });

    await waitFor(() => {
      const filtered = result.current.filteredAlerts;
      expect(filtered.length).toBeGreaterThan(0);
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
    const alerts = Array.from({ length: 25 }, (_, i) => ({
      ...uiAlert,
      alert_id: `ALERT-${i + 1}`,
    }));
    
    mockService.getAlerts.mockResolvedValueOnce({
      alerts: alerts.map(() => backendAlert),
      pagination: { totalItems: 25, totalPages: 3 },
    });
    alerts.forEach(() => mockTransformer.mockReturnValueOnce(uiAlert));

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setPageSize(10);
      result.current.setPage(2);
    });

    await waitFor(() => {
      expect(result.current.pagination.currentPage).toBe(2);
      expect(result.current.pagination.pageSize).toBe(10);
      expect(result.current.paginatedAlerts.length).toBeLessThanOrEqual(10);
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

  it('searches in transaction JSON and network map', async () => {
    const alertWithTransaction = {
      ...uiAlert,
      transaction: { id: 'tx-123', amount: 1000 },
      network_map: { nodes: [{ id: 'node-1' }] },
    };
    
    mockService.getAlerts.mockResolvedValueOnce({
      alerts: [backendAlert],
      pagination: { totalItems: 1, totalPages: 1 },
    });
    mockTransformer.mockReturnValue(alertWithTransaction);

    const { result } = renderHook(() => useAlerts());
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.setFilters({ query: 'tx-123' });
    });

    await waitFor(() => {
      const filtered = result.current.filteredAlerts;
      expect(filtered.length).toBeGreaterThan(0);
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

