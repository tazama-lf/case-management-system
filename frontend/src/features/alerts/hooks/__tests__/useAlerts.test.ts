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

const backendAlert = { alert_id: 'ALERT-1', priority: 'URGENT' };
const uiAlert = { alert_id: 'ALERT-1', priority: 'URGENT', created_at: '2024-01-01' };

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
});

