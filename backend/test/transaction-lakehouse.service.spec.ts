import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, InternalServerErrorException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { TransactionLakehouseService } from '../src/modules/gold-lakehouse/transaction-lakehouse.service';
import { AlertRepository } from '../src/modules/repository/alert.repository';

describe('TransactionLakehouseService', () => {
  let service: TransactionLakehouseService;
  let http: jest.Mock;
  let alertRepository: jest.Mocked<AlertRepository>;

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

    const mockAlertRepository = {
      getAlertById: jest.fn(),
      getReferenceId: jest.fn(),
    };

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
        { provide: AlertRepository, useValue: mockAlertRepository },
      ],
    }).compile();

    service = module.get<TransactionLakehouseService>(TransactionLakehouseService);
    alertRepository = module.get(AlertRepository);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

  // ===================== getTransactionDetailData =====================
  describe('getTransactionDetailData', () => {
    it('returns transaction detail', async () => {
      http.mockReturnValue(
        okHttp([
          {
            transaction_id: 500008,
            tx_msg_id: '33c406b80b044dd1991900b120ff7730',
            tx_type: 'pacs.008.001.10',
            tx_event_ts: '2024-01-01T10:00:00',
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
            charge_currency: 'USD',
            tx_event_date: '2024-01-01',
          },
          {
            transaction_id: 39,
            tx_msg_id: '09a77250f74a477d9fc4cba204fef5a9',
            tx_type: 'pacs.002.001.12',
            tx_event_ts: '2024-01-01T10:00:05',
            debtor_name: null,
            debtor_account_id: null,
            creditor_name: null,
            creditor_account_id: null,
            instg_mmb_id: 'bank1',
            instd_mmb_id: 'bank2',
            interbank_settlement_amount: null,
            interbank_settlement_currency: null,
            instructed_amount: null,
            instructed_currency: null,
            exchange_rate: null,
            charge_total_amount: 0,
            charge_currency: 'USD',
            tx_event_date: '2024-01-01',
          },
        ]),
      );
      const result = await service.getTransactionDetailData('123');
      expect(result).toHaveProperty('transactionOverview');
      expect(result.transactionOverview).toHaveProperty('pacs8');
      expect(result.transactionOverview).toHaveProperty('pacs2');
      expect(result.transactionOverview.pacs8.transactionId).toBe('33c406b80b044dd1991900b120ff7730');
      expect(result.transactionOverview.pacs2.transactionId).toBe('09a77250f74a477d9fc4cba204fef5a9');
    });

    it('throws when transaction not found', async () => {
      http.mockReturnValue(okHttp([]));
      await expect(service.getTransactionDetailData('999')).rejects.toThrow(HttpException);
    });

    it('throws when pacs.008 not found', async () => {
      http.mockReturnValue(
        okHttp([
          {
            transaction_id: 39,
            tx_msg_id: '09a77250f74a477d9fc4cba204fef5a9',
            tx_type: 'pacs.002.001.12',
            tx_event_ts: '2024-01-01T10:00:05',
          },
        ]),
      );
      await expect(service.getTransactionDetailData('999')).rejects.toThrow('pacs.008 transaction not found');
    });

    it('throws when pacs.002 not found', async () => {
      http.mockReturnValue(
        okHttp([
          {
            transaction_id: 500008,
            tx_msg_id: '33c406b80b044dd1991900b120ff7730',
            tx_type: 'pacs.008.001.10',
            tx_event_ts: '2024-01-01T10:00:00',
            debtor_name: 'A',
            debtor_account_id: 'acc1',
            creditor_name: 'B',
            creditor_account_id: 'acc2',
            instg_mmb_id: 'bank1',
            instd_mmb_id: 'bank2',
            interbank_settlement_amount: 100,
            interbank_settlement_currency: 'USD',
          },
        ]),
      );
      await expect(service.getTransactionDetailData('999')).rejects.toThrow('pacs.002 transaction not found');
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getTransactionDetailData('1')).rejects.toThrow(HttpException);
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
        .mockReturnValueOnce(okHttp([{ is_alerted: 0, is_investigated: 0 }]));
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
        .mockReturnValueOnce(okHttp([{ is_alerted: 0, is_investigated: 0 }]));
      const result = await service.getTransactionNetworkData('acc1', 'DEFAULT', 'day');
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
        .mockReturnValueOnce(okHttp([{ is_alerted: 0, is_investigated: 0 }]));
      const result = await service.getTransactionNetworkData('acc1', 'DEFAULT', 'day');
      expect(result.connectedAccounts[0].transactionStats.velocity).toBe('MEDIUM');
    });

    it('marks connected accounts with alerts when center account has alerts in transaction history', async () => {
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
        .mockReturnValueOnce(okHttp([{ is_alerted: 1, is_investigated: 0 }]));
      const result = await service.getTransactionNetworkData('acc1', 'DEFAULT', '30d');
      expect(result.connectedAccounts[0].hasAlert).toBe(true);
      expect(result.centerAccount.networkSummary.accountsWithAlerts).toBe(1);
    });

    it('throws when account not found', async () => {
      http.mockReturnValue(okHttp([]));
      await expect(service.getTransactionNetworkData('nonexistent', 'DEFAULT', 'day')).rejects.toThrow(HttpException);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getTransactionNetworkData('acc1', 'DEFAULT', 'day')).rejects.toThrow(HttpException);
    });
  });

  // ===================== getTransactionHistoryByAccountId =====================
  describe('getTransactionHistoryByAccountId', () => {
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
      const result: any = await service.getTransactionHistoryByAccountId('entity1', 'DEFAULT');
      expect(result.summary.totalTransactions).toBe(1);
    });

    it('handles empty entity history', async () => {
      http.mockReturnValue(okHttp([]));
      const result: any = await service.getTransactionHistoryByAccountId('entity1', 'DEFAULT');
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
      const result: any = await service.getTransactionHistoryByAccountId('entity1', 'DEFAULT', '2024-01-01', '2024-01-31', 'day');
    });

    it('uses baseline expected values when available', async () => {
      http
        .mockReturnValueOnce(
          okHttp([{ transaction_id: 'tx1', event_date: '2024-01-01', tx_amount: '100', is_alerted: 0, is_investigated: 0 }]),
        )
        .mockReturnValueOnce(okHttp([{ total_tx_count: '50', total_amount: '5000' }]));
      const result: any = await service.getTransactionHistoryByAccountId('entity1', 'DEFAULT');
      expect(result.summary.expected.transactionCount).toBe(50);
    });

    it('handles baseline query failure gracefully', async () => {
      http
        .mockReturnValueOnce(
          okHttp([{ transaction_id: 'tx1', event_date: '2024-01-01', tx_amount: '100', is_alerted: 0, is_investigated: 0 }]),
        )
        .mockReturnValueOnce(errHttp('baseline unavailable'));
      const result: any = await service.getTransactionHistoryByAccountId('entity1', 'DEFAULT');
      expect(result.summary).toBeDefined();
      expect(result.summary.expected.transactionCount).toBeNull();
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getTransactionHistoryByAccountId('entity1', 'DEFAULT')).rejects.toThrow(HttpException);
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
      const result = await service.getCounterpartyNetworkData('acc1', 'DEFAULT', 'month');
      expect(result.counterparties[0].frequency).toBe('LOW');
    });

    it('throws when account not found', async () => {
      http.mockReturnValue(okHttp([]));
      await expect(service.getCounterpartyNetworkData('nonexistent', 'DEFAULT', 'month')).rejects.toThrow(HttpException);
    });

    it('throws when no counterparties found', async () => {
      http.mockReturnValueOnce(okHttp([{ debtor_account_id: 'acc1' }])).mockReturnValueOnce(okHttp([]));
      await expect(service.getCounterpartyNetworkData('acc1', 'DEFAULT', 'month')).rejects.toThrow(HttpException);
    });

    it('throws on error', async () => {
      http.mockReturnValue(errHttp());
      await expect(service.getCounterpartyNetworkData('acc1', 'DEFAULT', 'month')).rejects.toThrow(HttpException);
    });
  });

  // ===================== generateProfile =====================
  describe('generateProfile', () => {
    const mockAlert = {
      alert_id: 1,
      txtp: 'pacs.008.001.10',
      transaction: {
        TxTp: 'pacs.008.001.10',
        CdtrAcct: { Id: { IBAN: 'GB29NWBK60161331926819' } },
        DbtrAcct: { Id: { IBAN: 'GB82WEST12345698765432' } },
        EndToEndId: 'TMICFBPK2801321903297120',
      },
    };

    const mockReferenceIdData = {
      referenceIdName: 'EndToEndId',
    };

    const mockDto = {
      tenantId: 'DEFAULT',
    };

    it('successfully generates profile with creditor and debtor data', async () => {
      alertRepository.getAlertById.mockResolvedValue(mockAlert as any);
      alertRepository.getReferenceId.mockResolvedValue(mockReferenceIdData as any);

      const mockCreditorResponse = {
        data: [
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
            entity_role: 'CREDITOR',
            creditor_name: 'Test Creditor',
            entity_id: 'cred1',
            entity_type: 'ACCOUNT',
          },
        ],
      };

      const mockDebtorResponse = {
        data: [
          {
            transaction_id: 'tx2',
            event_date: '2024-01-02',
            tx_amount: 200,
            tx_ccy: 'USD',
            tx_type: 'PAYMENT',
            is_alerted: 0,
            is_investigated: 0,
            cum_tx_count: 2,
            cum_tx_amount: 300,
            entity_role: 'DEBTOR',
            debtor_name: 'Test Debtor',
            entity_id: 'debt1',
            entity_type: 'ACCOUNT',
            creditor_name: 'Test Creditor',
          },
        ],
      };

      http.mockReturnValueOnce(okHttp(mockCreditorResponse.data)).mockReturnValueOnce(okHttp(mockDebtorResponse.data));

      const result = await service.generateProfile(1, mockDto, 'user123', 'DEFAULT');

      expect(result).toHaveProperty('tenantId', 'DEFAULT');
      expect(result).toHaveProperty('transactionCreditorResp');
      expect(result).toHaveProperty('transactionDebtorResp');
      expect(alertRepository.getAlertById).toHaveBeenCalledWith(1);
      expect(alertRepository.getReferenceId).toHaveBeenCalledWith('pacs.008.001.10', 'DEFAULT');
    });

    it('throws InternalServerErrorException when alert not found', async () => {
      alertRepository.getAlertById.mockResolvedValue(null);

      await expect(service.generateProfile(999, mockDto, 'user123', 'DEFAULT')).rejects.toThrow(InternalServerErrorException);

      expect(alertRepository.getAlertById).toHaveBeenCalledWith(999);
    });

    it('throws InternalServerErrorException when reference ID extraction fails', async () => {
      const alertWithoutReferenceId = {
        ...mockAlert,
        transaction: {},
      };

      alertRepository.getAlertById.mockResolvedValue(alertWithoutReferenceId as any);
      alertRepository.getReferenceId.mockResolvedValue(mockReferenceIdData as any);

      await expect(service.generateProfile(1, mockDto, 'user123', 'DEFAULT')).rejects.toThrow(InternalServerErrorException);
    });

    it('throws InternalServerErrorException when SQL query fails', async () => {
      alertRepository.getAlertById.mockResolvedValue(mockAlert as any);
      alertRepository.getReferenceId.mockResolvedValue(mockReferenceIdData as any);

      http.mockReturnValue(errHttp('Database connection failed'));

      await expect(service.generateProfile(1, mockDto, 'user123', 'DEFAULT')).rejects.toThrow(InternalServerErrorException);
    });

    it('handles empty creditor and debtor responses', async () => {
      alertRepository.getAlertById.mockResolvedValue(mockAlert as any);
      alertRepository.getReferenceId.mockResolvedValue(mockReferenceIdData as any);

      http.mockReturnValueOnce(okHttp([])).mockReturnValueOnce(okHttp([]));

      const result = await service.generateProfile(1, mockDto, 'user123', 'DEFAULT');

      expect(result).toHaveProperty('tenantId', 'DEFAULT');
      expect(result.transactionCreditorResp.data).toEqual([]);
      expect(result.transactionDebtorResp.data).toEqual([]);
    });

    it('processes multiple transactions in creditor response', async () => {
      alertRepository.getAlertById.mockResolvedValue(mockAlert as any);
      alertRepository.getReferenceId.mockResolvedValue(mockReferenceIdData as any);

      const mockMultipleCreditorResponse = {
        data: [
          { transaction_id: 'tx1', event_date: '2024-01-01', tx_amount: 100, entity_role: 'CREDITOR' },
          { transaction_id: 'tx2', event_date: '2024-01-02', tx_amount: 200, entity_role: 'CREDITOR' },
          { transaction_id: 'tx3', event_date: '2024-01-03', tx_amount: 300, entity_role: 'CREDITOR' },
        ],
      };

      http.mockReturnValueOnce(okHttp(mockMultipleCreditorResponse.data)).mockReturnValueOnce(okHttp([]));

      const result = await service.generateProfile(1, mockDto, 'user123', 'DEFAULT');

      expect(result.transactionCreditorResp.data).toHaveLength(3);
    });
  });
});
