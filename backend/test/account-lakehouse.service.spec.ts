import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AccountLakehouseService } from '../src/modules/gold-lakehouse/account-lakehouse.service';
import { AlertRepository } from '../src/modules/repository/alert.repository';

describe('AccountLakehouseService', () => {
  let service: AccountLakehouseService;
  let http: jest.Mock;
  let alertRepo: { getAlertById: jest.Mock; getReferenceId: jest.Mock };

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
    alertRepo = {
      getAlertById: jest.fn(),
      getReferenceId: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AccountLakehouseService,
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
        { provide: AlertRepository, useValue: alertRepo },
      ],
    }).compile();

    service = module.get<AccountLakehouseService>(AccountLakehouseService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  // ===================== getAccountNodeFullData =====================
  describe('getAccountNodeFullData', () => {
    const setupAccountNode = (txCount = 5, totalAmount = 2500) => {
      // Mock account_holder query (entity to accounts mapping)
      http.mockReturnValueOnce(
        okHttp([
          {
            source: 'entity1TAZAMA_EID',
            destination: 'acc1MSISDNfsp001',
            tenant_id: 'DEFAULT',
          },
        ]),
      );
      // Mock single network edges query for all accounts
      http.mockReturnValueOnce(
        okHttp([
          {
            from_account_id: 'acc1',
            to_account_id: 'acc2',
            tx_count: txCount,
            total_amount: totalAmount,
            is_alerted_edge: 0,
            is_investigated_edge: 0,
          },
        ]),
      );
    };

    it('returns account node data', async () => {
      setupAccountNode();
      const result = await service.getAccountNodeFullData('entity1', 'DEFAULT', 'month');
      expect(result.network.nodes.length).toBeGreaterThan(0);
      expect(result.accountDetails.accountId).toBe('entity1');
    });

    it('uses HIGH velocity when txCount >= 50', async () => {
      // Mock account_holder query
      http.mockReturnValueOnce(
        okHttp([
          {
            source: 'entity1TAZAMA_EID',
            destination: 'acc1MSISDNfsp001',
            tenant_id: 'DEFAULT',
          },
        ]),
      );
      // Mock single network edges query with 60 edges (total txCount = 60)
      http.mockReturnValueOnce(
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
      );
      const result = await service.getAccountNodeFullData('entity1', 'DEFAULT', 'year');
      expect(result.accountDetails.velocity).toBe('HIGH');
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getAccountNodeFullData('entity1', 'DEFAULT', 'month')).rejects.toThrow(HttpException);
    });

    it('uses MEDIUM velocity when txCount between 10 and 49', async () => {
      // Mock account_holder query
      http.mockReturnValueOnce(
        okHttp([
          {
            source: 'entity1TAZAMA_EID',
            destination: 'acc1MSISDNfsp001',
            tenant_id: 'DEFAULT',
          },
        ]),
      );
      // Mock single network edges query with 25 edges (total txCount = 25)
      http.mockReturnValueOnce(
        okHttp(
          Array(25).fill({
            from_account_id: 'acc1',
            to_account_id: 'acc2',
            tx_count: 1,
            total_amount: 100,
            is_alerted_edge: 0,
            is_investigated_edge: 0,
          }),
        ),
      );
      const result = await service.getAccountNodeFullData('entity1', 'DEFAULT', 'year');
      expect(result.accountDetails.velocity).toBe('MEDIUM');
    });

    it('does not add an unheld account (a transaction counterpart) as a node in its own right', async () => {
      // Mock account_holder query - entity only holds acc1
      http.mockReturnValueOnce(
        okHttp([
          {
            source: 'entity1TAZAMA_EID',
            destination: 'acc1MSISDNfsp001',
            tenant_id: 'DEFAULT',
          },
        ]),
      );
      // Mock network edges query with an edge from acc2 (not held) to acc1
      http.mockReturnValueOnce(
        okHttp([
          { from_account_id: 'acc2', to_account_id: 'acc1', tx_count: 2, total_amount: 200, is_alerted_edge: 0, is_investigated_edge: 0 },
        ]),
      );
      const result = await service.getAccountNodeFullData('entity1', 'DEFAULT', 'year');
      // Only nodes linked to the counterparty should appear: the counterparty itself + acc1
      expect(result.network.nodes.map((n) => n.id).sort()).toEqual(['acc1', 'entity1']);
      // acc1's edge should still reflect the transaction it had with the unheld acc2
      const acc1Edge = result.network.edges.find((e) => e.target === 'acc1');
      expect(acc1Edge?.txCount).toBe(2);
      expect(acc1Edge?.totalAmount).toBe(200);
    });

    it('builds one account-holder edge per held account, with per-account totals that avoid double-counting shared transactions', async () => {
      // Mock account_holder query with 2 accounts held by the entity
      http.mockReturnValueOnce(
        okHttp([
          {
            source: 'entity1TAZAMA_EID',
            destination: 'acc1MSISDNfsp001',
            tenant_id: 'DEFAULT',
          },
          {
            source: 'entity1TAZAMA_EID',
            destination: 'acc2MSISDNfsp001',
            tenant_id: 'DEFAULT',
          },
        ]),
      );
      // Mock network edges query: acc1<->acc2 (both held) and acc2<->acc3 (acc3 not held)
      http.mockReturnValueOnce(
        okHttp([
          { from_account_id: 'acc1', to_account_id: 'acc2', tx_count: 5, total_amount: 500, is_alerted_edge: 0, is_investigated_edge: 0 },
          { from_account_id: 'acc2', to_account_id: 'acc3', tx_count: 3, total_amount: 300, is_alerted_edge: 0, is_investigated_edge: 0 },
        ]),
      );
      const result = await service.getAccountNodeFullData('entity1', 'DEFAULT', 'month');

      // One "Account Holder Relationship" edge per held account, from the counterparty (root) to that account
      expect(result.network.edges.length).toBe(2);
      expect(result.network.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ source: 'entity1', target: 'acc1', txCount: 5, totalAmount: 500, relationship: 'Account Holder Relationship' }),
          expect.objectContaining({ source: 'entity1', target: 'acc2', txCount: 8, totalAmount: 800, relationship: 'Account Holder Relationship' }),
        ]),
      );
      // Counterparty-level totals come from the underlying transactions (deduplicated), not summed
      // per-account edges - so the acc1<->acc2 transaction is counted once, not twice.
      expect(result.accountDetails.transactions).toBe(8);
      expect(result.accountDetails.totalValue).toBe(800);
    });

    it('marks the counterparty root node and its account-holder edges as alerted when a held account was alerted', async () => {
      http.mockReturnValueOnce(
        okHttp([
          {
            source: 'entity1TAZAMA_EID',
            destination: 'acc1MSISDNfsp001',
            tenant_id: 'DEFAULT',
          },
        ]),
      );
      http.mockReturnValueOnce(
        okHttp([
          { from_account_id: 'acc1', to_account_id: 'acc2', tx_count: 4, total_amount: 400, is_alerted_edge: 1, is_investigated_edge: 0 },
        ]),
      );
      const result = await service.getAccountNodeFullData('entity1', 'DEFAULT', 'month');

      const rootNode = result.network.nodes.find((n) => n.id === 'entity1');
      const acc1Node = result.network.nodes.find((n) => n.id === 'acc1');
      expect(rootNode?.flags.alerted).toBe(true);
      expect(acc1Node?.flags.alerted).toBe(true);
      expect(result.accountDetails.flags.alerted).toBe(true);
    });

    it('computes a per-account transaction-rate frequency distinct from the HIGH/MEDIUM/LOW velocity bucket', async () => {
      http.mockReturnValueOnce(
        okHttp([
          {
            source: 'entity1TAZAMA_EID',
            destination: 'acc1MSISDNfsp001',
            tenant_id: 'DEFAULT',
          },
        ]),
      );
      // 10 transactions spread across a 5-day span => 2/day, but still only MEDIUM velocity (txCount 10-49)
      http.mockReturnValueOnce(
        okHttp([
          {
            from_account_id: 'acc1',
            to_account_id: 'acc2',
            tx_count: 10,
            total_amount: 1000,
            first_event_ts: '2024-01-01',
            last_event_ts: '2024-01-06',
            is_alerted_edge: 0,
            is_investigated_edge: 0,
          },
        ]),
      );
      const result = await service.getAccountNodeFullData('entity1', 'DEFAULT', 'month');

      expect(result.accountDetails.velocity).toBe('MEDIUM');
      expect(result.accountDetails.frequency).toBe('2/day');

      const acc1Edge = result.network.edges.find((e) => e.target === 'acc1');
      expect(acc1Edge?.frequency).toBe('2/day');
      // Frequency and velocity must be independently meaningful, not the same bucket under two names
      expect(acc1Edge?.frequency).not.toBe(result.accountDetails.velocity);
    });

    it('falls back to a single-day window when an account has no distinct first/last event timestamps', async () => {
      http.mockReturnValueOnce(
        okHttp([
          {
            source: 'entity1TAZAMA_EID',
            destination: 'acc1MSISDNfsp001',
            tenant_id: 'DEFAULT',
          },
        ]),
      );
      http.mockReturnValueOnce(
        okHttp([
          { from_account_id: 'acc1', to_account_id: 'acc2', tx_count: 3, total_amount: 300, is_alerted_edge: 0, is_investigated_edge: 0 },
        ]),
      );
      const result = await service.getAccountNodeFullData('entity1', 'DEFAULT', 'month');

      const acc1Edge = result.network.edges.find((e) => e.target === 'acc1');
      expect(acc1Edge?.frequency).toBe('3/day');
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
        .mockReturnValueOnce(okHttp([{ counterparty_id: 'cp1', holder_name: 'CP Name' }]))
        .mockReturnValueOnce(okHttp([{ transactions: 10, total_value: 5000, is_alerted: 0, is_investigated: 0 }]))
        .mockReturnValueOnce(okHttp([{ holder_name: 'CP Name' }]));
      const result = await service.getCounterpartyNodeFullData('cp1', 'DEFAULT', 'month');
      expect(result.network.rootNodeId).toBe('cp1');
      expect(result.network.nodes.length).toBeGreaterThan(0);
      expect(result.counterpartyDetails.name).toBe('CP Name');
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
        .mockReturnValueOnce(okHttp([{ counterparty_id: 'cp1', holder_name: 'CP Name' }]))
        .mockReturnValueOnce(okHttp([{ transactions: 20, total_value: 2000, is_alerted: 0, is_investigated: 0 }]))
        .mockReturnValueOnce(okHttp([{ holder_name: 'CP Name' }]));
      const result = await service.getCounterpartyNodeFullData('cp1', 'DEFAULT', 'month');
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
        .mockReturnValueOnce(okHttp([]))
        .mockReturnValueOnce(okHttp([{ transactions: 10, total_value: 5000, is_alerted: 1, is_investigated: 1 }]))
        .mockReturnValueOnce(okHttp([{}]));
      const result = await service.getCounterpartyNodeFullData('cp1', 'DEFAULT');
      expect(result.counterpartyDetails.flags.alerted).toBe(true);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getCounterpartyNodeFullData('cp1', 'DEFAULT')).rejects.toThrow(HttpException);
    });

    it('adds unseen fromId counterparty node to network', async () => {
      http
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
        .mockReturnValueOnce(okHttp([{ counterparty_id: 'cp1', holder_name: 'CP Name' }]))
        .mockReturnValueOnce(okHttp([{ transactions: 2, total_value: 500, is_alerted: 0, is_investigated: 0 }]))
        .mockReturnValueOnce(okHttp([{ holder_name: 'CP Name' }]));
      const result = await service.getCounterpartyNodeFullData('cp1', 'DEFAULT');
      expect(result.network.nodes.length).toBeGreaterThanOrEqual(2);
    });

    it('includes second-degree counterparty edges and timestamps', async () => {
      http
        .mockReturnValueOnce(
          okHttp([
            {
              from_counterparty_id: 'cp1',
              to_counterparty_id: 'cp2',
              tx_count: 10,
              total_amount: 5000,
              currency_hint: 'USD',
              first_event_ts: '2024-01-01',
              last_event_ts: '2024-01-31',
              is_alerted_edge: 0,
              is_investigated_edge: 0,
              degree: 1,
            },
            {
              from_counterparty_id: 'cp2',
              to_counterparty_id: 'cp3',
              tx_count: 4,
              total_amount: 900,
              currency_hint: 'USD',
              first_event_ts: '2024-02-01',
              last_event_ts: '2024-02-03',
              is_alerted_edge: 1,
              is_investigated_edge: 1,
              degree: 2,
            },
          ]),
        )
        .mockReturnValueOnce(
          okHttp([
            { counterparty_id: 'cp1', holder_name: 'Center Name' },
            { counterparty_id: 'cp2', holder_name: 'Direct Name' },
            { counterparty_id: 'cp3', holder_name: 'Second Name' },
          ]),
        )
        .mockReturnValueOnce(okHttp([{ transactions: 10, total_value: 5000, is_alerted: 0, is_investigated: 0 }]))
        .mockReturnValueOnce(okHttp([{ holder_name: 'Center Name' }]));

      const result = await service.getCounterpartyNodeFullData('cp1', 'DEFAULT');

      expect(result.network.edges).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            source: 'cp2',
            target: 'cp3',
            degree: 2,
            firstEventTs: '2024-02-01',
            lastEventTs: '2024-02-03',
            flags: expect.objectContaining({ alerted: true, investigated: true }),
          }),
        ]),
      );
      expect(result.network.nodes).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: 'cp3', label: 'Second Name', name: 'Second Name', degree: 2 }),
        ]),
      );
    });
  });

  // ===================== getEntityMetadataByAlertId =====================
  describe('getEntityMetadataByAlertId', () => {
    const mockAlert = {
      id: 1,
      txtp: 'pacs.008.001.10',
      transaction: { EndToEndId: 'e2e-ref-123' },
    };

    const mockEntityRow = {
      debtor_Id: 'dbtr-001',
      debtor_account_id: 'dbtrAcct-001',
      debtor_name: 'John Debtor',
      creditor_id: 'cdtr-001',
      creditor_account_id: 'cdtrAcct-001',
      creditor_name: 'Jane Creditor',
    };

    it('returns entity metadata for a valid alertId', async () => {
      alertRepo.getAlertById.mockResolvedValue(mockAlert);
      alertRepo.getReferenceId.mockResolvedValue({ referenceIdName: 'EndToEndId' });
      http.mockReturnValueOnce(okHttp([mockEntityRow]));

      const result = await service.getEntityMetadataByAlertId(1, 'DEFAULT');

      expect(result.debtorId).toBe('dbtr-001');
      expect(result.debtorAccountId).toBe('dbtrAcct-001');
      expect(result.debtorName).toBe('John Debtor');
      expect(result.creditorId).toBe('cdtr-001');
      expect(result.creditorAccountId).toBe('cdtrAcct-001');
      expect(result.creditorName).toBe('Jane Creditor');
    });

    it('throws InternalServerErrorException when alert is not found', async () => {
      alertRepo.getAlertById.mockResolvedValue(null);

      await expect(service.getEntityMetadataByAlertId(99, 'DEFAULT')).rejects.toThrow(InternalServerErrorException);
    });

    it('throws when referenceId cannot be extracted from transaction data', async () => {
      alertRepo.getAlertById.mockResolvedValue({ ...mockAlert, transaction: {} });
      alertRepo.getReferenceId.mockResolvedValue({ referenceIdName: 'EndToEndId' });

      await expect(service.getEntityMetadataByAlertId(1, 'DEFAULT')).rejects.toThrow('ReferenceId not found in transaction data');
    });

    it('throws when the SQL query fails', async () => {
      alertRepo.getAlertById.mockResolvedValue(mockAlert);
      alertRepo.getReferenceId.mockResolvedValue({ referenceIdName: 'EndToEndId' });
      http.mockReturnValue(errHttp('DB error'));

      await expect(service.getEntityMetadataByAlertId(1, 'DEFAULT')).rejects.toThrow('DB error');
    });

    it('calls getReferenceId with the correct txtp from the alert', async () => {
      alertRepo.getAlertById.mockResolvedValue(mockAlert);
      alertRepo.getReferenceId.mockResolvedValue({ referenceIdName: 'EndToEndId' });
      http.mockReturnValueOnce(okHttp([mockEntityRow]));

      await service.getEntityMetadataByAlertId(1, 'DEFAULT');

      expect(alertRepo.getReferenceId).toHaveBeenCalledWith('pacs.008.001.10', 'DEFAULT');
    });
  });
});
