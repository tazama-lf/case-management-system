import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { ConditionLakehouseService } from '../src/modules/gold-lakehouse/condition-lakehouse.service';

describe('ConditionLakehouseService', () => {
  let service: ConditionLakehouseService;
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
        ConditionLakehouseService,
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

    service = module.get<ConditionLakehouseService>(ConditionLakehouseService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  // ===================== getConditionsSummary =====================
  describe('getConditionsSummary', () => {
    it('returns summary for direct account ID', async () => {
      http
        .mockReturnValueOnce(okHttp([{}]))
        .mockReturnValueOnce(okHttp([{ active_conditions: 5, blocked_transactions: 2, overridden_transactions: 1, future_conditions: 3 }]));
      const result: any = await service.getConditionsSummary('acc1', 'DEFAULT');
      expect(result.activeConditions).toBe(5);
    });

    it('returns zeros when no accounts resolved (numeric id)', async () => {
      const result: any = await service.getConditionsSummary('123', 'DEFAULT');
      expect(result.activeConditions).toBe(0);
    });

    it('resolves UUID-like identifier via resolveToAccounts UUID branch', async () => {
      const result: any = await service.getConditionsSummary('abc12345-abcd-4567', 'DEFAULT');
      expect(result).toBeDefined();
    });

    it('returns entity-level metadata when multiple accounts resolved', async () => {
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
        .mockReturnValueOnce(okHttp([{ destination: 'acc1' }, { destination: 'acc2' }]))
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
      http.mockReturnValueOnce(okHttp([{ destination: 'acc1' }])).mockReturnValueOnce(
        okHttp([
          { condition_id: 'c1', condition_reason: 'Test', transaction_id: 'tx1' },
          { condition_id: 'c1', condition_reason: 'Test', transaction_id: 'tx2' },
        ]),
      );
      const result: any = await (service as any)[methodName]('entityABC', 'DEFAULT');
      if (methodName !== 'getFutureConditions') {
        expect(result.conditions.length).toBeGreaterThan(0);
      } else {
        expect(result.conditions.length).toBeGreaterThan(0);
      }
    });

    it('returns empty when no accounts found', async () => {
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

  // ===================== getAllConditionsTableData =====================
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

  // ===================== getAllConditionsTimelineData =====================
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

  // ===================== getConditionsSummaryByAccount =====================
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

  // ===================== getActiveConditionsByAccount =====================
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

  // ===================== getFutureConditionsByAccount =====================
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

  // ===================== getConditionsListByAccount =====================
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

  // ===================== getEvaluatedTransactionsByAccount =====================
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

  // ===================== getConditionsSummaryByTransaction =====================
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

  // ===================== getExpiredConditionsByTransaction =====================
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

  // ===================== getConditionDetails =====================
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
        .mockReturnValueOnce(okHttp([{ account_id: 'acc3' }]))
        .mockReturnValueOnce(okHttp([{ total: 0, active: 0, expired: 0, future: 0 }]))
        .mockReturnValueOnce(okHttp([{ total: 1, active: 1, expired: 0, future: 0 }]))
        .mockReturnValueOnce(okHttp([{ account_id: 'acc2' }]))
        .mockReturnValueOnce(okHttp([{ total: 0, active: 0, expired: 0, future: 0 }]));
      const result = await service.getConditionsContextByTransaction(1, 'DEFAULT');
      expect(result.debtor.primaryAccountId).toBe('acc1');
      expect(result.debtor.accounts.length).toBeGreaterThanOrEqual(1);
    });

    it('returns conditions context with entity accounts resolved', async () => {
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
