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

  // ===================== getAlertNavigatorData =====================
  describe('getAlertNavigatorData', () => {
    it('returns alert navigator data with typologies and rules', async () => {
      http.mockReturnValue(
        okHttp([
          {
            alert_id: 1,
            tenant_id: 'DEFAULT',
            case_id: 100,
            tx_msg_id: 'msg-123',
            tx_type: 'pacs.008.001.10',
            alert_timestamp: '2024-01-01T10:00:00Z',
            alert_reason: 'Suspicious activity',
            alert_type: 'FRAUD',
            prediction_outcome: 'TRUE_POSITIVE',
            priority: 'HIGH',
            priority_score: 0.85,
            evaluation_id: 'eval-123',
            alert_status: 'ALRT',
            transaction_status: 'ACCC',
            transaction_amount: 1000,
            transaction_currency: 'USD',
            transaction_id: '31',
            end_to_end_id: 'e2e-123',
            block_or_override_status: 'NOT_BLOCKED',
            alert_date: '2024-01-01',
            typologies: [
              {
                typology_id: 'typology-001',
                typology_cfg: '001@1.0.0',
                typology_score: 500,
                typology_review: true,
                typology_processing_time_ms: 1000,
                typology_tenant_id: 'DEFAULT',
                flow_processor: 'EFRuP@1.0.0',
                alert_threshold: 200,
                interdiction_threshold: 400,
                rule_count_in_typology: 2,
                rules: [
                  {
                    rule_id: 'rule-001',
                    rule_cfg: '1.0.0',
                    rule_weight: 250,
                    rule_independent_variable: null,
                    rule_sub_ref: '.01',
                    rule_processing_time_ms: 500,
                    rule_tenant_id: 'DEFAULT',
                  },
                  {
                    rule_id: 'rule-002',
                    rule_cfg: '1.0.0',
                    rule_weight: 250,
                    rule_independent_variable: null,
                    rule_sub_ref: '.02',
                    rule_processing_time_ms: 500,
                    rule_tenant_id: 'DEFAULT',
                  },
                ],
              },
            ],
          },
        ]),
      );

      const result = await service.getAlertNavigatorData(1, 'DEFAULT');

      expect(result).toHaveProperty('alertMetadata');
      expect(result).toHaveProperty('typologies');
      expect(result).toHaveProperty('statistics');
      expect(result).toHaveProperty('meta');

      expect(result.alertMetadata.alertId).toBe(1);
      expect(result.alertMetadata.evaluationId).toBe('eval-123');
      expect(result.alertMetadata.status).toBe('ALRT');
      expect(result.alertMetadata.transactionType).toBe('pacs.008.001.10');

      expect(result.typologies).toHaveLength(1);
      expect(result.typologies[0].typologyId).toBe('typology-001');
      expect(result.typologies[0].typologyScore).toBe(500);

      // Rules are stringified JSON
      expect(typeof result.typologies[0].rules).toBe('string');
      const parsedRules = JSON.parse(result.typologies[0].rules);
      expect(parsedRules).toHaveLength(2);
      expect(parsedRules[0].ruleId).toBe('rule-001');

      expect(result.statistics.totalTypologies).toBe(1);
      expect(result.statistics.totalRules).toBe(2);

      expect(result.meta.alertId).toBe(1);
      expect(result.meta.tenantId).toBe('DEFAULT');
    });

    it('handles null values gracefully', async () => {
      http.mockReturnValue(
        okHttp([
          {
            alert_id: 2,
            tenant_id: 'DEFAULT',
            tx_type: null,
            alert_timestamp: null,
            alert_reason: null,
            transaction_amount: null,
            transaction_currency: null,
            transaction_id: null,
            evaluation_id: null,
            typologies: [
              {
                typology_id: 'typology-002',
                typology_cfg: null,
                typology_score: null,
                alert_threshold: null,
                interdiction_threshold: null,
                rule_count_in_typology: null,
                rules: [],
              },
            ],
          },
        ]),
      );

      const result = await service.getAlertNavigatorData(2, 'DEFAULT');

      expect(result.alertMetadata.transactionType).toBe('');
      expect(result.alertMetadata.amount).toBe(0);
      expect(result.alertMetadata.evaluationId).toBe('');
      expect(result.typologies[0].typologyScore).toBe(0);
    });

    it('filters out null typologies', async () => {
      http.mockReturnValue(
        okHttp([
          {
            alert_id: 3,
            tenant_id: 'DEFAULT',
            typologies: [
              {
                typology_id: null,
                typology_cfg: null,
              },
            ],
          },
        ]),
      );

      const result = await service.getAlertNavigatorData(3, 'DEFAULT');
      expect(result.typologies).toHaveLength(0);
      expect(result.statistics.totalTypologies).toBe(0);
      expect(result.statistics.totalRules).toBe(0);
    });

    it('throws when alert not found', async () => {
      http.mockReturnValue(okHttp([]));
      await expect(service.getAlertNavigatorData(999)).rejects.toThrow(HttpException);
      await expect(service.getAlertNavigatorData(999)).rejects.toThrow('Alert not found');
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
