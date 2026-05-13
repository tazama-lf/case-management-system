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

    it('adds unseen fromId node to network graph', async () => {
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
      // Mock single network edges query with edge from acc2 to acc1
      http.mockReturnValueOnce(
        okHttp([
          { from_account_id: 'acc2', to_account_id: 'acc1', tx_count: 2, total_amount: 200, is_alerted_edge: 0, is_investigated_edge: 0 },
        ]),
      );
      const result = await service.getAccountNodeFullData('entity1', 'DEFAULT', 'year');
      // Should have entity node + acc1 + acc2 = 3 nodes minimum
      expect(result.network.nodes.length).toBeGreaterThanOrEqual(3);
    });

    it('does not duplicate edges when entity owns multiple accounts that transact with each other', async () => {
      // Mock account_holder query with 2 accounts
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
      // Mock single network edges query that returns edges between acc1 and acc2
      http.mockReturnValueOnce(
        okHttp([
          { from_account_id: 'acc1', to_account_id: 'acc2', tx_count: 5, total_amount: 500, is_alerted_edge: 0, is_investigated_edge: 0 },
          { from_account_id: 'acc2', to_account_id: 'acc3', tx_count: 3, total_amount: 300, is_alerted_edge: 0, is_investigated_edge: 0 },
        ]),
      );
      const result = await service.getAccountNodeFullData('entity1', 'DEFAULT', 'month');
      
      // Should have exactly 2 edges (not duplicated)
      expect(result.network.edges.length).toBe(2);
      // Total transactions should be 8 (5 + 3)
      expect(result.accountDetails.transactions).toBe(8);
      // Total value should be 800 (500 + 300)
      expect(result.accountDetails.totalValue).toBe(800);
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
        .mockReturnValueOnce(okHttp([{ transactions: 2, total_value: 500, is_alerted: 0, is_investigated: 0 }]))
        .mockReturnValueOnce(okHttp([{ holder_name: 'CP Name' }]));
      const result = await service.getCounterpartyNodeFullData('cp1', 'DEFAULT');
      expect(result.network.nodes.length).toBeGreaterThanOrEqual(2);
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

      expect(alertRepo.getReferenceId).toHaveBeenCalledWith('pacs.008.001.10');
    });
  });
});
