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

    it('selects entity_id and falls back to "no data found" for an account-scoped condition (entity_id is null in the DB for these)', async () => {
      http.mockReturnValue(okHttp([{ condition_id: 'c1', condition_type: 'block', account_id: 'acc1', entity_id: null }]));
      const result: any = await service.getConditionsListByAccount('acc1', 'DEFAULT');
      expect(result.conditions[0].entityId).toBe('no data found');

      const sql = http.mock.calls[0][1].sql_query as string;
      expect(sql).toMatch(/SELECT[\s\S]*\bentity_id\b[\s\S]*FROM conditions/);
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

    it('applies asOfDate filter when showInactive is false, excluding conditions expiring exactly at asOfDate', async () => {
      await service.getConditionsListByAccount('acc1', 'DEFAULT', '2024-01-01', false);
      expect(http).toHaveBeenCalled();

      const sql = http.mock.calls[0][1].sql_query as string;
      expect(sql).toContain('condition_inception_ts <=');
      expect(sql).toContain('condition_expiry_ts >');
      expect(sql).not.toContain('condition_expiry_ts >=');
    });

    it('skips date filter when showInactive is true', async () => {
      await service.getConditionsListByAccount('acc1', 'DEFAULT', '2024-01-01', true);
      expect(http).toHaveBeenCalled();

      const sql = http.mock.calls[0][1].sql_query as string;
      expect(sql).not.toContain('condition_inception_ts <=');
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

    it('looks entities up in account_holder by the id as stored when it already ends in TAZAMA_EID', async () => {
      // transaction_detail ids carry the suffix themselves; adding it again would match no account_holder row
      const accountHolderSources: string[] = [];
      http.mockImplementation((_url: string, body: { sql_query: string }) => {
        const sql = body.sql_query ?? '';
        if (sql.includes('FROM transaction_detail')) {
          return okHttp([
            {
              transaction_id: 1,
              tx_event_ts: '2024-01-01T00:00:00.000Z',
              end_to_end_id: 'e2e1',
              tx_type: 'pacs.008.001.10',
              debtor_id: 'entity1TAZAMA_EID',
              debtor_account_id: 'acc1',
              creditor_id: 'entity2TAZAMA_EID',
              creditor_account_id: 'acc2',
            },
          ]);
        }
        if (sql.includes('FROM account_holder')) {
          accountHolderSources.push(...(sql.match(/source = '([^']+)'/) ?? []).slice(1));
          return okHttp([{ account_id: 'accFromHolder' }]);
        }
        return okHttp([{ total: 0, active: 0, expired: 0, future: 0 }]);
      });

      await service.getConditionsContextByTransaction('e2e1', 'DEFAULT');

      expect(accountHolderSources).toEqual(expect.arrayContaining(['entity1TAZAMA_EID', 'entity2TAZAMA_EID']));
      expect(accountHolderSources.some((source) => source.includes('TAZAMA_EIDTAZAMA_EID'))).toBe(false);
    });

    it('seeds the primary account when account_holder does not cover it yet, without duplicating an account it already covers', async () => {
      // Content-routed mock (rather than mockReturnValueOnce sequencing) since
      // this test cares about the *set* of accounts produced, not the exact
      // order Promise.all happens to fire calls in.
      http.mockImplementation((_url: string, body: { sql_query: string }) => {
        const sql = body.sql_query ?? '';
        if (sql.includes('FROM transaction_detail')) {
          return okHttp([
            {
              transaction_id: 1,
              tx_event_ts: '2024-01-01T00:00:00.000Z',
              end_to_end_id: 'e2e1',
              tx_type: 'pacs.008.001.10',
              debtor_id: 'entity1',
              debtor_account_id: 'acc1', // plain form; account_holder (below) doesn't know about it
              creditor_id: 'entity2',
              creditor_account_id: 'acc2', // plain form; account_holder DOES cover it, as its composite form
            },
          ]);
        }
        if (sql.includes('FROM account_holder')) {
          if (sql.includes("'entity1TAZAMA_EID'")) return okHttp([]); // debtor: nothing yet - ETL lag
          if (sql.includes("'entity2TAZAMA_EID'")) return okHttp([{ account_id: 'acc2MSISDNfsp001' }]); // creditor: already covered
          return okHttp([]);
        }
        if (sql.includes("target_type = 'ENTITY'")) {
          return okHttp([]); // no entity-level conditions in this test
        }
        if (sql.includes('FROM conditions')) {
          if (sql.includes("'acc1'")) {
            // found only via the account_id fallback, since 'acc1' isn't a real condition_key_key
            return okHttp([{ condition_id: 'c1', condition_type: 'block', account_id: 'acc1', condition_inception_ts: '2020-01-01T00:00:00.000Z' }]);
          }
          return okHttp([]);
        }
        return okHttp([]);
      });

      const result = await service.getConditionsContextByTransaction('e2e1', 'DEFAULT');

      // debtor: the primary account gets exactly one chip, seeded rather than dropped
      expect(result.debtor.accounts).toHaveLength(1);
      expect(result.debtor.accounts[0].accountId).toBe('acc1');
      expect(result.debtor.accounts[0].isTransactionAccount).toBe(true);
      expect(result.debtor.accounts[0].conditions).toHaveLength(1);
      // account-scoped condition has no entity_id in the DB - falls back like any other missing field
      expect(result.debtor.accounts[0].conditions[0].entityId).toBe('no data found');

      // creditor: already covered by account_holder - seeding must not add a duplicate chip
      expect(result.creditor.accounts).toHaveLength(1);
      expect(result.creditor.accounts[0].accountId).toBe('acc2MSISDNfsp001');
      expect(result.creditor.accounts[0].isTransactionAccount).toBe(true);

      const debtorConditionsSql = http.mock.calls.find(
        (call) => (call[1] as { sql_query: string }).sql_query.includes('FROM conditions') && (call[1] as { sql_query: string }).sql_query.includes("'acc1'"),
      )?.[1].sql_query as string;
      expect(debtorConditionsSql).toMatch(/SELECT[\s\S]*\bentity_id\b[\s\S]*FROM conditions/);
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

    it('filters by tx_type, orders by most recent, and limits to one row at the SQL level, so a high-row-count end_to_end_id (retries, replays) cannot push the real pacs.008 record out of a client-side scan', async () => {
      http.mockReturnValueOnce(
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
      );
      await service.getConditionsContextByTransaction('e2e1', 'DEFAULT');

      const txSql = http.mock.calls[0][1].sql_query as string;
      expect(txSql).toContain("tx_type = 'pacs.008.001.10'");
      expect(txSql).toContain('ORDER BY tx_event_ts DESC');
      expect(txSql).toContain('LIMIT 1');
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
      expect(result.debtor.entityConditions[0].entityId).toBe('entity1');
      expect(result.debtor.entityConditions[0].accountId).toBe('no data found');

      const debtorEntitySql = http.mock.calls[3][1].sql_query as string;
      expect(debtorEntitySql).toContain("target_type = 'ENTITY'");
      expect(debtorEntitySql).toContain('entity_id IN');
      // entity_id must also be in the SELECT list (not just the WHERE clause),
      // since that's what lets formatConditionRow populate entityId.
      expect(debtorEntitySql).toMatch(/SELECT[\s\S]*\bentity_id\b[\s\S]*FROM conditions/);
    });

    it('finds entity-level conditions by the bare id when the transaction id carries the TAZAMA_EID suffix', async () => {
      // conditions.entity_id holds the bare id; transaction_detail ids end in TAZAMA_EID
      const entitySql: string[] = [];
      http.mockImplementation((_url: string, body: { sql_query: string }) => {
        const sql = body.sql_query ?? '';
        if (sql.includes('FROM transaction_detail')) {
          return okHttp([
            {
              transaction_id: 1,
              tx_event_ts: '2024-01-01T00:00:00.000Z',
              end_to_end_id: 'e2e1',
              tx_type: 'pacs.008.001.10',
              debtor_id: 'entity1TAZAMA_EID',
              debtor_account_id: 'acc1',
              creditor_id: 'entity2TAZAMA_EID',
              creditor_account_id: 'acc2',
            },
          ]);
        }
        if (sql.includes("target_type = 'ENTITY'")) {
          entitySql.push(sql);
          return okHttp(sql.includes("'entity2'") ? [{ condition_id: 'ec2', condition_type: 'overridable-block', entity_id: 'entity2' }] : []);
        }
        return okHttp([]);
      });

      const result = await service.getConditionsContextByTransaction('e2e1', 'DEFAULT');

      // each lookup offers the bare id and the suffixed id, so a condition stored either way is found
      expect(entitySql).toHaveLength(2);
      entitySql.forEach((sql) => {
        expect(sql).toMatch(/entity_id IN \('entity[12]', 'entity[12]TAZAMA_EID'\)/);
        expect(sql).not.toContain('TAZAMA_EIDTAZAMA_EID');
      });
      expect(result.creditor.entityConditions).toHaveLength(1);
      expect(result.creditor.entityConditions[0].entityId).toBe('entity2');
    });

    describe('when transaction_detail has no debtor_id / creditor_id', () => {
      const txRow = {
        transaction_id: 1,
        tx_event_ts: '2024-01-01T00:00:00.000Z',
        end_to_end_id: 'e2e1',
        tx_type: 'pacs.008.001.10',
        debtor_id: null,
        debtor_account_id: 'acc1',
        creditor_id: null,
        creditor_account_id: 'acc2',
      };
      const isOwnerLookup = (sql: string): boolean => sql.includes('SELECT source FROM account_holder');

      it('finds the entity through the account in account_holder, so its entity-level conditions are still returned', async () => {
        const ownerLookups: string[] = [];
        http.mockImplementation((_url: string, body: { sql_query: string }) => {
          const sql = body.sql_query ?? '';
          if (sql.includes('FROM transaction_detail')) return okHttp([txRow]);
          if (isOwnerLookup(sql)) {
            ownerLookups.push(sql);
            return okHttp([{ source: sql.includes("'acc1'") ? 'entity1TAZAMA_EID' : 'entity2TAZAMA_EID' }]);
          }
          if (sql.includes("target_type = 'ENTITY'")) {
            return okHttp(sql.includes("'entity1'") ? [{ condition_id: 'ec1', condition_type: 'non-overridable-block', entity_id: 'entity1' }] : []);
          }
          return okHttp([]);
        });

        const result = await service.getConditionsContextByTransaction('e2e1', 'DEFAULT');

        expect(ownerLookups).toHaveLength(2);
        expect(ownerLookups[0]).toContain("destination = 'acc1'");
        expect(result.debtor.entityId).toBe('entity1TAZAMA_EID');
        expect(result.creditor.entityId).toBe('entity2TAZAMA_EID');
        expect(result.debtor.entityConditions).toHaveLength(1);
        expect(result.debtor.entityConditions[0].entityId).toBe('entity1');
        expect(result.creditor.entityConditions).toEqual([]);
      });

      it('leaves the party as "no data found" and runs no entity-level query when account_holder does not know the account', async () => {
        const sqls: string[] = [];
        http.mockImplementation((_url: string, body: { sql_query: string }) => {
          const sql = body.sql_query ?? '';
          sqls.push(sql);
          return okHttp(sql.includes('FROM transaction_detail') ? [txRow] : []);
        });

        const result = await service.getConditionsContextByTransaction('e2e1', 'DEFAULT');

        expect(result.debtor.entityId).toBe('no data found');
        expect(result.creditor.entityId).toBe('no data found');
        expect(sqls.some((sql) => sql.includes("target_type = 'ENTITY'"))).toBe(false);
      });

      it('still returns the conditions view when the account_holder lookup fails', async () => {
        http.mockImplementation((_url: string, body: { sql_query: string }) => {
          const sql = body.sql_query ?? '';
          if (sql.includes('FROM transaction_detail')) return okHttp([txRow]);
          if (isOwnerLookup(sql)) return errHttp('lookup failed');
          return okHttp([]);
        });

        const result = await service.getConditionsContextByTransaction('e2e1', 'DEFAULT');

        expect(result.debtor.entityId).toBe('no data found');
        expect(result.debtor.entityConditions).toEqual([]);
      });

      it('does not look anything up when transaction_detail already has the party id', async () => {
        const sqls: string[] = [];
        http.mockImplementation((_url: string, body: { sql_query: string }) => {
          const sql = body.sql_query ?? '';
          sqls.push(sql);
          return okHttp(sql.includes('FROM transaction_detail') ? [{ ...txRow, debtor_id: 'entity1TAZAMA_EID', creditor_id: 'entity2TAZAMA_EID' }] : []);
        });

        const result = await service.getConditionsContextByTransaction('e2e1', 'DEFAULT');

        expect(sqls.some(isOwnerLookup)).toBe(false);
        expect(result.debtor.entityId).toBe('entity1TAZAMA_EID');
      });
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
    it('matches entity-level conditions by the bare id when called with the suffixed id', async () => {
      http
        .mockReturnValueOnce(okHttp([{ account_id: 'acc1' }]))
        .mockReturnValueOnce(okHttp([{ condition_id: 'ec1', condition_type: 'overridable-block', entity_id: 'entity1', is_active: 1 }]));

      const result = await service.getConditionsByEntity('entity1TAZAMA_EID', 'DEFAULT');

      // the account_holder lookup binds source to the id exactly as passed in
      const accountHolderSql = http.mock.calls[0][1].sql_query as string;
      expect(accountHolderSql).toContain("source = 'entity1TAZAMA_EID'");

      const conditionsSql = http.mock.calls[1][1].sql_query as string;
      expect(conditionsSql).toMatch(/entity_id IN \('entity1', 'entity1TAZAMA_EID'\)/);
      expect(result.conditions).toHaveLength(1);
    });

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
