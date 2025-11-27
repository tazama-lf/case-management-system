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

  describe('getAlerts', () => {
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

    it('handles all filter parameters', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
      });

      vi.spyOn(triageService, 'getAlertById').mockResolvedValue({ alert_id: 'ALERT-1' } as any);

      await triageService.getAlerts({
        priority: 'URGENT',
        type: 'FRAUD',
        alertType: 'AML',
        source: 'REST API',
        search: 'test',
        reportStatus: 'OPEN',
        page: 2,
        limit: 20,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });

      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('priority=URGENT'),
      );
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('type=FRAUD'),
      );
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('alertType=AML'),
      );
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('source=REST+API'),
      );
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('search=test'),
      );
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('reportStatus=OPEN'),
      );
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('page=2'),
      );
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('limit=20'),
      );
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('sortBy=created_at'),
      );
      expect(mockApi.get).toHaveBeenCalledWith(
        expect.stringContaining('sortOrder=desc'),
      );
    });

    it('handles empty query string', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: [],
        page: 1,
        limit: 10,
        total: 0,
        totalPages: 1,
      });

      vi.spyOn(triageService, 'getAlertById').mockResolvedValue({ alert_id: 'ALERT-1' } as any);

      await triageService.getAlerts({});

      expect(mockApi.get).toHaveBeenCalledWith('/api/v1/triage/alerts?includeData=true');
    });

    it('handles failed detail fetch gracefully', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: [
          { alert_id: 'ALERT-1', alert_type: 'AML' },
          { alert_id: 'ALERT-2', alert_type: 'FRAUD' },
        ],
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });

      const getAlertSpy = vi
        .spyOn(triageService, 'getAlertById')
        .mockResolvedValueOnce({ alert_id: 'ALERT-1', alert_type: 'AML' } as any)
        .mockRejectedValueOnce(new Error('Failed to fetch'));

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const result = await triageService.getAlerts({});

      expect(result.alerts).toHaveLength(2);
      expect(result.alerts[0].alert_id).toBe('ALERT-1');
      expect(result.alerts[1].alert_id).toBe('ALERT-2');
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to fetch details for alert ALERT-2'),
        expect.any(Error),
      );

      consoleWarnSpy.mockRestore();
    });

    it('merges alert_type from detailed alert', async () => {
      mockApi.get.mockResolvedValueOnce({
        data: [{ alert_id: 'ALERT-1', alert_type: 'AML' }],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      });

      const detailedAlert = { alert_id: 'ALERT-1', alert_type: 'FRAUD' };
      vi.spyOn(triageService, 'getAlertById').mockResolvedValue(detailedAlert as any);

      const result = await triageService.getAlerts({});

      expect(result.alerts[0].alert_type).toBe('FRAUD');
    });
  });

  describe('getFilterOptions', () => {
    it('fetches filter options successfully', async () => {
      const mockOptions = {
        priorities: ['NEW', 'URGENT'],
        statuses: ['OPEN', 'CLOSED'],
        alertTypes: ['FRAUD', 'AML'],
        sources: ['REST API', 'NATS'],
      };

      mockApi.get.mockResolvedValueOnce(mockOptions);

      const result = await triageService.getFilterOptions();

      expect(result).toEqual(mockOptions);
      expect(mockApi.get).toHaveBeenCalledWith('/api/v1/triage/alerts/filter-options');
    });

    it('handles error when fetching filter options', async () => {
      const error = { response: { data: { message: 'Failed to fetch' } } };
      mockApi.get.mockRejectedValueOnce(error);

      await expect(triageService.getFilterOptions()).rejects.toThrow('Failed to fetch');
    });
  });

  describe('getAlertById', () => {
    it('fetches alert by id successfully', async () => {
      const mockAlert = { alert_id: 'ALERT-1', priority: 'URGENT' };
      mockApi.get.mockResolvedValueOnce(mockAlert);

      const result = await triageService.getAlertById('ALERT-1');

      expect(result).toEqual(mockAlert);
      expect(mockApi.get).toHaveBeenCalledWith('/api/v1/triage/alerts/ALERT-1');
    });

    it('throws when alert responses are invalid - missing data', async () => {
      mockApi.get.mockResolvedValueOnce(null);

      await expect(triageService.getAlertById('missing')).rejects.toThrow(
        /Invalid alert data received/i,
      );
    });

    it('throws when alert responses are invalid - missing alert_id', async () => {
      mockApi.get.mockResolvedValueOnce({});

      await expect(triageService.getAlertById('missing')).rejects.toThrow(
        /Alert ID is missing from response/i,
      );
    });

    it('handles error with response data', async () => {
      const error = { response: { data: { message: 'Not found' } } };
      mockApi.get.mockRejectedValueOnce(error);

      await expect(triageService.getAlertById('ALERT-1')).rejects.toThrow('Not found');
    });

    it('handles error with message', async () => {
      const error = { message: 'Network error' };
      mockApi.get.mockRejectedValueOnce(error);

      await expect(triageService.getAlertById('ALERT-1')).rejects.toThrow('Network error');
    });

    it('handles error without message or response', async () => {
      const error = {};
      mockApi.get.mockRejectedValueOnce(error);

      await expect(triageService.getAlertById('ALERT-1')).rejects.toThrow(
        /Failed to fetch alert details/i,
      );
    });
  });

  describe('getAlertActionHistory', () => {
    it('fetches action history successfully', async () => {
      const mockHistory = [
        { id: '1', action: 'CREATED', timestamp: '2024-01-01' },
        { id: '2', action: 'UPDATED', timestamp: '2024-01-02' },
      ];
      mockApi.get.mockResolvedValueOnce({ history: mockHistory });

      const result = await triageService.getAlertActionHistory('ALERT-1');

      expect(result).toEqual(mockHistory);
      expect(mockApi.get).toHaveBeenCalledWith('/api/v1/triage/alerts/ALERT-1/action-history');
    });

    it('handles error when fetching action history', async () => {
      const error = { response: { data: { message: 'Failed to fetch' } } };
      mockApi.get.mockRejectedValueOnce(error);

      await expect(triageService.getAlertActionHistory('ALERT-1')).rejects.toThrow(
        'Failed to fetch',
      );
    });
  });

  describe('performManualTriage', () => {
    it('performs manual triage successfully', async () => {
      const mockTriageData = { action: 'APPROVE', notes: 'Looks good' };
      const mockResult = { alert_id: 'ALERT-1', case_id: 'CASE-1' };
      mockApi.patch.mockResolvedValueOnce(mockResult);

      const result = await triageService.performManualTriage('ALERT-1', mockTriageData);

      expect(result).toEqual(mockResult);
      expect(mockApi.patch).toHaveBeenCalledWith(
        '/api/v1/triage/alerts/ALERT-1',
        mockTriageData,
      );
    });

    it('handles error when performing manual triage', async () => {
      const error = { response: { data: { message: 'Failed to triage' } } };
      mockApi.patch.mockRejectedValueOnce(error);

      await expect(
        triageService.performManualTriage('ALERT-1', { action: 'APPROVE', notes: 'Test' }),
      ).rejects.toThrow('Failed to triage');
    });
  });

  describe('updateAlert', () => {
    it('updates alert successfully', async () => {
      const mockUpdateData = { priority: 'CRITICAL' };
      const mockResult = { alert_id: 'ALERT-1', priority: 'CRITICAL' };
      mockApi.patch.mockResolvedValueOnce(mockResult);

      const result = await triageService.updateAlert('ALERT-1', mockUpdateData);

      expect(result).toEqual(mockResult);
      expect(mockApi.patch).toHaveBeenCalledWith('/api/v1/triage/alerts/ALERT-1', mockUpdateData);
    });

    it('handles error when updating alert', async () => {
      const error = { response: { data: { message: 'Failed to update' } } };
      mockApi.patch.mockRejectedValueOnce(error);

      await expect(triageService.updateAlert('ALERT-1', { priority: 'CRITICAL' })).rejects.toThrow(
        'Failed to update',
      );
    });
  });

  describe('closeAlert', () => {
    it('closes an alert with the correct payload', async () => {
      mockApi.patch.mockResolvedValueOnce({ alert_id: 'ALERT-1', status: 'CLOSED' });

      const result = await triageService.closeAlert('ALERT-1', 'CLOSED' as any, 'Done');

      expect(result.alert_id).toBe('ALERT-1');
      expect(mockApi.patch).toHaveBeenCalledWith('/api/v1/triage/alerts/ALERT-1/close', {
        status: 'CLOSED',
        reason: 'Done',
      });
    });

    it('handles error when closing alert', async () => {
      const error = { response: { data: { message: 'Failed to close' } } };
      mockApi.patch.mockRejectedValueOnce(error);

      await expect(triageService.closeAlert('ALERT-1', 'CLOSED' as any, 'Done')).rejects.toThrow(
        'Failed to close',
      );
    });
  });

  describe('getNALTAlerts', () => {
    it('fetches NALT alerts without search', async () => {
      const mockAlerts = [
        { alert_id: 'ALERT-1', reportStatus: 'NALT' },
        { alert_id: 'ALERT-2', reportStatus: 'NALT' },
      ];

      const getAlertsSpy = vi
        .spyOn(triageService, 'getAlerts')
        .mockResolvedValueOnce({
          alerts: mockAlerts,
          pagination: { currentPage: 1, totalPages: 1, totalItems: 2, pageSize: 100 },
        });

      const result = await triageService.getNALTAlerts();

      expect(result).toEqual(mockAlerts);
      expect(getAlertsSpy).toHaveBeenCalledWith({
        reportStatus: 'NALT',
        limit: 100,
        page: 1,
      });
    });

    it('fetches NALT alerts with search', async () => {
      const mockAlerts = [{ alert_id: 'ALERT-1', reportStatus: 'NALT' }];

      const getAlertsSpy = vi
        .spyOn(triageService, 'getAlerts')
        .mockResolvedValueOnce({
          alerts: mockAlerts,
          pagination: { currentPage: 1, totalPages: 1, totalItems: 1, pageSize: 100 },
        });

      const result = await triageService.getNALTAlerts('test search');

      expect(result).toEqual(mockAlerts);
      expect(getAlertsSpy).toHaveBeenCalledWith({
        reportStatus: 'NALT',
        limit: 100,
        page: 1,
        search: 'test search',
      });
    });

    it('handles error when fetching NALT alerts', async () => {
      const getAlertsSpy = vi
        .spyOn(triageService, 'getAlerts')
        .mockRejectedValueOnce(new Error('Failed to fetch'));

      await expect(triageService.getNALTAlerts()).rejects.toThrow('Failed to fetch');
      expect(getAlertsSpy).toHaveBeenCalled();
    });
  });
});

