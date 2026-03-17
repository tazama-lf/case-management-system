import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { GoldLakehouseService } from '../src/modules/gold-lakehouse/gold-lakehouse.service';

describe('GoldLakehouseService', () => {
  let service: GoldLakehouseService;
  let http: jest.Mock;

  /** Returns a successful Axios-like observable wrapping a /query or /execute_sql body */
  const okHttp = (rows: any[] = [{}]) =>
    of({
      data: { status: 'success', data: rows, code: 200 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

  /** Error observable */
  const errHttp = (msg = 'fail') => throwError(() => new Error(msg));

  /** HTTP response with status!=success */
  const badHttp = () =>
    of({
      data: { status: 'error', code: 500 },
      status: 200,
      statusText: 'OK',
      headers: {},
      config: {} as any,
    });

  beforeEach(async () => {
    http = jest.fn().mockReturnValue(okHttp());

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoldLakehouseService,
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

    service = module.get<GoldLakehouseService>(GoldLakehouseService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  // ===================== query =====================
  describe('query', () => {
    it('returns response on success', async () => {
      const result = await service.query({ table_name: 'alerts', filters: {} });
      expect(result.status).toBe('success');
    });

    it('throws when status is not success', async () => {
      http.mockReturnValue(badHttp());
      await expect(service.query({ table_name: 't', filters: {} })).rejects.toThrow(HttpException);
    });

    it('throws SERVICE_UNAVAILABLE on ECONNREFUSED', async () => {
      http.mockReturnValue(throwError(() => ({ code: 'ECONNREFUSED' })));
      await expect(service.query({ table_name: 't', filters: {} })).rejects.toThrow(HttpException);
    });

    it('re-throws HttpException', async () => {
      http.mockReturnValue(throwError(() => new HttpException('Http error', 400)));
      await expect(service.query({ table_name: 't', filters: {} })).rejects.toThrow('Http error');
    });

    it('wraps generic errors', async () => {
      http.mockReturnValue(errHttp('unexpected'));
      await expect(service.query({ table_name: 't', filters: {} })).rejects.toThrow('Failed to query Gold Lakehouse');
    });
  });

  // ===================== runSqlQuery =====================
  describe('runSqlQuery', () => {
    it('uses default limit of 1', async () => {
      await service.runSqlQuery('SELECT 1');
      expect(http).toHaveBeenCalledWith('http://localhost:5000/execute_sql', expect.objectContaining({ limit: 1 }), expect.any(Object));
    });

    it('accepts custom limit', async () => {
      await service.runSqlQuery('SELECT 1', 100);
      expect(http).toHaveBeenCalledWith('http://localhost:5000/execute_sql', expect.objectContaining({ limit: 100 }), expect.any(Object));
    });

    it('throws when status is not success', async () => {
      http.mockReturnValue(badHttp());
      await expect(service.runSqlQuery('BAD')).rejects.toThrow(HttpException);
    });

    it('re-throws HttpException', async () => {
      http.mockReturnValue(throwError(() => new HttpException('SQL error', 500)));
      await expect(service.runSqlQuery('BAD')).rejects.toThrow('SQL error');
    });

    it('wraps generic errors', async () => {
      http.mockReturnValue(errHttp('conn'));
      await expect(service.runSqlQuery('BAD')).rejects.toThrow('Failed to run SQL query');
    });
  });

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

  // ===================== getTransactionDetailData =====================
  describe('getTransactionDetailData', () => {
    it('returns transaction detail', async () => {
      http.mockReturnValue(
        okHttp([
          {
            transaction_id: '123',
            tx_type: 'PAYMENT',
            tx_event_ts: '2024-01-01',
            debtor_name: 'A',
            debtor_account_id: 'acc1',
            creditor_name: 'B',
            creditor_account_id: 'acc2',
            instg_mmb_id: 'bank1',
            instd_mmb_id: 'bank2',
            interbank_settlement_amount: 100,
            interbank_settlement_currency: 'USD',
            instructed_amount: 100,
            instructed_currency: 'USD',
            exchange_rate: 1,
            charge_total_amount: 0,
            tx_event_date: '2024-01-01',
          },
        ]),
      );
      const result = await service.getTransactionDetailData(123);
      expect(result).toHaveProperty('transactionOverview');
    });

    it('throws when transaction not found', async () => {
      http.mockReturnValue(okHttp([]));
      await expect(service.getTransactionDetailData(999)).rejects.toThrow(HttpException);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getTransactionDetailData(1)).rejects.toThrow(HttpException);
    });
  });

  // ===================== getTransactionOverviewUIData =====================
  describe('getTransactionOverviewUIData', () => {
    it('returns overview data', async () => {
      const result = await service.getTransactionOverviewUIData(1, 'DEFAULT');
      expect(result).toHaveProperty('transactionOverview');
    });

    it('throws when transaction not found', async () => {
      http.mockReturnValue(okHttp([]));
      await expect(service.getTransactionOverviewUIData(999)).rejects.toThrow(HttpException);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getTransactionOverviewUIData(1)).rejects.toThrow(HttpException);
    });
  });

  // ===================== getEntityAccounts =====================
  describe('getEntityAccounts', () => {
    it('returns entity accounts', async () => {
      http.mockReturnValue(okHttp([{ destination: 'acc1' }, { destination: 'acc2' }]));
      const result = await service.getEntityAccounts('entity1', 'DEFAULT');
      expect(result.accountCount).toBe(2);
    });

    it('returns empty on error (does not throw)', async () => {
      http.mockReturnValue(errHttp());
      const result = await service.getEntityAccounts('entity1', 'DEFAULT');
      expect(result.accountCount).toBe(0);
    });
  });

  // ===================== getConditionsSummary =====================
  describe('getConditionsSummary', () => {
    it('returns summary for direct account ID', async () => {
      // 1st call: account_holder lookup returns no destinations  resolveToAccounts returns [identifier]
      // 2nd call: SQL aggregation
      http
        .mockReturnValueOnce(okHttp([{}]))
        .mockReturnValueOnce(okHttp([{ active_conditions: 5, blocked_transactions: 2, overridden_transactions: 1, future_conditions: 3 }]));
      const result: any = await service.getConditionsSummary('acc1', 'DEFAULT');
      expect(result.activeConditions).toBe(5);
    });

    it('returns zeros when no accounts resolved (numeric id)', async () => {
      // numeric id  resolveToAccounts queries transaction_detail  gets {}  no accounts
      const result: any = await service.getConditionsSummary('123', 'DEFAULT');
      expect(result.activeConditions).toBe(0);
    });

    it('resolves UUID-like identifier via resolveToAccounts UUID branch', async () => {
      // abc12345-abcd- matches /^[0-9a-f]{8}-[0-9a-f]{4}-/iv in resolveToAccounts
      const result: any = await service.getConditionsSummary('abc12345-abcd-4567', 'DEFAULT');
      expect(result).toBeDefined();
    });

    it('returns entity-level metadata when multiple accounts resolved', async () => {
      // Entity lookup returns 2 destinations => isEntityLevel = true
      http
        .mockReturnValueOnce(okHttp([{ destination: 'acc1' }, { destination: 'acc2' }]))
        .mockReturnValueOnce(okHttp([{ active_conditions: 2 }]));
      const result: any = await service.getConditionsSummary('entityXYZ', 'DEFAULT');
      expect(result.metadata.isEntityLevel).toBe(true);
      expect(result.metadata.accountCount).toBe(2);
    });

    it('throws on error', async () => {
      http.mockReturnValueOnce(okHttp([{}])).mockReturnValueOnce(errHttp());
      await expect(service.getConditionsSummary('acc1')).rejects.toThrow('Failed to fetch conditions summary');
    });
  });

  // ===================== getConditionsList =====================
  describe('getConditionsList', () => {
    it('maps ACTIVE status', async () => {
      http
        .mockReturnValueOnce(okHttp([{}]))
        .mockReturnValueOnce(okHttp([{ condition_id: 'c1', condition_type: 'block', is_active: 1, is_expired: 0 }]));
      const result = (await service.getConditionsList('acc1')) as any[];
      expect(result[0].status).toBe('ACTIVE');
    });

    it('maps EXPIRED status', async () => {
      http.mockReturnValueOnce(okHttp([{}])).mockReturnValueOnce(okHttp([{ condition_id: 'c2', is_active: 0, is_expired: 1 }]));
      const result = (await service.getConditionsList('acc1')) as any[];
      expect(result[0].status).toBe('EXPIRED');
    });

    it('maps FUTURE status', async () => {
      http.mockReturnValueOnce(okHttp([{}])).mockReturnValueOnce(okHttp([{ condition_id: 'c3', is_active: 0, is_expired: 0 }]));
      const result = (await service.getConditionsList('acc1')) as any[];
      expect(result[0].status).toBe('FUTURE');
    });

    it('omits tenant filter when tenantId is undefined', async () => {
      http.mockReturnValueOnce(okHttp([{}])).mockReturnValueOnce(okHttp([{ condition_id: 'c4', is_active: 1, is_expired: 0 }]));
      const result = (await service.getConditionsList('acc1', undefined)) as any[];
      expect(result).toHaveLength(1);
    });

    it('returns empty array when no accounts resolved (numeric id)', async () => {
      // numeric identifier → resolveToAccounts queries transaction_detail, returns [{}] → no debtor/creditor → []
      const result = (await service.getConditionsList('12345')) as any[];
      expect(result).toEqual([]);
    });

    it('adds tenant_id filter when tenantId is provided', async () => {
      http.mockReturnValueOnce(okHttp([{}])).mockReturnValueOnce(okHttp([{ condition_id: 'c5', is_active: 1, is_expired: 0 }]));
      const result = (await service.getConditionsList('acc1', 'TENANT_A')) as any[];
      expect(result).toHaveLength(1);
    });

    it('uses array filter when multiple accounts resolved', async () => {
      http
        // resolveToAccounts: account_holder returns 2 destinations
        .mockReturnValueOnce(okHttp([{ destination: 'acc1' }, { destination: 'acc2' }]))
        // query for conditions
        .mockReturnValueOnce(okHttp([{ condition_id: 'c6', is_active: 1, is_expired: 0 }]));
      const result = (await service.getConditionsList('entity1', 'TENANT_A')) as any[];
      expect(result).toHaveLength(1);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getConditionsList('acc1')).rejects.toThrow('Failed to fetch conditions list');
    });
  });

  // ===================== getActiveConditions / getExpiredConditions / getFutureConditions =====================
  describe.each([['getActiveConditions'], ['getExpiredConditions'], ['getFutureConditions']])('%s', (methodName) => {
    it('returns conditions list', async () => {
      http.mockReturnValueOnce(okHttp([{}])).mockReturnValueOnce(okHttp([{ condition_id: 'cond1', condition_reason: 'Test' }]));
      const result: any = await (service as any)[methodName]('acc1', 'DEFAULT');
      expect(Array.isArray(result.conditions)).toBe(true);
    });

    it('groups conditions with linked transactions', async () => {
      // Entity lookup returns accounts, main query returns rows with transaction_id set
      http.mockReturnValueOnce(okHttp([{ destination: 'acc1' }])).mockReturnValueOnce(
        okHttp([
          { condition_id: 'c1', condition_reason: 'Test', transaction_id: 'tx1' },
          { condition_id: 'c1', condition_reason: 'Test', transaction_id: 'tx2' },
        ]),
      );
      const result: any = await (service as any)[methodName]('entityABC', 'DEFAULT');
      if (methodName !== 'getFutureConditions') {
        // getActive and getExpired group by condition_id and push transactions
        expect(result.conditions.length).toBeGreaterThan(0);
      } else {
        // getFutureConditions maps rows directly
        expect(result.conditions.length).toBeGreaterThan(0);
      }
    });

    it('returns empty when no accounts found', async () => {
      // numeric id  no accounts resolved
      const result: any = await (service as any)[methodName]('123', 'DEFAULT');
      expect(result.conditions).toEqual([]);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect((service as any)[methodName]('acc1')).rejects.toThrow(HttpException);
    });
  });

  // ===================== getEvaluatedTransactions =====================
  describe('getEvaluatedTransactions', () => {
    it('returns BLOCKED outcome', async () => {
      http.mockReturnValueOnce(okHttp([{}])).mockReturnValueOnce(okHttp([{ tx_transaction_id: 'tx1', cond_type: 'block' }]));
      const result: any = await service.getEvaluatedTransactions('acc1', 'DEFAULT');
      expect(result[0].outcome).toBe('BLOCKED');
    });

    it('returns BLOCKED_OVERRIDABLE outcome', async () => {
      http.mockReturnValueOnce(okHttp([{}])).mockReturnValueOnce(okHttp([{ tx_transaction_id: 'tx1', cond_type: 'overridable-block' }]));
      const result: any = await service.getEvaluatedTransactions('acc1', 'DEFAULT');
      expect(result[0].outcome).toBe('BLOCKED_OVERRIDABLE');
    });

    it('returns empty array when no accounts', async () => {
      const result = (await service.getEvaluatedTransactions('123')) as any[];
      expect(result).toEqual([]);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getEvaluatedTransactions('acc1')).rejects.toThrow('Failed to fetch evaluated transactions');
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

  // ===================== getTestAccountIds =====================
  describe('getTestAccountIds', () => {
    it('returns account list', async () => {
      http.mockReturnValue(okHttp([{ account_id: 'acc1', account_name: 'Test', connections: 5, total_transactions: 100 }]));
      const result = await service.getTestAccountIds('DEFAULT', 1);
      expect((result as any).accounts).toHaveLength(1);
    });

    it('returns empty accounts', async () => {
      http.mockReturnValue(okHttp([]));
      const result = await service.getTestAccountIds();
      expect((result as any).accounts).toEqual([]);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getTestAccountIds()).rejects.toThrow('Failed to fetch test account IDs');
    });
  });

  // ===================== getTransactionNetworkData =====================
  describe('getTransactionNetworkData', () => {
    it('returns network with connections', async () => {
      http
        .mockReturnValueOnce(okHttp([{ account_id: 'acc1', account_name: 'Center' }]))
        .mockReturnValueOnce(
          okHttp([
            {
              connected_account_id: 'acc2',
              connected_account_name: 'Other',
              flow_direction: 'OUTBOUND',
              total_transactions: 5,
              total_value: 2500,
              avg_value: 500,
              duration_days: 30,
            },
          ]),
        )
        .mockReturnValueOnce(okHttp([]))
        .mockReturnValueOnce(okHttp([]));
      const result = await service.getTransactionNetworkData('acc1', 'DEFAULT', '30d');
      expect(result.centerAccount.accountId).toBe('acc1');
      expect(result.connectedAccounts).toHaveLength(1);
    });

    it('returns HIGH velocity when tx/day > 0.5', async () => {
      http
        .mockReturnValueOnce(okHttp([{ account_id: 'acc1' }]))
        .mockReturnValueOnce(
          okHttp([
            {
              connected_account_id: 'acc2',
              flow_direction: 'OUTBOUND',
              total_transactions: 100,
              total_value: 50000,
              avg_value: 500,
              duration_days: 1,
            },
          ]),
        )
        .mockReturnValueOnce(okHttp([]))
        .mockReturnValueOnce(okHttp([]));
      const result = await service.getTransactionNetworkData('acc1');
      expect(result.connectedAccounts[0].transactionStats.velocity).toBe('HIGH');
    });

    it('returns MEDIUM velocity when tx/day >= 0.2', async () => {
      http
        .mockReturnValueOnce(okHttp([{ account_id: 'acc1' }]))
        .mockReturnValueOnce(
          okHttp([
            {
              connected_account_id: 'acc2',
              flow_direction: 'OUTBOUND',
              total_transactions: 6,
              total_value: 3000,
              avg_value: 500,
              duration_days: 20,
            },
          ]),
        )
        .mockReturnValueOnce(okHttp([]))
        .mockReturnValueOnce(okHttp([]));
      const result = await service.getTransactionNetworkData('acc1');
      expect(result.connectedAccounts[0].transactionStats.velocity).toBe('MEDIUM');
    });

    it('throws when account not found', async () => {
      http.mockReturnValue(okHttp([]));
      await expect(service.getTransactionNetworkData('nonexistent')).rejects.toThrow(HttpException);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getTransactionNetworkData('acc1')).rejects.toThrow(HttpException);
    });
  });

  // ===================== getTransactionHistoryData =====================
  describe('getTransactionHistoryByEntityId', () => {
    it('uses baseline expected values when available', async () => {
      http
        .mockReturnValueOnce(
          okHttp([{ transaction_id: 'tx1', event_date: '2024-01-01', tx_amount: '100', is_alerted: 0, is_investigated: 0 }]),
        )
        .mockReturnValueOnce(okHttp([{ total_tx_count: '50', total_amount: '5000' }]));
      const result: any = await service.getTransactionHistoryData('entity1', 'DEFAULT');
      expect(result.summary.expected.transactionCount).toBe(50);
    });

    it('handles baseline query failure gracefully', async () => {
      http
        .mockReturnValueOnce(
          okHttp([{ transaction_id: 'tx1', event_date: '2024-01-01', tx_amount: '100', is_alerted: 0, is_investigated: 0 }]),
        )
        .mockReturnValueOnce(errHttp('baseline unavailable'));
      const result: any = await service.getTransactionHistoryData('entity1', 'DEFAULT');
      expect(result.summary).toBeDefined();
      expect(result.summary.expected.transactionCount).toBeNull();
    });
  });

  describe('getTransactionHistoryData', () => {
    it('returns entity history for entity_id', async () => {
      http
        .mockReturnValueOnce(
          okHttp([
            {
              transaction_id: 'tx1',
              event_date: '2024-01-01',
              tx_amount: 100,
              tx_ccy: 'USD',
              tx_type: 'PAYMENT',
              is_alerted: 0,
              is_investigated: 0,
              cum_tx_count: 1,
              cum_tx_amount: 100,
              entity_role: 'DEBTOR',
            },
          ]),
        )
        .mockReturnValueOnce(okHttp([]));
      const result: any = await service.getTransactionHistoryData('entity1', 'DEFAULT');
      expect(result.summary.totalTransactions).toBe(1);
    });

    it('handles empty entity history', async () => {
      http.mockReturnValue(okHttp([]));
      const result: any = await service.getTransactionHistoryData('entity1');
      expect(result.summary.totalTransactions).toBe(0);
    });

    it('returns entity history with granularity', async () => {
      http
        .mockReturnValueOnce(
          okHttp([{ transaction_id: 'tx1', event_date: '2024-01-01', tx_amount: 100, tx_ccy: 'USD', is_alerted: 1, is_investigated: 0 }]),
        )
        .mockReturnValueOnce(
          okHttp([{ bucket_start: '2024-01-01', bucket_tx_count: 10, bucket_tx_amount: 1000, bucket_granularity: 'day' }]),
        )
        .mockReturnValueOnce(okHttp([]));
      const result: any = await service.getTransactionHistoryData('entity1', 'DEFAULT', '2024-01-01', '2024-01-31', 'day');
      expect(result.volumeDistribution).toHaveLength(1);
    });

    it('returns end_to_end_id history for UUID', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      http.mockReturnValue(
        okHttp([
          {
            transaction_id: 'tx1',
            end_to_end_id: uuid,
            entity_type: 'ACCOUNT',
            entity_role: 'DEBTOR',
            entity_id: 'e1',
            tx_amount: 100,
            tx_ccy: 'USD',
            is_alerted: 0,
            is_investigated: 0,
          },
        ]),
      );
      const result: any = await service.getTransactionHistoryData(uuid, 'DEFAULT');
      expect(result.entityPerspectives).toBeInstanceOf(Array);
    });

    it('returns empty UUID history when no data', async () => {
      const uuid = '00000000-0000-0000-0000-000000000000';
      http.mockReturnValue(okHttp([]));
      const result: any = await service.getTransactionHistoryData(uuid, 'DEFAULT');
      expect(result.summary.totalTransactions).toBe(0);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getTransactionHistoryData('entity1')).rejects.toThrow(HttpException);
    });
  });

  // ===================== getTransactionHistoryByEndToEndId =====================
  describe('getTransactionHistoryByEndToEndId', () => {
    it('returns perspectives data', async () => {
      http.mockReturnValue(
        okHttp([
          {
            transaction_id: 'tx1',
            entity_type: 'ACCOUNT',
            entity_role: 'DEBTOR',
            entity_id: 'e1',
            tx_amount: 100,
            tx_ccy: 'USD',
            is_alerted: 0,
            is_investigated: 0,
          },
        ]),
      );
      const result = await service.getTransactionHistoryByEndToEndId('e2e1', 'DEFAULT');
      expect(result.entityPerspectives).toHaveLength(1);
    });

    it('returns empty when no data', async () => {
      http.mockReturnValue(okHttp([]));
      const result = await service.getTransactionHistoryByEndToEndId('e2e999', 'DEFAULT');
      expect(result.summary.totalTransactions).toBe(0);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getTransactionHistoryByEndToEndId('e2e1')).rejects.toThrow(HttpException);
    });
  });

  // ===================== getTransactionPerspectivesByEndToEndId =====================
  describe('getTransactionPerspectivesByEndToEndId', () => {
    it('returns perspectives', async () => {
      http.mockReturnValue(okHttp([{ entity_type: 'ACCOUNT', entity_role: 'DEBTOR', entity_id: 'e1', tx_amount: 100, tx_ccy: 'USD' }]));
      const result = await service.getTransactionPerspectivesByEndToEndId('e2e1', 'DEFAULT');
      expect(result.perspectives).toHaveLength(1);
    });

    it('returns empty perspectives', async () => {
      http.mockReturnValue(okHttp([]));
      const result = await service.getTransactionPerspectivesByEndToEndId('e2e999');
      expect(result.perspectives).toEqual([]);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getTransactionPerspectivesByEndToEndId('e2e1')).rejects.toThrow(HttpException);
    });
  });

  // ===================== getCounterpartyNetworkData =====================
  describe('getCounterpartyNetworkData', () => {
    it('returns counterparty network', async () => {
      http
        .mockReturnValueOnce(
          okHttp([{ debtor_name: 'Holder', debtor_account_id: 'acc1', creditor_name: 'Other', creditor_account_id: 'acc2' }]),
        )
        .mockReturnValueOnce(okHttp([{ counterparty_id: 'cp1' }]))
        .mockReturnValueOnce(
          okHttp([
            {
              from_counterparty_id: 'cp1',
              to_counterparty_id: 'cp2',
              tx_count: 5,
              total_amount: 2500,
              is_alerted_edge: 0,
              is_investigated_edge: 0,
              first_event_ts: '2024-01-01',
              last_event_ts: '2024-01-31',
            },
          ]),
        )
        .mockReturnValueOnce(okHttp([{ counterparty_id: 'cp2', name: 'CP2 Name' }]));
      const result = await service.getCounterpartyNetworkData('acc1', 'DEFAULT', '30d');
      expect(result.centerCounterparty).toBeDefined();
      expect(result.counterparties.length).toBeGreaterThan(0);
    });

    it('maps LOW frequency correctly (tx_count <= 4)', async () => {
      http
        .mockReturnValueOnce(okHttp([{ debtor_account_id: 'acc1' }]))
        .mockReturnValueOnce(okHttp([{ counterparty_id: 'cp1' }]))
        .mockReturnValueOnce(okHttp([{ from_counterparty_id: 'cp1', to_counterparty_id: 'cp2', tx_count: 2, total_amount: 500 }]))
        .mockReturnValueOnce(okHttp([]));
      const result = await service.getCounterpartyNetworkData('acc1');
      expect(result.counterparties[0].frequency).toBe('LOW');
    });

    it('throws when account not found', async () => {
      http.mockReturnValue(okHttp([]));
      await expect(service.getCounterpartyNetworkData('nonexistent')).rejects.toThrow(HttpException);
    });

    it('throws when no counterparties found', async () => {
      http.mockReturnValueOnce(okHttp([{ debtor_account_id: 'acc1' }])).mockReturnValueOnce(okHttp([]));
      await expect(service.getCounterpartyNetworkData('acc1')).rejects.toThrow(HttpException);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getCounterpartyNetworkData('acc1')).rejects.toThrow(HttpException);
    });
  });

  // ===================== getAccountNodeFullData =====================
  describe('getAccountNodeFullData', () => {
    const setupAccountNode = () => {
      http
        .mockReturnValueOnce(
          okHttp([
            {
              from_account_id: 'acc1',
              to_account_id: 'acc2',
              tx_count: 5,
              total_amount: 2500,
              is_alerted_edge: 0,
              is_investigated_edge: 0,
            },
          ]),
        )
        .mockReturnValueOnce(okHttp([{ transactions: 5, total_value: 2500, is_alerted: 0, is_investigated: 0 }]))
        .mockReturnValueOnce(okHttp([{ holder_name: 'Holder' }]))
        .mockReturnValueOnce(okHttp([{ alert_count: 0 }]))
        .mockReturnValueOnce(okHttp([{ investigation_count: 0 }]));
    };

    it('returns account node data', async () => {
      setupAccountNode();
      const result = await service.getAccountNodeFullData('acc1', 'DEFAULT', 'month');
      expect(result.network.nodes.length).toBeGreaterThan(0);
      expect(result.accountDetails.accountId).toBe('acc1');
    });

    it('uses HIGH velocity when txCount >= 50', async () => {
      http
        .mockReturnValueOnce(
          okHttp(
            Array(60).fill({
              from_account_id: 'acc1',
              to_account_id: 'acc2',
              tx_count: 1,
              total_amount: 100,
              is_alerted_edge: 0,
              is_investigated_edge: 0,
            }),
          ),
        )
        .mockReturnValueOnce(okHttp([{ transactions: 60, total_value: 6000 }]))
        .mockReturnValueOnce(okHttp([{ holder_name: 'Holder' }]))
        .mockReturnValueOnce(okHttp([{ alert_count: 0 }]))
        .mockReturnValueOnce(okHttp([{ investigation_count: 0 }]));
      const result = await service.getAccountNodeFullData('acc1', 'DEFAULT', 'year');
      expect(result.accountDetails.velocity).toBe('HIGH');
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getAccountNodeFullData('acc1')).rejects.toThrow(HttpException);
    });

    it('uses MEDIUM velocity when txCount between 10 and 49', async () => {
      http
        .mockReturnValueOnce(
          okHttp([
            { from_account_id: 'acc1', to_account_id: 'acc2', tx_count: 1, total_amount: 100, is_alerted_edge: 0, is_investigated_edge: 0 },
          ]),
        )
        .mockReturnValueOnce(okHttp([{ transactions: 25, total_value: 2500, is_alerted: 0, is_investigated: 0 }]))
        .mockReturnValueOnce(okHttp([{ holder_name: 'Holder' }]))
        .mockReturnValueOnce(okHttp([{ alert_count: 0 }]))
        .mockReturnValueOnce(okHttp([{ investigation_count: 0 }]));
      const result = await service.getAccountNodeFullData('acc1');
      expect(result.accountDetails.velocity).toBe('MEDIUM');
    });

    it('adds unseen fromId node to network graph', async () => {
      http
        // First row: acc2→acc1; acc2 is not the root so fromId branch runs
        .mockReturnValueOnce(
          okHttp([
            { from_account_id: 'acc2', to_account_id: 'acc1', tx_count: 2, total_amount: 200, is_alerted_edge: 0, is_investigated_edge: 0 },
          ]),
        )
        .mockReturnValueOnce(okHttp([{ transactions: 2, total_value: 200, is_alerted: 0, is_investigated: 0 }]))
        .mockReturnValueOnce(okHttp([{ holder_name: 'Holder' }]))
        .mockReturnValueOnce(okHttp([{ alert_count: 0 }]))
        .mockReturnValueOnce(okHttp([{ investigation_count: 0 }]));
      const result = await service.getAccountNodeFullData('acc1');
      // root acc1 + fromId acc2 both added
      expect(result.network.nodes.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ===================== getCounterpartyNodeFullData =====================
  describe('getCounterpartyNodeFullData', () => {
    it('returns counterparty node data', async () => {
      http
        .mockReturnValueOnce(
          okHttp([
            {
              from_counterparty_id: 'cp1',
              to_counterparty_id: 'cp2',
              tx_count: 10,
              total_amount: 5000,
              is_alerted_edge: 0,
              is_investigated_edge: 0,
            },
          ]),
        )
        .mockReturnValueOnce(okHttp([{ transactions: 10, total_value: 5000, is_alerted: 0, is_investigated: 0 }]))
        .mockReturnValueOnce(okHttp([{ holder_name: 'CP Name' }]));
      const result = await service.getCounterpartyNodeFullData('cp1', 'DEFAULT', 'month');
      expect(result.network.rootNodeId).toBe('cp1');
      expect(result.network.nodes.length).toBeGreaterThan(0);
    });

    it('uses MEDIUM velocity when txCount between 10 and 49', async () => {
      http
        .mockReturnValueOnce(
          okHttp([
            {
              from_counterparty_id: 'cp1',
              to_counterparty_id: 'cp2',
              tx_count: 1,
              total_amount: 100,
              is_alerted_edge: 0,
              is_investigated_edge: 0,
            },
          ]),
        )
        .mockReturnValueOnce(okHttp([{ transactions: 20, total_value: 2000, is_alerted: 0, is_investigated: 0 }]))
        .mockReturnValueOnce(okHttp([{ holder_name: 'CP Name' }]));
      const result = await service.getCounterpartyNodeFullData('cp1');
      expect(result.counterpartyDetails.velocity).toBe('MEDIUM');
    });

    it('reflects alerted/investigated flags on root node', async () => {
      http
        .mockReturnValueOnce(
          okHttp([
            {
              from_counterparty_id: 'cp1',
              to_counterparty_id: 'cp2',
              tx_count: 10,
              total_amount: 5000,
              is_alerted_edge: 1,
              is_investigated_edge: 1,
            },
          ]),
        )
        .mockReturnValueOnce(okHttp([{ transactions: 10, total_value: 5000, is_alerted: 1, is_investigated: 1 }]))
        .mockReturnValueOnce(okHttp([{}]));
      const result = await service.getCounterpartyNodeFullData('cp1');
      expect(result.counterpartyDetails.flags.alerted).toBe(true);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getCounterpartyNodeFullData('cp1')).rejects.toThrow(HttpException);
    });

    it('adds unseen fromId counterparty node to network', async () => {
      http
        // cp2→cp1: cp2 is not the root so fromId branch runs
        .mockReturnValueOnce(
          okHttp([
            {
              from_counterparty_id: 'cp2',
              to_counterparty_id: 'cp1',
              tx_count: 2,
              total_amount: 500,
              is_alerted_edge: 0,
              is_investigated_edge: 0,
            },
          ]),
        )
        .mockReturnValueOnce(okHttp([{ transactions: 2, total_value: 500, is_alerted: 0, is_investigated: 0 }]))
        .mockReturnValueOnce(okHttp([{ holder_name: 'CP Name' }]));
      const result = await service.getCounterpartyNodeFullData('cp1');
      expect(result.network.nodes.length).toBeGreaterThanOrEqual(2);
    });
  });

  // ===================== getBenfordAnalysisByAccount =====================
  describe('getBenfordAnalysisByAccount', () => {
    it('returns Benford analysis', async () => {
      http.mockReturnValue(okHttp([{ amount: 123 }, { amount: 456 }, { amount: 789 }]));
      const result = await service.getBenfordAnalysisByAccount('acc1', 'DEFAULT', '2024-01-01', '2024-12-31');
      expect(result).toHaveProperty('expected');
      expect(result).toHaveProperty('actual');
      expect(result.sampleSize).toBeGreaterThan(0);
    });

    it('returns zero sampleSize on empty data', async () => {
      http.mockReturnValue(okHttp([]));
      const result = await service.getBenfordAnalysisByAccount('acc1', 'DEFAULT', '2024-01-01', '2024-12-31');
      expect(result.sampleSize).toBe(0);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getBenfordAnalysisByAccount('acc1', 'DEFAULT', '2024-01-01', '2024-12-31')).rejects.toThrow(
        'Failed to perform Benford analysis',
      );
    });
  });

  // ===================== DEBUG / TABLE DATA METHODS =====================
  describe('getAllConditionsTableData', () => {
    it('returns table data', async () => {
      const result = await service.getAllConditionsTableData('DEFAULT');
      expect(result.tableName).toBe('conditions');
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getAllConditionsTableData('DEFAULT')).rejects.toThrow(HttpException);
    });
  });

  describe('getAllConditionsTimelineData', () => {
    it('returns timeline data', async () => {
      const result: any = await service.getAllConditionsTimelineData('DEFAULT');
      expect(result.tableName).toBe('conditions_timeline');
    });

    it('returns empty result on error (does not throw)', async () => {
      http.mockReturnValue(errHttp());
      const result: any = await service.getAllConditionsTimelineData('DEFAULT');
      expect(result.totalRows).toBe(0);
    });
  });

  describe('getAllAccountHolderData', () => {
    it('returns account holder data', async () => {
      const result: any = await service.getAllAccountHolderData('DEFAULT');
      expect(result.tableName).toBe('account_holder');
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getAllAccountHolderData('DEFAULT')).rejects.toThrow(HttpException);
    });
  });

  describe('getTransactionDetailSampleData', () => {
    it('returns sample data', async () => {
      const result: any = await service.getTransactionDetailSampleData('DEFAULT');
      expect(result.tableName).toBe('transaction_detail');
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getTransactionDetailSampleData('DEFAULT')).rejects.toThrow(HttpException);
    });
  });

  // ===================== ACCOUNT-SPECIFIC CONDITIONS METHODS =====================
  describe('getConditionsSummaryByAccount', () => {
    it('returns summary with DEFAULT tenant', async () => {
      http
        .mockReturnValueOnce(okHttp([{ total_conditions: 5, active_conditions: 3, expired_conditions: 1, future_conditions: 1 }]))
        .mockReturnValueOnce(okHttp([{ condition_id: 'c1', condition_type: 'block', is_active: 1 }]));
      const result = await service.getConditionsSummaryByAccount('acc1', 'DEFAULT');
      expect(result.totalConditions).toBe(5);
    });

    it('adds tenant filter for non-DEFAULT tenant', async () => {
      http.mockReturnValueOnce(okHttp([{}])).mockReturnValueOnce(okHttp([]));
      const result = await service.getConditionsSummaryByAccount('acc1', 'TENANT_A');
      expect(result.accountId).toBe('acc1');
    });

    it('applies asOfDate filter when provided', async () => {
      http
        .mockReturnValueOnce(okHttp([{ total_conditions: 2, active_conditions: 1, expired_conditions: 1, future_conditions: 0 }]))
        .mockReturnValueOnce(okHttp([]));
      const result = await service.getConditionsSummaryByAccount('acc1', 'DEFAULT', undefined, '2024-01-01');
      expect(result.accountId).toBe('acc1');
    });

    it('re-throws HttpException directly', async () => {
      http.mockReturnValue(throwError(() => new HttpException('Not found', 404)));
      await expect(service.getConditionsSummaryByAccount('acc1')).rejects.toThrow('Not found');
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getConditionsSummaryByAccount('acc1')).rejects.toThrow(HttpException);
    });
  });

  describe('getActiveConditionsByAccount', () => {
    it('returns active conditions', async () => {
      http.mockReturnValue(okHttp([{ condition_id: 'c1', condition_reason: 'Test', condition_type: 'block' }]));
      const result: any = await service.getActiveConditionsByAccount('acc1', 'DEFAULT');
      expect(result.conditions).toHaveLength(1);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getActiveConditionsByAccount('acc1')).rejects.toThrow(HttpException);
    });
  });

  describe('getFutureConditionsByAccount', () => {
    it('returns future conditions', async () => {
      http.mockReturnValue(okHttp([{ condition_id: 'c1', condition_reason: 'Future', condition_type: 'block' }]));
      const result = await service.getFutureConditionsByAccount('acc1', 'DEFAULT');
      expect(result.conditions).toHaveLength(1);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getFutureConditionsByAccount('acc1')).rejects.toThrow(HttpException);
    });
  });

  describe('getConditionsListByAccount', () => {
    it('returns conditions list', async () => {
      http.mockReturnValue(okHttp([{ condition_id: 'c1', condition_type: 'block', is_active: 1, is_expired: 0 }]));
      const result = await service.getConditionsListByAccount('acc1', 'DEFAULT');
      expect(result.conditions).toHaveLength(1);
    });

    it('marks expired conditions correctly', async () => {
      http.mockReturnValue(okHttp([{ condition_id: 'c2', condition_type: 'block', is_active: 0, is_expired: 1 }]));
      const result: any = await service.getConditionsListByAccount('acc1', 'DEFAULT');
      expect(result.conditions[0].isExpired).toBe(true);
    });

    it('marks future conditions correctly', async () => {
      http.mockReturnValue(okHttp([{ condition_id: 'c3', condition_type: 'block', is_active: 0, is_expired: 0 }]));
      const result: any = await service.getConditionsListByAccount('acc1', 'DEFAULT');
      expect(result.conditions[0].isActive).toBe(false);
      expect(result.conditions[0].isExpired).toBe(false);
    });

    it('applies asOfDate filter when showInactive is false', async () => {
      await service.getConditionsListByAccount('acc1', 'DEFAULT', '2024-01-01', false);
      expect(http).toHaveBeenCalled();
    });

    it('skips date filter when showInactive is true', async () => {
      await service.getConditionsListByAccount('acc1', 'DEFAULT', '2024-01-01', true);
      expect(http).toHaveBeenCalled();
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getConditionsListByAccount('acc1')).rejects.toThrow(HttpException);
    });
  });

  describe('getEvaluatedTransactionsByAccount', () => {
    it('returns BLOCKED transactions', async () => {
      http.mockReturnValue(
        okHttp([
          {
            tx_transaction_id: 'tx1',
            tx_event_ts: '2024-01-01',
            tx_amount: 100,
            cond_condition_id: 'c1',
            cond_type: 'block',
            cond_account_id: 'acc1',
          },
        ]),
      );
      const result = await service.getEvaluatedTransactionsByAccount('acc1', 'DEFAULT');
      expect(result.transactions).toHaveLength(1);
      expect(result.transactions[0].outcome).toBe('BLOCKED');
    });

    it('returns DATA_NOT_FOUND metadata when empty', async () => {
      http.mockReturnValue(okHttp([]));
      const result = await service.getEvaluatedTransactionsByAccount('acc1');
      expect(result.metadata.status).toBe('DATA_NOT_FOUND');
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getEvaluatedTransactionsByAccount('acc1')).rejects.toThrow(HttpException);
    });
  });

  // ===================== TRANSACTION-BASED CONDITIONS =====================
  describe('getConditionsSummaryByTransaction', () => {
    it('returns summary', async () => {
      http
        .mockReturnValueOnce(okHttp([{ debtor_account_id: 'acc1', creditor_account_id: 'acc2', tx_event_ts: '2024-01-01' }]))
        .mockReturnValueOnce(okHttp([{ total_conditions: 3, active_conditions: 2, expired_conditions: 1 }]));
      const result: any = await service.getConditionsSummaryByTransaction(123, 'DEFAULT');
      expect(result.totalConditions).toBe(3);
    });

    it('returns not found message when tx missing', async () => {
      http.mockReturnValue(okHttp([]));
      const result: any = await service.getConditionsSummaryByTransaction(999);
      expect(result.conditions).toBe(0);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getConditionsSummaryByTransaction(1)).rejects.toThrow(HttpException);
    });
  });

  describe('getExpiredConditionsByTransaction', () => {
    it('returns expired conditions', async () => {
      http
        .mockReturnValueOnce(okHttp([{ debtor_account_id: 'acc1', creditor_account_id: 'acc2', tx_event_ts: '2024-01-01' }]))
        .mockReturnValueOnce(okHttp([{ condition_id: 'c1', condition_type: 'block' }]));
      const result: any = await service.getExpiredConditionsByTransaction(123, 'DEFAULT');
      expect(result.conditions).toHaveLength(1);
    });

    it('returns not found when tx missing', async () => {
      http.mockReturnValue(okHttp([]));
      const result: any = await service.getExpiredConditionsByTransaction(999);
      expect(result.conditions).toEqual([]);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getExpiredConditionsByTransaction(1)).rejects.toThrow(HttpException);
    });
  });

  describe('getConditionDetails', () => {
    it('returns condition details', async () => {
      http.mockReturnValue(okHttp([{ cond_condition_id: 'c1', cond_reason: 'Test', cond_is_active: 1, cond_is_expired: 0 }]));
      const result: any = await service.getConditionDetails('c1', 'DEFAULT');
      expect(result.conditionId).toBe('c1');
      expect(result.status).toBe('active');
    });

    it('maps expired status', async () => {
      http.mockReturnValue(okHttp([{ cond_condition_id: 'c2', cond_is_active: 0, cond_is_expired: 1 }]));
      const result: any = await service.getConditionDetails('c2');
      expect(result.status).toBe('expired');
    });

    it('maps future status', async () => {
      http.mockReturnValue(okHttp([{ cond_condition_id: 'c3', cond_is_active: 0, cond_is_expired: 0 }]));
      const result: any = await service.getConditionDetails('c3');
      expect(result.status).toBe('future');
    });

    it('throws NOT_FOUND when condition missing', async () => {
      http.mockReturnValue(okHttp([]));
      await expect(service.getConditionDetails('not-found')).rejects.toThrow(HttpException);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getConditionDetails('c1')).rejects.toThrow(HttpException);
    });
  });

  // ===================== getConditionsContextByTransaction =====================
  describe('getConditionsContextByTransaction', () => {
    it('adds extra entity accounts from account_holder', async () => {
      http
        .mockReturnValueOnce(
          okHttp([
            {
              transaction_id: 1,
              tx_event_ts: '2024-01-01',
              end_to_end_id: 'e2e1',
              debtor_id: 'entity1',
              debtor_account_id: 'acc1',
              creditor_id: 'entity2',
              creditor_account_id: 'acc2',
            },
          ]),
        )
        // debtor entity lookup returns extra account acc3 with account_id
        .mockReturnValueOnce(okHttp([{ account_id: 'acc3' }]))
        // condition count for acc1
        .mockReturnValueOnce(okHttp([{ total: 0, active: 0, expired: 0, future: 0 }]))
        // condition count for acc3
        .mockReturnValueOnce(okHttp([{ total: 1, active: 1, expired: 0, future: 0 }]))
        // creditor entity lookup returns acc2 with account_id
        .mockReturnValueOnce(okHttp([{ account_id: 'acc2' }]))
        // condition count for acc2
        .mockReturnValueOnce(okHttp([{ total: 0, active: 0, expired: 0, future: 0 }]));
      const result = await service.getConditionsContextByTransaction(1, 'DEFAULT');
      expect(result.debtor.primaryAccountId).toBe('acc1');
      expect(result.debtor.accounts.length).toBeGreaterThanOrEqual(1);
    });

    it('returns conditions context with entity accounts resolved', async () => {
      // TX has debtor_id + debtor_account_id → covers getEntityAccountsWithConditionCounts branches
      http.mockReturnValueOnce(
        okHttp([
          {
            transaction_id: 1,
            tx_event_ts: '2024-01-01',
            end_to_end_id: 'e2e1',
            tx_type: 'PAYMENT',
            interbank_settlement_amount: 100,
            interbank_settlement_currency: 'USD',
            debtor_id: 'entity1',
            debtor_account_id: 'acc1',
            creditor_id: 'entity2',
            creditor_account_id: 'acc2',
          },
        ]),
      );
      // remaining calls (entity account lookups + condition counts) use default mock
      const result = await service.getConditionsContextByTransaction(1, 'DEFAULT');
      expect(result.transaction).toBeDefined();
      expect(result.debtor.primaryAccountId).toBe('acc1');
    });

    it('returns conditions context without entity ids', async () => {
      http.mockReturnValue(okHttp([{ transaction_id: 1, tx_event_ts: '2024-01-01' }]));
      const result = await service.getConditionsContextByTransaction(1, 'DEFAULT');
      expect(result.transaction).toBeDefined();
    });

    it('throws when transaction not found', async () => {
      http.mockReturnValue(okHttp([]));
      await expect(service.getConditionsContextByTransaction(999)).rejects.toThrow(HttpException);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getConditionsContextByTransaction(1)).rejects.toThrow(HttpException);
    });
  });

  // ===================== getConditionsByEntity =====================
  describe('getConditionsByEntity', () => {
    it('returns conditions for entity with accounts', async () => {
      http
        .mockReturnValueOnce(okHttp([{ account_id: 'acc1' }]))
        .mockReturnValueOnce(okHttp([{ condition_id: 'c1', condition_type: 'block', is_active: 1 }]));
      const result = await service.getConditionsByEntity('entity1', 'DEFAULT');
      expect(result.conditions).toHaveLength(1);
    });

    it('applies asOfDate date filter when showInactive is false', async () => {
      http.mockReturnValueOnce(okHttp([{ account_id: 'acc1' }])).mockReturnValueOnce(okHttp([]));
      const result = await service.getConditionsByEntity('entity1', 'DEFAULT', '2024-01-01', false);
      expect(result.conditions).toEqual([]);
    });

    it('skips date filter when showInactive is true', async () => {
      http.mockReturnValueOnce(okHttp([{ account_id: 'acc1' }])).mockReturnValueOnce(okHttp([]));
      const result = await service.getConditionsByEntity('entity1', 'DEFAULT', '2024-01-01', true);
      expect(result.conditions).toEqual([]);
    });

    it('returns empty result when no accounts found', async () => {
      http.mockReturnValue(okHttp([]));
      const result = await service.getConditionsByEntity('entity_unknown', 'DEFAULT');
      expect(result.accounts).toEqual([]);
      expect(result.conditions).toEqual([]);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getConditionsByEntity('entity1')).rejects.toThrow(HttpException);
    });
  });
});
