import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { TransactionLakehouseService } from '../src/modules/gold-lakehouse/transaction-lakehouse.service';

describe('TransactionLakehouseService', () => {
  let service: TransactionLakehouseService;
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
        TransactionLakehouseService,
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

    service = module.get<TransactionLakehouseService>(TransactionLakehouseService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

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

  // ===================== getTransactionHistoryByEntityId =====================
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

  // ===================== getTransactionHistoryData =====================
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

  // ===================== getTransactionDetailSampleData =====================
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
});
