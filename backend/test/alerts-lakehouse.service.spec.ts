import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AlertsLakehouseService } from '../src/modules/gold-lakehouse/alerts-lakehouse.service';

describe('AlertsLakehouseService', () => {
  let service: AlertsLakehouseService;
  let http: jest.Mock;

  const okHttp = (rows: any[] = [{}]) =>
    of({
      data: { status: 'success', data: rows, code: 200 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

  const errHttp = (msg = 'fail') => throwError(() => new Error(msg));

  beforeEach(async () => {
    http = jest.fn().mockReturnValue(okHttp());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AlertsLakehouseService,
        { provide: HttpService, useValue: { post: http } },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn(() => 'http://localhost:5000'),
            get: jest.fn((key: string, def?: any) => {
              if (key === 'GOLD_LAKEHOUSE_TIMEOUT') return 30000;
              if (key === 'ALERT_HISTORY_FALLBACK_E2E_ID') return 'fallback-e2e-id';
              return def;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AlertsLakehouseService>(AlertsLakehouseService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  // ===================== getAlertNavigatorMetrics =====================
  describe('getAlertNavigatorMetrics', () => {
    it('returns metrics', async () => {
      http.mockReturnValue(okHttp([{ total_typologies: 3, total_rules: 10, avg_typology_score: 80 }]));
      const result = await service.getAlertNavigatorMetrics(1, 'DEFAULT');
      expect(result.total_typologies).toBe(3);
      expect(result.alertId).toBe(1);
    });

    it('handles empty row with defaults', async () => {
      http.mockReturnValue(okHttp([{ total_typologies: 0, total_rules: 0, avg_typology_score: null }]));
      const result = await service.getAlertNavigatorMetrics(1);
      expect(result.total_typologies).toBe(0);
      expect(result.avg_typology_score).toBeNull();
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getAlertNavigatorMetrics(1)).rejects.toThrow(HttpException);
    });
  });

  // ===================== getAlertNavigatorData =====================
  describe('getAlertNavigatorData', () => {
    it('returns alert navigator data with matched rules', async () => {
      http
        .mockReturnValueOnce(
          okHttp([
            {
              alert_id: 1,
              alert_status: 'OPEN',
              alert_tx_type: 'PAYMENT',
              alert_tx_amount: 100,
              alert_tx_ccy: 'USD',
              created_at_ts: '2024-01-01',
            },
          ]),
        )
        .mockReturnValueOnce(
          okHttp([{ typology_id: 't1', typology_cfg: '001', typology_score: 85, alert_threshold: 70, interdiction_threshold: 90 }]),
        )
        .mockReturnValueOnce(
          okHttp([{ rule_id: 'r1', typology_cfg: '001', rule_weight: 10, rule_desc: 'High risk', rule_sub_ref: 'SUB1' }]),
        );
      const result = await service.getAlertNavigatorData(1, 'DEFAULT');
      expect(result).toHaveProperty('alertMetadata');
      expect(result.typologies[0].rules).toBeDefined();
    });

    it('throws when alert not found', async () => {
      http.mockReturnValue(okHttp([]));
      await expect(service.getAlertNavigatorData(999)).rejects.toThrow(HttpException);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getAlertNavigatorData(1)).rejects.toThrow(HttpException);
    });
  });

  // ===================== getAlertHistorySummary =====================
  describe('getAlertHistorySummary', () => {
    it('returns summary with data', async () => {
      http.mockReturnValue(okHttp([{ total_alerts: 10, cases_opened: 5, investigations: 3, sar_filings: 1, total_value: 50000 }]));
      const result = await service.getAlertHistorySummary('e2e1', 'DEFAULT', '30days');
      expect(result.totalAlerts).toBe(10);
    });

    it('returns zeros on empty row', async () => {
      const result = await service.getAlertHistorySummary();
      expect(result.totalAlerts).toBe(0);
    });

    it('handles 90days date range', async () => {
      await service.getAlertHistorySummary('e2e1', 'DEFAULT', '90days');
      expect(http).toHaveBeenCalled();
    });

    it('handles 6months date range', async () => {
      await service.getAlertHistorySummary('e2e1', 'DEFAULT', '6months');
      expect(http).toHaveBeenCalled();
    });

    it('handles 1year date range', async () => {
      await service.getAlertHistorySummary('e2e1', 'DEFAULT', '1year');
      expect(http).toHaveBeenCalled();
    });

    it('handles unknown date range gracefully', async () => {
      await service.getAlertHistorySummary('e2e1', 'DEFAULT', 'custom');
      expect(http).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getAlertHistorySummary()).rejects.toThrow('Failed to fetch alert history summary');
    });
  });

  // ===================== getAlertHistoryTimeline =====================
  describe('getAlertHistoryTimeline', () => {
    it('returns timeline', async () => {
      http.mockReturnValue(okHttp([{ date: '2024-01-01', alert_count: 5, case_count: 2, investigation_count: 1, total_value: 1000 }]));
      const result = await service.getAlertHistoryTimeline('e2e1', 'DEFAULT', '30days', 'day');
      expect(result.alertCountOverTime).toHaveLength(1);
      expect(result.alertCountOverTime[0].alerts).toBe(5);
    });

    it('returns empty arrays on empty data', async () => {
      http.mockReturnValue(okHttp([]));
      const result = await service.getAlertHistoryTimeline();
      expect(result.alertCountOverTime).toEqual([]);
    });

    it('handles date range branches', async () => {
      for (const r of ['30days', '90days', '6months', '1year', 'custom']) {
        await service.getAlertHistoryTimeline(undefined, undefined, r);
      }
      expect(http).toHaveBeenCalledTimes(5);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getAlertHistoryTimeline()).rejects.toThrow('Failed to fetch alert history timeline');
    });
  });

  // ===================== getAlertHistoryAlerts =====================
  describe('getAlertHistoryAlerts', () => {
    const setup = (countRows: any[], alertRows: any[]) => {
      http.mockReturnValueOnce(okHttp(countRows)).mockReturnValueOnce(okHttp(alertRows));
    };

    it('returns alerts with Investigating outcome', async () => {
      setup([{ total: 1 }], [{ alert_id: 1, case_status: 'STATUS_02_ASSIGNED' }]);
      const result = await service.getAlertHistoryAlerts('e2e1', 'DEFAULT', 'all', 1, 20);
      expect(result.pagination.total).toBe(1);
      expect((result.alerts[0] as any).outcome).toBe('Investigating');
    });

    it('maps Closed outcome for COMPLETED status', async () => {
      setup([{ total: 1 }], [{ alert_id: 2, case_status: 'STATUS_99_COMPLETED' }]);
      const result = await service.getAlertHistoryAlerts();
      expect((result.alerts[0] as any).outcome).toBe('Closed');
    });

    it('maps Draft outcome', async () => {
      setup([{ total: 1 }], [{ alert_id: 3, case_status: 'STATUS_00_DRAFT' }]);
      const result = await service.getAlertHistoryAlerts();
      expect((result.alerts[0] as any).outcome).toBe('Draft');
    });

    it('maps Pending outcome for no case_status', async () => {
      setup([{ total: 1 }], [{ alert_id: 4, case_status: null }]);
      const result = await service.getAlertHistoryAlerts();
      expect((result.alerts[0] as any).outcome).toBe('Pending');
    });

    it('handles date range branches', async () => {
      for (const r of ['30days', '90days', '6months', '1year', 'custom']) {
        http.mockReturnValueOnce(okHttp([{ total: 0 }])).mockReturnValueOnce(okHttp([]));
        await service.getAlertHistoryAlerts('e2e1', 'DEFAULT', r);
      }
      expect(http).toHaveBeenCalledTimes(10);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getAlertHistoryAlerts()).rejects.toThrow('Failed to fetch alert history alerts');
    });
  });
});
