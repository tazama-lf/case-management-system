import { Test, TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { AccountLakehouseService } from '../src/modules/gold-lakehouse/account-lakehouse.service';

describe('AccountLakehouseService', () => {
  let service: AccountLakehouseService;
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
      ],
    }).compile();

    service = module.get<AccountLakehouseService>(AccountLakehouseService);
  });

  afterEach(() => jest.clearAllMocks());

  it('should be defined', () => expect(service).toBeDefined());

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
});
