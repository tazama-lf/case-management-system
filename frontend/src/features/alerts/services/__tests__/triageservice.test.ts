import triageService from '../triageservice';
import apiClient from '@/shared/services/apiClient';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    patch: vi.fn(),
  },
}));

const mockApi = apiClient as unknown as {
  get: vi.Mock;
  patch: vi.Mock;
};

describe('triageService', () => {
beforeEach(() => {
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

  it('builds query params when fetching alerts and hydrates each alert', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: [{ alert_id: 'ALERT-1', alert_type: 'AML' }],
      page: 1,
      limit: 10,
      total: 1,
      totalPages: 1,
    });

    const getAlertSpy = vi
      .spyOn(triageService, 'getAlertById')
      .mockResolvedValue({ alert_id: 'ALERT-1', alert_type: 'AML' } as any);

    await triageService.getAlerts({ priority: 'HIGH', limit: 5 });

    expect(mockApi.get).toHaveBeenCalledWith(
      '/api/v1/triage/alerts?priority=HIGH&limit=5&includeData=true',
    );
    expect(getAlertSpy).toHaveBeenCalledWith('ALERT-1');
  });

  it('throws when alert responses are invalid', async () => {
    mockApi.get.mockResolvedValueOnce({});

    await expect(triageService.getAlertById('missing')).rejects.toThrow(
      /Alert ID is missing from response/i,
    );
  });

  it('closes an alert with the correct payload', async () => {
    mockApi.patch.mockResolvedValueOnce({ alert_id: 'ALERT-1' });

    await triageService.closeAlert('ALERT-1', 'CLOSED' as any, 'Done');

    expect(mockApi.patch).toHaveBeenCalledWith(
      '/api/v1/triage/alerts/ALERT-1/close',
      { status: 'CLOSED', reason: 'Done' },
    );
  });
});

