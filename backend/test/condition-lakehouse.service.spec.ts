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

  // ===================== getConditionsListByAccount =====================
  describe('getConditionsListByAccount', () => {
    it('returns conditions list', async () => {
      http.mockReturnValue(okHttp([{ condition_id: 'c1', condition_type: 'block', is_active: 1, is_expired: 0 }]));
      const result = await service.getConditionsListByAccount('acc1', 'DEFAULT');
      expect(result.conditions).toHaveLength(1);
    });

    it('marks expired conditions correctly', async () => {
      http.mockReturnValue(
        okHttp([
          {
            condition_id: 'c2',
            condition_type: 'block',
            condition_inception_ts: '2020-01-01T00:00:00.000Z',
            condition_expiry_ts: '2020-06-01T00:00:00.000Z',
            is_active: 0,
            is_expired: 1,
          },
        ]),
      );
      const result: any = await service.getConditionsListByAccount('acc1', 'DEFAULT');
      expect(result.conditions[0].isExpired).toBe(true);
    });

    it('marks future conditions correctly', async () => {
      http.mockReturnValue(
        okHttp([
          {
            condition_id: 'c3',
            condition_type: 'block',
            condition_inception_ts: '2099-01-01T00:00:00.000Z',
            is_active: 0,
            is_expired: 0,
          },
        ]),
      );
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
      await expect(service.getConditionsListByAccount('acc1', 'DEFAULT')).rejects.toThrow(HttpException);
    });

    it('maps the real pk column instead of hardcoding "no mapping found"', async () => {
      http.mockReturnValue(okHttp([{ pk: 'real-pk-value', condition_id: 'c1', condition_type: 'block', is_active: 1, is_expired: 0 }]));
      const result: any = await service.getConditionsListByAccount('acc1', 'DEFAULT');
      expect(result.conditions[0].pk).toBe('real-pk-value');
    });

    it('falls back to "no mapping found" when pk is absent', async () => {
      http.mockReturnValue(okHttp([{ condition_id: 'c1', condition_type: 'block', is_active: 1, is_expired: 0 }]));
      const result: any = await service.getConditionsListByAccount('acc1', 'DEFAULT');
      expect(result.conditions[0].pk).toBe('no mapping found');
    });
  });

  // classifyConditionByDate/formatConditionRow are private; exercised here via
  // getConditionsListByAccount, which surfaces both the per-condition
  // isActive/isExpired flags and the aggregate metadata counts they drive.
  describe('classifyConditionByDate / formatConditionRow date-boundary behavior', () => {
    const asOfDate = '2024-06-15T12:00:00.000Z';

    it('classifies a condition within [inception, expiry) as active', async () => {
      http.mockReturnValue(
        okHttp([
          { condition_id: 'c1', condition_inception_ts: '2024-01-01T00:00:00.000Z', condition_expiry_ts: '2024-12-31T00:00:00.000Z' },
        ]),
      );
      const result: any = await service.getConditionsListByAccount('acc1', 'DEFAULT', asOfDate);
      expect(result.conditions[0].isActive).toBe(true);
      expect(result.conditions[0].isExpired).toBe(false);
      expect(result.metadata.activeCount).toBe(1);
    });

    it('classifies a condition with no expiry as active once inception has passed', async () => {
      http.mockReturnValue(okHttp([{ condition_id: 'c1', condition_inception_ts: '2024-01-01T00:00:00.000Z', condition_expiry_ts: null }]));
      const result: any = await service.getConditionsListByAccount('acc1', 'DEFAULT', asOfDate);
      expect(result.conditions[0].isActive).toBe(true);
    });

    it('classifies a condition inceptioning exactly at asOfDate as active (inclusive lower bound)', async () => {
      http.mockReturnValue(okHttp([{ condition_id: 'c1', condition_inception_ts: asOfDate, condition_expiry_ts: null }]));
      const result: any = await service.getConditionsListByAccount('acc1', 'DEFAULT', asOfDate);
      expect(result.conditions[0].isActive).toBe(true);
    });

    it('classifies a condition expiring exactly at asOfDate as expired (exclusive upper bound)', async () => {
      http.mockReturnValue(
        okHttp([{ condition_id: 'c1', condition_inception_ts: '2024-01-01T00:00:00.000Z', condition_expiry_ts: asOfDate }]),
      );
      const result: any = await service.getConditionsListByAccount('acc1', 'DEFAULT', asOfDate);
      expect(result.conditions[0].isActive).toBe(false);
      expect(result.conditions[0].isExpired).toBe(true);
      expect(result.metadata.expiredCount).toBe(1);
    });

    it('classifies a condition expiring one millisecond after asOfDate as still active', async () => {
      http.mockReturnValue(
        okHttp([{ condition_id: 'c1', condition_inception_ts: '2024-01-01T00:00:00.000Z', condition_expiry_ts: '2024-06-15T12:00:00.001Z' }]),
      );
      const result: any = await service.getConditionsListByAccount('acc1', 'DEFAULT', asOfDate);
      expect(result.conditions[0].isActive).toBe(true);
      expect(result.conditions[0].isExpired).toBe(false);
    });

    it('classifies a condition with a future inception as neither active nor expired', async () => {
      http.mockReturnValue(okHttp([{ condition_id: 'c1', condition_inception_ts: '2099-01-01T00:00:00.000Z', condition_expiry_ts: null }]));
      const result: any = await service.getConditionsListByAccount('acc1', 'DEFAULT', asOfDate);
      expect(result.conditions[0].isActive).toBe(false);
      expect(result.conditions[0].isExpired).toBe(false);
      expect(result.metadata.futureCount).toBe(1);
    });

    it('leaves a condition with no inception timestamp unclassified - not active, not expired, not counted as future', async () => {
      http.mockReturnValue(okHttp([{ condition_id: 'c1', condition_inception_ts: null, condition_expiry_ts: null }]));
      const result: any = await service.getConditionsListByAccount('acc1', 'DEFAULT', asOfDate);
      expect(result.conditions[0].isActive).toBe(false);
      expect(result.conditions[0].isExpired).toBe(false);
      expect(result.metadata.activeCount).toBe(0);
      expect(result.metadata.expiredCount).toBe(0);
      expect(result.metadata.futureCount).toBe(0);
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
              tx_type: 'pacs.008.001.10',
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
      const result = await service.getConditionsContextByTransaction('TMICFBPK2801321903297120', 'DEFAULT');
      expect(result.debtor.primaryAccountId).toBe('acc1');
      expect(result.debtor.accounts.length).toBeGreaterThanOrEqual(1);
    });

    it('returns conditions context with entity accounts resolved', async () => {
      http.mockReturnValueOnce(
        okHttp([
          {
            transaction_id: 'TMICFBPK2801321903297120',
            tx_event_ts: '2024-01-01',
            end_to_end_id: 'e2e1',
            tx_type: 'pacs.008.001.10',
            interbank_settlement_amount: 100,
            interbank_settlement_currency: 'USD',
            debtor_id: 'entity1',
            debtor_account_id: 'acc1',
            creditor_id: 'entity2',
            creditor_account_id: 'acc2',
          },
        ]),
      );
      const result = await service.getConditionsContextByTransaction('TMICFBPK2801321903297120', 'DEFAULT');
      expect(result.transaction).toBeDefined();
      expect(result.debtor.primaryAccountId).toBe('acc1');
    });

    it('returns conditions context without entity ids', async () => {
      http.mockReturnValue(okHttp([{ transaction_id: 1, tx_event_ts: '2024-01-01', tx_type: 'pacs.008.001.10' }]));
      const result = await service.getConditionsContextByTransaction('TMICFBPK2801321903297120', 'DEFAULT');
      expect(result.transaction).toBeDefined();
    });

    it('throws when transaction not found', async () => {
      http.mockReturnValue(okHttp([]));
      await expect(service.getConditionsContextByTransaction('TMICFBPK2801321903297120', 'DEFAULT')).rejects.toThrow(HttpException);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getConditionsContextByTransaction('TMICFBPK2801321903297120', 'DEFAULT')).rejects.toThrow(HttpException);
    });
  });

  // getEntityLevelConditions is private; exercised here via
  // getConditionsContextByTransaction's debtor/creditor.entityConditions.
  describe('getEntityLevelConditions (via getConditionsContextByTransaction)', () => {
    it('queries target_type = ENTITY and returns entityConditions per party', async () => {
      http
        .mockReturnValueOnce(
          okHttp([
            {
              transaction_id: 1,
              tx_event_ts: '2024-01-01T00:00:00.000Z',
              end_to_end_id: 'e2e1',
              tx_type: 'pacs.008.001.10',
              debtor_id: 'entity1',
              debtor_account_id: 'acc1',
              creditor_id: 'entity2',
              creditor_account_id: 'acc2',
            },
          ]),
        ) // transaction lookup
        .mockReturnValueOnce(okHttp([])) // debtor account_holder -> no accounts
        .mockReturnValueOnce(okHttp([])) // creditor account_holder -> no accounts
        .mockReturnValueOnce(okHttp([{ condition_id: 'ec1', condition_type: 'overridable-block', entity_id: 'entity1' }])) // debtor entity-level conditions
        .mockReturnValueOnce(okHttp([])); // creditor entity-level conditions

      const result = await service.getConditionsContextByTransaction('e2e1', 'DEFAULT');

      expect(result.debtor.entityConditions).toHaveLength(1);
      expect(result.creditor.entityConditions).toEqual([]);

      const debtorEntitySql = http.mock.calls[3][1].sql_query as string;
      expect(debtorEntitySql).toContain("target_type = 'ENTITY'");
      expect(debtorEntitySql).toContain('entity_id =');
    });

    it('returns empty entityConditions for both parties when entity ids are missing', async () => {
      http.mockReturnValueOnce(okHttp([{ transaction_id: 1, tx_event_ts: '2024-01-01T00:00:00.000Z', tx_type: 'pacs.008.001.10' }]));
      const result = await service.getConditionsContextByTransaction('e2e1', 'DEFAULT');
      expect(result.debtor.entityConditions).toEqual([]);
      expect(result.creditor.entityConditions).toEqual([]);
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
      await expect(service.getConditionsByEntity('entity1', 'DEFAULT')).rejects.toThrow(HttpException);
    });

    it('filters on the real target_type column instead of the non-existent identity_type', async () => {
      http.mockReturnValueOnce(okHttp([{ account_id: 'acc1' }])).mockReturnValueOnce(okHttp([]));
      await service.getConditionsByEntity('entity1', 'DEFAULT');

      const conditionsSql = http.mock.calls[1][1].sql_query as string;
      expect(conditionsSql).toContain("target_type = 'ACCOUNT'");
      expect(conditionsSql).toContain("target_type = 'ENTITY'");
      expect(conditionsSql).not.toContain('identity_type');
    });
  });
});
