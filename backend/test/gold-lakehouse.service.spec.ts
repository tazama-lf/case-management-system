import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import { GoldLakehouseService } from '../src/modules/gold-lakehouse/gold-lakehouse.service';
import { QueryRequestDto } from '../src/modules/gold-lakehouse/dto/query-request.dto';

describe('GoldLakehouseService', () => {
  let service: GoldLakehouseService;
  let httpService: HttpService;
  let configService: ConfigService;

  const mockApiUrl = 'http://localhost:5000';
  const mockTimeout = 30000;

  const createMockHttpResponse = (data: any) => ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GoldLakehouseService,
        {
          provide: HttpService,
          useValue: { post: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => (key === 'GOLD_LAKEHOUSE_API_URL' ? mockApiUrl : undefined)),
            get: jest.fn((key: string, defaultValue?: any) => {
              if (key === 'GOLD_LAKEHOUSE_TIMEOUT') return mockTimeout;
              if (key === 'ALERT_HISTORY_FALLBACK_E2E_ID') return '05c7ead85a1343d5a959561523a965fb';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<GoldLakehouseService>(GoldLakehouseService);
    httpService = module.get<HttpService>(HttpService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should initialize with config values', () => {
      expect(configService.getOrThrow).toHaveBeenCalledWith('GOLD_LAKEHOUSE_API_URL');
      expect(configService.get).toHaveBeenCalledWith('GOLD_LAKEHOUSE_TIMEOUT');
      expect(configService.get).toHaveBeenCalledWith('ALERT_HISTORY_FALLBACK_E2E_ID', expect.any(String));
    });
  });

  describe('query', () => {
    const queryRequest: QueryRequestDto = { table_name: 'alerts', filters: { tenant_id: 'DEFAULT' } };

    it('should successfully query Gold Lakehouse', async () => {
      const mockResponse = { status: 'success', data: [{ id: 1 }], code: 200 };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.query(queryRequest);

      expect(httpService.post).toHaveBeenCalledWith(`${mockApiUrl}/query`, queryRequest, { timeout: mockTimeout });
      expect(result).toEqual(mockResponse);
    });

    it('should throw HttpException when query status is not success', async () => {
      const mockResponse = { status: 'error', code: 500, message: 'Query failed' };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      await expect(service.query(queryRequest)).rejects.toThrow(HttpException);
      await expect(service.query(queryRequest)).rejects.toThrow('Gold Lakehouse query failed with status: error');
    });

    it('should handle ECONNREFUSED error', async () => {
      const error = { code: 'ECONNREFUSED', message: 'Connection refused' };
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => error) as any);

      await expect(service.query(queryRequest)).rejects.toThrow(HttpException);
      await expect(service.query(queryRequest)).rejects.toThrow('Gold Lakehouse API is not running or not reachable');
    });

    it('should handle HttpException and re-throw it', async () => {
      const httpException = new HttpException('Test error', HttpStatus.BAD_REQUEST);
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => httpException) as any);

      await expect(service.query(queryRequest)).rejects.toThrow(httpException);
    });

    it('should handle unknown errors', async () => {
      const error = new Error('Network error');
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => error) as any);

      await expect(service.query(queryRequest)).rejects.toThrow('Failed to query Gold Lakehouse: Network error');
    });
  });

  describe('runSqlQuery', () => {
    const sql = 'SELECT * FROM alerts LIMIT 1';

    it('should successfully run SQL query', async () => {
      const mockResponse = { status: 'success', data: [{ id: 1 }], code: 200 };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.runSqlQuery(sql);

      expect(httpService.post).toHaveBeenCalledWith(`${mockApiUrl}/execute_sql`, { sql_query: sql, limit: 1 }, { timeout: mockTimeout });
      expect(result).toEqual(mockResponse);
    });

    it('should use custom limit parameter', async () => {
      const mockResponse = { status: 'success', data: [], code: 200 };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      await service.runSqlQuery(sql, 100);

      expect(httpService.post).toHaveBeenCalledWith(`${mockApiUrl}/execute_sql`, { sql_query: sql, limit: 100 }, { timeout: mockTimeout });
    });

    it('should throw HttpException when SQL query status is not success', async () => {
      const mockResponse = { status: 'error', code: 500 };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      await expect(service.runSqlQuery(sql)).rejects.toThrow('Gold Lakehouse SQL query failed');
    });

    it('should handle HttpException and re-throw it', async () => {
      const httpException = new HttpException('SQL error', HttpStatus.INTERNAL_SERVER_ERROR);
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => httpException) as any);

      await expect(service.runSqlQuery(sql)).rejects.toThrow(httpException);
    });

    it('should handle generic errors', async () => {
      const error = new Error('Connection error');
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => error) as any);

      await expect(service.runSqlQuery(sql)).rejects.toThrow('Failed to run SQL query on Gold Lakehouse');
    });
  });

  describe('getAlertNavigatorMetrics', () => {
    it('should fetch alert navigator metrics', async () => {
      const mockResponse = { status: 'success', data: [{ total_typologies: 5, total_rules: 20, avg_typology_score: 75.5 }] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertNavigatorMetrics(123, 'DEFAULT');

      expect(result).toEqual({
        total_typologies: 5,
        total_rules: 20,
        avg_typology_score: 75.5,
        alertId: 123,
        tenantId: 'DEFAULT',
      });
    });

    it('should handle empty response data', async () => {
      const mockResponse = { status: 'success', data: [{ total_typologies: 0, total_rules: 0, avg_typology_score: null }] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertNavigatorMetrics(123);

      expect(result.total_typologies).toBe(0);
      expect(result.total_rules).toBe(0);
      expect(result.avg_typology_score).toBeNull();
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('DB error')) as any);

      await expect(service.getAlertNavigatorMetrics(123)).rejects.toThrow(HttpException);
    });
  });

  describe('getConditionsSummary', () => {
    it('should fetch conditions summary', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ active_conditions: 5, blocked_transactions: 10, overridden_transactions: 2, future_conditions: 3 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getConditionsSummary('account123', 'DEFAULT');

      expect(result).toEqual({
        activeConditions: 5,
        blockedTransactions: 10,
        overriddenTransactions: 2,
        futureConditions: 3,
      });
    });

    it('should handle empty response with defaults', async () => {
      const mockResponse = { status: 'success', data: [{}] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getConditionsSummary('account123');

      expect(result.activeConditions).toBe(0);
      expect(result.blockedTransactions).toBe(0);
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('SQL error')) as any);

      await expect(service.getConditionsSummary('account123')).rejects.toThrow('Failed to fetch conditions summary');
    });
  });

  describe('getConditionsList', () => {
    it('should fetch conditions list', async () => {
      const mockResponse = {
        status: 'success',
        data: [
          {
            condition_id: 'cond1',
            condition_type: 'block',
            condition_reason: 'Suspicious activity',
            created_by_user: 'admin',
            condition_inception_ts: '2024-01-01',
            condition_expiry_ts: '2024-12-31',
            is_active: 1,
            is_expired: 0,
          },
        ],
      };
      jest.spyOn(service, 'query').mockResolvedValue(mockResponse as any);

      const result = await service.getConditionsList('account123', 'DEFAULT');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        conditionId: 'cond1',
        conditionType: 'block',
        status: 'ACTIVE',
      });
    });

    it('should map expired conditions correctly', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ condition_id: 'cond2', is_active: 0, is_expired: 1 }],
      };
      jest.spyOn(service, 'query').mockResolvedValue(mockResponse as any);

      const result = await service.getConditionsList('account123');

      expect(result[0].status).toBe('EXPIRED');
    });

    it('should map future conditions correctly', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ condition_id: 'cond3', is_active: 0, is_expired: 0 }],
      };
      jest.spyOn(service, 'query').mockResolvedValue(mockResponse as any);

      const result = await service.getConditionsList('account123');

      expect(result[0].status).toBe('FUTURE');
    });

    it('should handle errors', async () => {
      jest.spyOn(service, 'query').mockRejectedValue(new Error('Query failed'));

      await expect(service.getConditionsList('account123')).rejects.toThrow('Failed to fetch conditions list');
    });
  });

  describe.each([
    ['getActiveConditions', 'active conditions'],
    ['getExpiredConditions', 'expired conditions'],
    ['getFutureConditions', 'future conditions'],
  ])('%s', (methodName, description) => {
    it(`should fetch ${description}`, async () => {
      const mockResponse = {
        status: 'success',
        data: [{ condition_id: 'cond1', condition_reason: 'Test', condition_inception_ts: '2024-01-01' }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await (service as any)[methodName]('account123', 'DEFAULT');

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('conditionId', 'cond1');
    });

    it(`should handle empty ${description} response`, async () => {
      const mockResponse = { status: 'success', data: [] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await (service as any)[methodName]('account123');

      expect(result).toEqual([]);
    });

    it(`should handle ${description} errors`, async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('DB error')) as any);

      await expect((service as any)[methodName]('account123')).rejects.toThrow(HttpException);
    });
  });

  describe('getEvaluatedTransactions', () => {
    it('should fetch evaluated transactions', async () => {
      const mockResponse = {
        status: 'success',
        data: [
          {
            tx_transaction_id: 'tx1',
            tx_event_ts: '2024-01-01',
            tx_type: 'PAYMENT',
            tx_amount: 100,
            tx_ccy: 'USD',
            tx_block_override_status: 'BLOCKED',
            cond_condition_id: 'cond1',
            cond_reason: 'Suspicious',
          },
        ],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getEvaluatedTransactions('account123', 'DEFAULT');

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        transactionId: 'tx1',
        outcome: 'BLOCKED',
        amount: 100,
      });
    });

    it('should handle transactions without conditions', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ tx_transaction_id: 'tx2', tx_amount: 50, tx_ccy: 'EUR' }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getEvaluatedTransactions('account123');

      expect(result[0].outcome).toBe('PASSED');
      expect(result[0].reason).toBe('No conditions triggered');
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('SQL error')) as any);

      await expect(service.getEvaluatedTransactions('account123')).rejects.toThrow('Failed to fetch evaluated transactions');
    });
  });

  describe('getAlertHistorySummary', () => {
    it('should fetch alert history summary', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ total_alerts: 100, cases_opened: 50, investigations: 30, sar_filings: 10, total_value: 50000 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistorySummary('e2e-123', 'DEFAULT', '30days');

      expect(result).toEqual({
        totalAlerts: 100,
        casesOpened: 50,
        investigations: 30,
        sarFilings: 10,
        totalValue: 50000,
      });
    });

    it('should handle empty response', async () => {
      const mockResponse = { status: 'success', data: [{}] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistorySummary();

      expect(result.totalAlerts).toBe(0);
      expect(result.totalValue).toBe(0);
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Query error')) as any);

      await expect(service.getAlertHistorySummary()).rejects.toThrow('Failed to fetch alert history summary');
    });
  });

  describe('getAlertHistoryTimeline', () => {
    it('should fetch alert history timeline', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ date: '2024-01-01', alert_count: 10, case_count: 5, investigation_count: 3, total_value: 10000 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryTimeline('e2e-123', 'DEFAULT', '30days', 'day');

      expect(result).toHaveProperty('alertCountOverTime');
      expect(result).toHaveProperty('alertValueOverTime');
      expect(result.alertCountOverTime).toHaveLength(1);
      expect(result.alertCountOverTime[0].alerts).toBe(10);
    });

    it('should handle empty timeline data', async () => {
      const mockResponse = { status: 'success', data: [] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryTimeline();

      expect(result.alertCountOverTime).toEqual([]);
      expect(result.alertValueOverTime).toEqual([]);
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Timeline error')) as any);

      await expect(service.getAlertHistoryTimeline()).rejects.toThrow('Failed to fetch alert history timeline');
    });
  });

  describe('getAlertHistoryAlerts', () => {
    it('should fetch alert history alerts with pagination', async () => {
      const countResponse = { status: 'success', data: [{ total: 100 }] };
      const alertsResponse = {
        status: 'success',
        data: [
          {
            alert_id: 1,
            date: '2024-01-01',
            type: 'AML',
            severity: 'HIGH',
            status: 'OPEN',
            case_id: 'case1',
            case_status: 'STATUS_02_ASSIGNED',
          },
        ],
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(countResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(alertsResponse)) as any);

      const result = await service.getAlertHistoryAlerts('e2e-123', 'DEFAULT', 'all', 1, 20);

      expect(result.alerts).toHaveLength(1);
      expect(result.pagination).toEqual({ total: 100, page: 1, limit: 20, totalPages: 5 });
      expect(result.alerts[0].outcome).toBe('Investigating');
    });

    it('should map case status to outcome correctly', async () => {
      const countResponse = { status: 'success', data: [{ total: 1 }] };
      const alertsResponse = {
        status: 'success',
        data: [{ alert_id: 2, case_status: 'STATUS_99_COMPLETED' }],
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(countResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(alertsResponse)) as any);

      const result = await service.getAlertHistoryAlerts();

      expect(result.alerts[0].outcome).toBe('Closed');
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Query error')) as any);

      await expect(service.getAlertHistoryAlerts()).rejects.toThrow('Failed to fetch alert history alerts');
    });
  });

  describe('getTestAccountIds', () => {
    it('should fetch test account IDs', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ account_id: 'acc1', account_name: 'Test Account', connections: 5, total_transactions: 100 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getTestAccountIds('DEFAULT', 1);

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('accounts');
      expect((result as any).accounts).toHaveLength(1);
      expect((result as any).accounts[0]).toHaveProperty('accountId', 'acc1');
    });

    it('should handle empty accounts', async () => {
      const mockResponse = { status: 'success', data: [] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getTestAccountIds();

      expect((result as any).accounts).toEqual([]);
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Query error')) as any);

      await expect(service.getTestAccountIds()).rejects.toThrow('Failed to fetch test account IDs');
    });
  });

  describe('getTransactionNetworkData', () => {
    it('should fetch transaction network data', async () => {
      const centerAccountResponse = { status: 'success', data: [{ account_id: 'acc1', account_name: 'Center Account' }] };
      const outboundResponse = {
        status: 'success',
        data: [
          {
            connected_account_id: 'acc2',
            connected_account_name: 'Outbound Account',
            flow_direction: 'OUTBOUND',
            total_transactions: 10,
            total_value: 5000,
            avg_value: 500,
          },
        ],
      };
      const inboundResponse = { status: 'success', data: [] };
      const alertFlagsResponse = { status: 'success', data: [] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(centerAccountResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(outboundResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(inboundResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(alertFlagsResponse)) as any);

      const result = await service.getTransactionNetworkData('acc1', 'DEFAULT', '30d');

      expect(result.centerAccount.accountId).toBe('acc1');
      expect(result.connectedAccounts).toHaveLength(1);
      expect(result.edges).toHaveLength(1);
      expect(result.connectedAccounts[0].flowDirection).toContain('Outbound');
    });

    it('should throw HttpException when account not found', async () => {
      const centerAccountResponse = { status: 'success', data: [] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(centerAccountResponse)) as any);

      await expect(service.getTransactionNetworkData('nonexistent')).rejects.toThrow('Failed to fetch transaction network data');
      await expect(service.getTransactionNetworkData('nonexistent')).rejects.toThrow(HttpException);
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Network error')) as any);

      await expect(service.getTransactionNetworkData('acc1')).rejects.toThrow('Failed to fetch transaction network data');
    });
  });

  describe('getTransactionHistoryData', () => {
    it('should fetch transaction history by entity_id', async () => {
      const eventsResponse = {
        status: 'success',
        data: [
          {
            transaction_id: 'tx1',
            entity_id: 'entity123',
            event_date: '2024-01-01',
            tx_amount: 100,
            tx_ccy: 'USD',
            tx_type: 'PAYMENT',
            is_alerted: 1,
            is_investigated: 0,
            cum_tx_amount: 100,
            cum_tx_count: 1,
            entity_role: 'DEBTOR',
            creditor_name: 'Counterparty',
          },
        ],
      };
      const aggResponse = { status: 'success', data: [] };
      const baselineResponse = { status: 'success', data: [] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(eventsResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(aggResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(baselineResponse)) as any);

      const result = await service.getTransactionHistoryData('entity123', 'DEFAULT');

      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('timeline');
      expect((result as any).summary.totalTransactions).toBe(1);
    });

    it('should fetch transaction history by end_to_end_id (UUID format)', async () => {
      const uuid = '550e8400-e29b-41d4-a716-446655440000';
      const eventsResponse = {
        status: 'success',
        data: [
          {
            transaction_id: 'tx1',
            end_to_end_id: uuid,
            entity_type: 'ACCOUNT',
            entity_role: 'DEBTOR',
            entity_id: 'entity1',
            entity_name: 'Entity 1',
            event_date: '2024-01-01',
            event_ts: '2024-01-01T12:00:00Z',
            tx_amount: 200,
            tx_ccy: 'EUR',
            tx_type: 'TRANSFER',
            is_alerted: 0,
            is_investigated: 0,
            debtor_name: 'Debtor 1',
            creditor_name: 'Creditor 1',
            debtor_account_id: 'acc1',
            creditor_account_id: 'acc2',
          },
        ],
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(eventsResponse)) as any);

      const result = await service.getTransactionHistoryData(uuid, 'DEFAULT');

      expect(result).toHaveProperty('entityPerspectives');
      expect((result as any).entityPerspectives).toBeInstanceOf(Array);
    });

    it('should handle empty transaction history', async () => {
      const emptyResponse = { status: 'success', data: [] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(emptyResponse)) as any);

      const result = await service.getTransactionHistoryData('entity123');

      expect((result as any).summary.totalTransactions).toBe(0);
      expect((result as any).timeline).toEqual([]);
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Query error')) as any);

      await expect(service.getTransactionHistoryData('entity123')).rejects.toThrow(HttpException);
    });
  });

  describe('getAlertNavigatorData', () => {
    it('should fetch alert navigator data', async () => {
      const alertWithTransactionResponse = {
        status: 'success',
        data: [
          {
            alert_id: 123,
            end_to_end_id: 'e2e123',
            transaction_id: 'tx1',
            alert_status: 'OPEN',
            alert_tx_type: 'PAYMENT',
            alert_tx_amount: 1000,
            alert_tx_ccy: 'USD',
            created_at_ts: '2024-01-01',
            message: 'Suspicious activity',
            block_reason: 'High risk',
          },
        ],
      };
      const typologiesResponse = {
        status: 'success',
        data: [
          {
            typology_id: 'typ1',
            typology_cfg: '001',
            typology_score: 85,
            alert_threshold: 75,
            interdiction_threshold: 90,
          },
        ],
      };
      const rulesResponse = {
        status: 'success',
        data: [
          {
            rule_id: 'rule1',
            rule_cfg: '001@1.0.0',
            rule_weight: 10,
            rule_score: 100,
          },
        ],
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(alertWithTransactionResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(typologiesResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(rulesResponse)) as any);

      const result = await service.getAlertNavigatorData(123, 'DEFAULT');

      expect(result).toHaveProperty('alertMetadata');
      expect(result).toHaveProperty('typologies');
      expect(result).toHaveProperty('statistics');
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Query error')) as any);

      await expect(service.getAlertNavigatorData(123)).rejects.toThrow(HttpException);
    });
  });

  describe('getTransactionDetailData', () => {
    it('should fetch transaction detail data', async () => {
      const mockResponse = {
        status: 'success',
        data: [
          {
            transaction_id: '123',
            tx_event_ts: '2024-01-01T12:00:00Z',
            tx_type: 'PAYMENT',
            interbank_settlement_amount: 500,
            interbank_settlement_currency: 'USD',
            end_to_end_id: 'e2e123',
            debtor_name: 'John Doe',
            debtor_account_id: 'acc1',
            creditor_name: 'Jane Smith',
            creditor_account_id: 'acc2',
            instg_mmb_id: 'bank1',
            instd_mmb_id: 'bank2',
            instructed_amount: 500,
            instructed_currency: 'USD',
            exchange_rate: 1,
            charge_total_amount: 0,
            charge_currency: 'USD',
            tx_event_date: '2024-01-01',
            tenant_id: 'DEFAULT',
          },
        ],
      };
      jest.spyOn(service, 'query').mockResolvedValue(mockResponse as any);

      const result = await service.getTransactionDetailData(123, 'DEFAULT');

      expect(result).toHaveProperty('transactionOverview');
      expect(result.transactionOverview).toHaveProperty('transactionId');
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Query error')) as any);

      await expect(service.getTransactionDetailData(123)).rejects.toThrow(HttpException);
    });
  });

  describe('getTransactionOverviewUIData', () => {
    it('should fetch transaction overview UI data', async () => {
      const mockData = {
        transaction_id: 'tx1',
        end_to_end_id: 'e2e1',
        debtor_name: 'Sender',
        creditor_name: 'Receiver',
        instructed_amount: 1000,
        instructed_ccy: 'USD',
      };

      jest.spyOn(service, 'runSqlQuery').mockResolvedValue({ status: 'success', data: [mockData] } as any);

      const result = await service.getTransactionOverviewUIData(123, 'DEFAULT');

      expect(result).toBeDefined();
    });

    it('should handle errors', async () => {
      jest.spyOn(service, 'runSqlQuery').mockRejectedValue(new Error('SQL error'));

      await expect(service.getTransactionOverviewUIData(123)).rejects.toThrow(HttpException);
    });
  });

  describe('getTransactionPerspectivesByEndToEndId', () => {
    it('should fetch transaction perspectives', async () => {
      const mockResponse = {
        status: 'success',
        data: [
          {
            transaction_id: 'tx1',
            end_to_end_id: 'e2e1',
            entity_type: 'ACCOUNT',
            entity_role: 'DEBTOR',
            entity_id: 'entity1',
            entity_name: 'Entity 1',
            tx_amount: 100,
            tx_ccy: 'USD',
            tx_type: 'PAYMENT',
            event_date: '2024-01-01',
            event_ts: '2024-01-01T12:00:00Z',
            is_alerted: 0,
            is_investigated: 0,
            debtor_name: 'Debtor',
            creditor_name: 'Creditor',
            debtor_account_id: 'acc1',
            creditor_account_id: 'acc2',
          },
        ],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getTransactionPerspectivesByEndToEndId('e2e1', 'DEFAULT');

      expect(result).toHaveProperty('perspectives');
      expect((result as any).perspectives).toBeInstanceOf(Array);
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Query error')) as any);

      await expect(service.getTransactionPerspectivesByEndToEndId('e2e1')).rejects.toThrow(HttpException);
    });
  });

  describe('getCounterpartyNetworkData', () => {
    it('should fetch counterparty network data', async () => {
      const accountHolderResponse = {
        status: 'success',
        data: [
          {
            debtor_name: 'Account Holder',
            debtor_account_id: 'acc1',
            creditor_name: 'Other Party',
            creditor_account_id: 'acc2',
          },
        ],
      };
      const counterpartyLinksResponse = {
        status: 'success',
        data: [{ counterparty_id: 'dbtr_acc1' }],
      };
      const networkEdgesResponse = {
        status: 'success',
        data: [
          {
            from_counterparty_id: 'dbtr_acc1',
            to_counterparty_id: 'cdtr_acc2',
            tx_count: 10,
            total_amount: 5000,
            is_alerted_edge: 0,
            is_investigated_edge: 0,
            first_event_ts: '2024-01-01',
            last_event_ts: '2024-01-31',
          },
        ],
      };
      const namesResponse = {
        status: 'success',
        data: [
          {
            counterparty_id: 'dbtr_acc1',
            name: 'Counterparty 1',
          },
          {
            counterparty_id: 'cdtr_acc2',
            name: 'Counterparty 2',
          },
        ],
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(accountHolderResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(counterpartyLinksResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(networkEdgesResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(namesResponse)) as any);

      const result = await service.getCounterpartyNetworkData('acc1', 'DEFAULT', '30d');

      expect(result).toHaveProperty('centerCounterparty');
      expect(result).toHaveProperty('counterparties');
      expect(result.counterparties).toBeInstanceOf(Array);
    });

    it('should throw HttpException when account not found', async () => {
      const emptyResponse = { status: 'success', data: [] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(emptyResponse)) as any);

      await expect(service.getCounterpartyNetworkData('nonexistent')).rejects.toThrow(HttpException);
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Network error')) as any);

      await expect(service.getCounterpartyNetworkData('acc1')).rejects.toThrow(HttpException);
    });

    it('should handle getCounterpartyNetworkData with LOW frequency transactions', async () => {
      const accountHolderResponse = {
        status: 'success',
        data: [{ debtor_name: 'Test Account', creditor_name: 'Test Creditor', debtor_account_id: 'acc1', creditor_account_id: 'acc2' }],
      };
      const counterpartyLinksResponse = {
        status: 'success',
        data: [{ counterparty_id: 'cnt1' }],
      };
      const networkEdgesResponse = {
        status: 'success',
        data: [
          {
            from_counterparty_id: 'cnt1',
            to_counterparty_id: 'cnt2',
            tx_count: 3,
            total_amount: 500,
            first_event_ts: '2024-01-01',
            last_event_ts: '2024-01-15',
          },
        ],
      };
      const namesResponse = {
        status: 'success',
        data: [{ counterparty_id: 'cnt2', name: 'Low Frequency Counterparty' }],
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(accountHolderResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(counterpartyLinksResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(networkEdgesResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(namesResponse)) as any);

      const result = await service.getCounterpartyNetworkData('acc1', 'DEFAULT', '30d');

      expect(result.counterparties.length).toBeGreaterThan(0);
      expect(result.counterparties[0].frequency).toBe('LOW');
    });
  });

  describe('getAccountNodeFullData', () => {
    it('should fetch account node full data', async () => {
      const networkResponse = {
        status: 'success',
        data: [
          {
            from_account_id: 'acc1',
            to_account_id: 'acc2',
            tx_count: 5,
            total_amount: 2500,
            currency_hint: 'USD',
            first_event_ts: '2024-01-01',
            last_event_ts: '2024-01-31',
            is_alerted_edge: 0,
            is_investigated_edge: 0,
          },
        ],
      };
      const metricsResponse = { status: 'success', data: [{ transactions: 5, total_value: 2500, is_alerted: 0, is_investigated: 0 }] };
      const holderResponse = { status: 'success', data: [{ holder_name: 'Account Holder' }] };
      const alertResponse = { status: 'success', data: [{ alert_count: 0 }] };
      const investigationResponse = { status: 'success', data: [{ investigation_count: 0 }] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(networkResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(metricsResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(holderResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(alertResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(investigationResponse)) as any);

      const result = await service.getAccountNodeFullData('acc1', 'DEFAULT', 'month');

      expect(result).toHaveProperty('network');
      expect(result).toHaveProperty('accountDetails');
      expect(result).toHaveProperty('meta');
      expect(result.network.nodes.length).toBeGreaterThan(0);
    });

    it('should handle errors', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Query error')) as any);

      await expect(service.getAccountNodeFullData('acc1')).rejects.toThrow(HttpException);
    });
  });

  describe('Additional branch coverage tests', () => {
    it('should handle getTransactionHistoryData with entity_id format (non-UUID)', async () => {
      const entityId = 'entity123';
      const mockResponse = {
        status: 'success',
        data: [
          {
            transaction_id: 'tx1',
            entity_id: entityId,
            event_date: '2024-01-01',
            tx_amount: 100,
            tx_ccy: 'USD',
          },
        ],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getTransactionHistoryData(entityId, 'DEFAULT');

      expect(result).toBeDefined();
      expect(httpService.post).toHaveBeenCalled();
    });

    it('should handle getTransactionHistoryData when baseline fetch fails', async () => {
      const entityId = 'entity456';
      const transactionsResponse = {
        status: 'success',
        data: [
          {
            transaction_id: 'tx1',
            entity_id: entityId,
            event_date: '2024-01-01',
            tx_amount: 200,
            tx_ccy: 'USD',
            is_alerted: 0,
            is_investigated: 0,
          },
        ],
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(transactionsResponse)) as any)
        .mockReturnValueOnce(throwError(() => new Error('Baseline fetch error')) as any);

      const result = await service.getTransactionHistoryData(entityId, 'DEFAULT');

      expect(result).toBeDefined();
      expect((result as any).summary).toBeDefined();
    });

    it('should handle getBenfordAnalysisByAccount successfully', async () => {
      const mockResponse = {
        status: 'success',
        data: [
          { amount: 123 },
          { amount: 456 },
          { amount: 789 },
          { amount: 111 },
          { amount: 222 },
          { amount: 333 },
          { amount: 444 },
          { amount: 555 },
          { amount: 666 },
          { amount: 777 },
        ],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getBenfordAnalysisByAccount('acc1', 'DEFAULT', '2024-01-01', '2024-12-31');

      expect(result).toHaveProperty('expected');
      expect(result).toHaveProperty('actual');
      expect(result).toHaveProperty('sampleSize');
      expect(result.sampleSize).toBeGreaterThan(0);
    });

    it('should handle getBenfordAnalysisByAccount with empty data', async () => {
      const emptyResponse = { status: 'success', data: [] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(emptyResponse)) as any);

      const result = await service.getBenfordAnalysisByAccount('acc2', 'DEFAULT', '2024-01-01', '2024-12-31');

      expect(result.sampleSize).toBe(0);
      expect(result.actual[1]).toBe(0);
    });

    it('should handle getBenfordAnalysisByAccount with error', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Analysis failed')) as any);

      await expect(service.getBenfordAnalysisByAccount('acc3', 'DEFAULT', '2024-01-01', '2024-12-31')).rejects.toThrow(
        'Failed to perform Benford analysis',
      );
    });

    it('should handle getAlertNavigatorData when no typologies exist', async () => {
      const alertResponse = {
        status: 'success',
        data: [
          {
            alert_id: 123,
            transaction_id: 'tx1',
          },
        ],
      };
      const emptyTypologiesResponse = {
        status: 'success',
        data: [],
      };
      const emptyRulesResponse = {
        status: 'success',
        data: [],
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(alertResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(emptyTypologiesResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(emptyRulesResponse)) as any);

      const result = await service.getAlertNavigatorData(123, 'DEFAULT');

      expect(result).toHaveProperty('alertMetadata');
      expect(result.typologies).toEqual([]);
    });

    it('should handle getTransactionDetailData when transaction not found', async () => {
      const emptyResponse = {
        status: 'success',
        data: [],
      };
      jest.spyOn(service, 'query').mockResolvedValue(emptyResponse as any);

      await expect(service.getTransactionDetailData(999, 'DEFAULT')).rejects.toThrow();
    });

    it('should handle getConditionsSummary with different granularities', async () => {
      const mockResponse = {
        status: 'success',
        data: [
          {
            active_conditions: 10,
            blocked_transactions: 5,
            overridden_transactions: 2,
            future_conditions: 3,
          },
        ],
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const resultWeek = await service.getConditionsSummary('acc1', 'DEFAULT', '2024-01-01');
      expect(resultWeek.activeConditions).toBe(10);
      expect(resultWeek.blockedTransactions).toBe(5);

      const resultYear = await service.getConditionsSummary('acc1', 'DEFAULT', '2023-01-01');
      expect(resultYear.activeConditions).toBe(10);
    });

    it('should handle query with empty result', async () => {
      const emptyResponse = {
        status: 'success',
        data: [],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(emptyResponse)) as any);

      const result = await service.query({ table_name: 'test_table', columns: [], filters: {} });

      expect(result.data).toEqual([]);
      expect(result.status).toBe('success');
    });

    it('should handle runSqlQuery with custom limit', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ id: 1 }, { id: 2 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.runSqlQuery('SELECT * FROM test', 10);

      expect(result.data.length).toBe(2);
      expect(httpService.post).toHaveBeenCalled();
    });

    it('should handle getAlertHistorySummary with empty results', async () => {
      const mockResponse = {
        status: 'success',
        data: [
          {
            total_alerts: 0,
            cases_opened: 0,
            investigations: 0,
            sar_filings: 0,
            total_value: 0,
          },
        ],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistorySummary('e2e999', 'DEFAULT');

      expect(result.totalAlerts).toBe(0);
      expect(result.casesOpened).toBe(0);
    });

    it('should handle getEvaluatedTransactions with multiple conditions', async () => {
      const mockResponse = {
        status: 'success',
        data: [
          {
            tx_transaction_id: 'tx1',
            tx_event_ts: '2024-01-01',
            tx_type: 'PAYMENT',
            tx_amount: 100,
            tx_ccy: 'USD',
            tx_block_override_status: 'PASSED',
            cond_condition_id: 'cond1',
            cond_reason: 'Reason 1',
          },
          {
            tx_transaction_id: 'tx2',
            tx_event_ts: '2024-01-02',
            tx_type: 'TRANSFER',
            tx_amount: 200,
            tx_ccy: 'EUR',
            tx_block_override_status: 'BLOCKED',
            cond_condition_id: 'cond2',
            cond_reason: 'Reason 2',
          },
        ],
      };

      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getEvaluatedTransactions('acc1', 'DEFAULT', '2024-01-01');

      expect(result.length).toBe(2);
      expect(result[0].transactionId).toBe('tx1');
      expect(result[1].outcome).toBe('BLOCKED');
    });

    it('should handle network timespan variations', async () => {
      const centerAccountResponse = {
        status: 'success',
        data: [
          {
            account_id: 'acc1',
            account_name: 'Account 1',
          },
        ],
      };
      const outboundResponse = {
        status: 'success',
        data: [
          {
            connected_account_id: 'acc2',
            connected_account_name: 'Account 2',
            flow_direction: 'OUTBOUND',
            total_transactions: 5,
            total_value: 2500,
            avg_value: 500,
            first_tx_date: '2024-01-01',
            last_tx_date: '2024-01-31',
            duration_days: 30,
          },
        ],
      };
      const inboundResponse = {
        status: 'success',
        data: [],
      };
      const alertsResponse = {
        status: 'success',
        data: [],
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(centerAccountResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(outboundResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(inboundResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(alertsResponse)) as any);

      const result = await service.getTransactionNetworkData('acc1', 'DEFAULT', '7d');
      expect(result).toHaveProperty('centerAccount');
      expect(result.centerAccount.accountId).toBe('acc1');
    });

    it('should handle getTransactionOverviewUIData with valid data', async () => {
      const mockResponse = {
        status: 'success',
        data: [
          {
            transaction_id: '1',
            end_to_end_id: 'e2e1',
            tx_event_ts: '2024-01-01T12:00:00Z',
            tx_type: 'PAYMENT',
            interbank_settlement_amount: 1000,
            interbank_settlement_currency: 'USD',
            debtor_name: 'Debtor',
            creditor_name: 'Creditor',
            debtor_account_id: 'acc1',
            creditor_account_id: 'acc2',
            tenant_id: 'DEFAULT',
          },
        ],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getTransactionOverviewUIData(1, 'DEFAULT');

      expect(result).toBeDefined();
    });

    it('should handle query with specific columns', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ col1: 'val1', col2: 'val2' }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.query({ table_name: 'test_table', columns: ['col1', 'col2'], filters: {} });

      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should handle getAlertNavigatorData with no alert data', async () => {
      const emptyAlertResponse = { status: 'success', data: [] };

      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(emptyAlertResponse)) as any);

      await expect(service.getAlertNavigatorData(999, 'DEFAULT')).rejects.toThrow();
    });

    it('should handle getTransactionPerspectivesByEndToEndId with empty results', async () => {
      const emptyResponse = { status: 'success', data: [] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(emptyResponse)) as any);

      const result = await service.getTransactionPerspectivesByEndToEndId('e2e999', 'DEFAULT');

      expect(result).toHaveProperty('perspectives');
      expect((result as any).perspectives).toEqual([]);
    });

    it('should handle getTransactionOverviewUIData when transaction not found', async () => {
      const emptyResponse = { status: 'success', data: [] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(emptyResponse)) as any);

      await expect(service.getTransactionOverviewUIData(999, 'DEFAULT')).rejects.toThrow(HttpException);
    });

    it('should handle getAccountNodeFullData with different granularities', async () => {
      const networkResponse = {
        status: 'success',
        data: [
          {
            from_account_id: 'a1',
            to_account_id: 'a2',
            tx_count: 3,
            total_amount: 1500,
            currency_hint: 'USD',
            first_event_ts: '2024-01-01',
            last_event_ts: '2024-01-31',
            is_alerted_edge: 0,
            is_investigated_edge: 0,
          },
        ],
      };
      const metricsResponse = { status: 'success', data: [{ transactions: 3, total_value: 1500, is_alerted: 0, is_investigated: 0 }] };
      const holderResponse = { status: 'success', data: [{ holder_name: 'Holder' }] };
      const alertResponse = { status: 'success', data: [{ alert_count: 0 }] };
      const investigationResponse = { status: 'success', data: [{ investigation_count: 0 }] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(networkResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(metricsResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(holderResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(alertResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(investigationResponse)) as any);

      const result = await service.getAccountNodeFullData('acc1', 'DEFAULT', 'year');

      expect(result.network.nodes.length).toBeGreaterThan(0);
    });

    it('should handle runSqlQuery with ErrorResponse status', async () => {
      const errorResponse = { status: 'error', code: 500, message: 'Database error' };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(errorResponse)) as any);

      await expect(service.runSqlQuery('SELECT * FROM test', 10)).rejects.toThrow();
    });

    it('should handle query with filters', async () => {
      const mockResponse = { status: 'success', data: [{ id: 1, name: 'Test' }] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.query({
        table_name: 'alerts',
        filters: { risk_level: 'HIGH', status: 'OPEN' },
        columns: ['id', 'name'],
        limit: 50,
      });

      expect(result.data.length).toBe(1);
    });

    it('should handle getConditionsSummary with no data', async () => {
      const emptyResponse = {
        status: 'success',
        data: [{ active_conditions: 0, blocked_transactions: 0, overridden_transactions: 0, future_conditions: 0 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(emptyResponse)) as any);

      const result = await service.getConditionsSummary('acc999', 'DEFAULT');

      expect(result.activeConditions).toBe(0);
      expect(result.blockedTransactions).toBe(0);
    });

    it('should handle getEvaluatedTransactions with error response', async () => {
      const errorResponse = { status: 'error' };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(errorResponse)) as any);

      await expect(service.getEvaluatedTransactions('acc1', 'DEFAULT')).rejects.toThrow();
    });

    it('should handle getTransactionHistoryData with empty entity_id results', async () => {
      const emptyResponse = { status: 'success', data: [] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(emptyResponse)) as any);

      const result = await service.getTransactionHistoryData('entity999', 'DEFAULT');

      expect(result).toHaveProperty('summary');
      expect((result as any).summary.totalTransactions).toBe(0);
    });

    it('should handle getAlertHistorySummary with different date ranges', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ total_alerts: 5, cases_opened: 2, investigations: 1, sar_filings: 0, total_value: 10000 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result30 = await service.getAlertHistorySummary('e2e123', 'DEFAULT', '30days');
      expect(result30.totalAlerts).toBe(5);

      const result90 = await service.getAlertHistorySummary('e2e123', 'DEFAULT', '90days');
      expect(result90.totalAlerts).toBe(5);

      const result6m = await service.getAlertHistorySummary('e2e123', 'DEFAULT', '6months');
      expect(result6m.totalAlerts).toBe(5);

      const result1y = await service.getAlertHistorySummary('e2e123', 'DEFAULT', '1year');
      expect(result1y.totalAlerts).toBe(5);
    });

    it('should handle getTransactionHistoryData with granularity parameter', async () => {
      const eventsResponse = {
        status: 'success',
        data: [
          {
            transaction_id: 'tx1',
            entity_id: 'entity1',
            event_date: '2024-01-01',
            event_ts: '2024-01-01T12:00:00Z',
            tx_amount: 100,
            tx_ccy: 'USD',
            tx_type: 'PAYMENT',
            is_alerted: 0,
            is_investigated: 0,
          },
        ],
      };
      const aggResponse = {
        status: 'success',
        data: [
          {
            bucket_start: '2024-01-01',
            bucket_tx_count: 10,
            bucket_tx_amount: 1000,
            bucket_granularity: 'day',
          },
        ],
      };
      const baselineResponse = { status: 'success', data: [] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(eventsResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(aggResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(baselineResponse)) as any);

      const result = await service.getTransactionHistoryData('entity1', 'DEFAULT', '2024-01-01', '2024-01-31', 'day');

      expect(result).toHaveProperty('summary');
      expect((result as any).volumeDistribution).toBeDefined();
    });

    it('should handle getTransactionHistoryData with start and end dates', async () => {
      const eventsResponse = {
        status: 'success',
        data: [
          {
            transaction_id: 'tx1',
            entity_id: 'entity1',
            event_date: '2024-01-01',
            event_ts: '2024-01-01T12:00:00Z',
            tx_amount: 100,
            tx_ccy: 'USD',
            tx_type: 'PAYMENT',
            is_alerted: 0,
            is_investigated: 0,
          },
        ],
      };
      const baselineResponse = { status: 'success', data: [] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(eventsResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(baselineResponse)) as any);

      const result = await service.getTransactionHistoryData('entity1', 'DEFAULT', '2024-01-01', '2024-01-31');

      expect(result).toHaveProperty('summary');
    });

    it('should handle getAlertHistorySummary with all date range', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ total_alerts: 10, cases_opened: 5, investigations: 3, sar_filings: 1, total_value: 50000 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistorySummary('e2e123', 'DEFAULT', 'all');
      expect(result.totalAlerts).toBe(10);
    });

    it('should handle getAlertHistorySummary with no endToEndId', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ total_alerts: 2, cases_opened: 1, investigations: 0, sar_filings: 0, total_value: 5000 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistorySummary(undefined, 'DEFAULT');
      expect(result.totalAlerts).toBe(2);
    });

    it('should handle query with limit parameter', async () => {
      const mockResponse = { status: 'success', data: Array.from({ length: 10 }, (_, i) => ({ id: i + 1 })) };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.query({
        table_name: 'alerts',
        limit: 10,
      });

      expect(result.data.length).toBe(10);
    });

    it('should handle getEvaluatedTransactions with empty data', async () => {
      const emptyResponse = { status: 'success', data: [] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(emptyResponse)) as any);

      const result = await service.getEvaluatedTransactions('acc1', 'DEFAULT', '2024-01-01');

      expect(result).toEqual([]);
    });

    it('should handle getAccountNodeFullData with day granularity', async () => {
      const networkResponse = {
        status: 'success',
        data: [
          {
            from_account_id: 'a1',
            to_account_id: 'a2',
            tx_count: 2,
            total_amount: 1000,
            currency_hint: 'USD',
            first_event_ts: '2024-01-01',
            last_event_ts: '2024-01-02',
            is_alerted_edge: 0,
            is_investigated_edge: 0,
          },
        ],
      };
      const metricsResponse = { status: 'success', data: [{ transactions: 2, total_value: 1000, is_alerted: 0, is_investigated: 0 }] };
      const holderResponse = { status: 'success', data: [{ holder_name: 'Holder Name' }] };
      const alertResponse = { status: 'success', data: [{ alert_count: 0 }] };
      const investigationResponse = { status: 'success', data: [{ investigation_count: 0 }] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(networkResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(metricsResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(holderResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(alertResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(investigationResponse)) as any);

      const result = await service.getAccountNodeFullData('acc1', 'DEFAULT', 'day');

      expect(result.network.nodes.length).toBeGreaterThan(0);
    });

    it('should handle getTransactionNetworkData with empty connections', async () => {
      const centerAccountResponse = { status: 'success', data: [{ account_id: 'acc1', account_name: 'Account 1' }] };
      const emptyOutbound = { status: 'success', data: [] };
      const emptyInbound = { status: 'success', data: [] };
      const emptyAlerts = { status: 'success', data: [] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(centerAccountResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(emptyOutbound)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(emptyInbound)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(emptyAlerts)) as any);

      const result = await service.getTransactionNetworkData('acc1', 'DEFAULT', '30d');

      expect(result.connectedAccounts.length).toBe(0);
      expect(result.centerAccount.networkSummary.connectedAccounts).toBe(0);
    });

    it('should handle getTransactionNetworkData when account not found', async () => {
      const emptyResponse = { status: 'success', data: [] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(emptyResponse)) as any);

      await expect(service.getTransactionNetworkData('nonexistent', 'DEFAULT')).rejects.toThrow(HttpException);
    });

    it('should handle getCounterpartyNodeFullData successfully', async () => {
      const networkResponse = {
        status: 'success',
        data: [
          {
            from_counterparty_id: 'cp1',
            to_counterparty_id: 'cp2',
            tx_count: 15,
            total_amount: 7500,
            currency_hint: 'USD',
            first_event_ts: '2024-01-01',
            last_event_ts: '2024-01-31',
            is_alerted_edge: 0,
            is_investigated_edge: 1,
          },
        ],
      };
      const metricsResponse = { status: 'success', data: [{ transactions: 15, total_value: 7500, is_alerted: 1, is_investigated: 1 }] };
      const nameResponse = { status: 'success', data: [{ name: 'Counterparty Name', type: 'DEBTOR' }] };
      const alertResponse = { status: 'success', data: [{ alert_count: 1 }] };
      const investigationResponse = { status: 'success', data: [{ investigation_count: 1 }] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(networkResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(metricsResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(nameResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(alertResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(investigationResponse)) as any);

      const result = await service.getCounterpartyNodeFullData('cp1', 'DEFAULT', 'month');

      expect(result).toHaveProperty('network');
      expect(result).toHaveProperty('counterpartyDetails');
      expect(result.network.nodes.length).toBeGreaterThan(0);
    });

    it('should handle getAlertHistoryTimeline successfully', async () => {
      const mockResponse = {
        status: 'success',
        data: [
          {
            date: '2024-01-01T00:00:00.000Z',
            alert_count: 3,
            case_count: 2,
            investigation_count: 1,
            total_value: 1500,
          },
        ],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryTimeline('e2e123', 'DEFAULT');

      expect(result).toHaveProperty('alertCountOverTime');
      expect(result).toHaveProperty('alertValueOverTime');
      expect(result.alertCountOverTime).toBeInstanceOf(Array);
    });

    it('should handle getAlertHistoryAlerts successfully', async () => {
      const mockResponse = {
        status: 'success',
        data: [
          {
            alert_id: 1,
            alert_date: '2024-01-01',
            typology_id: 'typ1',
            rule_ids: 'rule1,rule2',
            status: 'OPEN',
          },
        ],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryAlerts('e2e123', 'DEFAULT');

      expect(result).toHaveProperty('alerts');
      expect(result.alerts).toBeInstanceOf(Array);
    });

    it('should handle getTestAccountIds successfully', async () => {
      const mockResponse = {
        status: 'success',
        data: [
          { account_id: 'acc1', account_name: 'Account 1', connections: 5, total_transactions: 100 },
          { account_id: 'acc2', account_name: 'Account 2', connections: 3, total_transactions: 50 },
          { account_id: 'acc3', account_name: 'Account 3', connections: 2, total_transactions: 25 },
        ],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getTestAccountIds('DEFAULT');

      expect(result).toBeDefined();
      expect((result as any).accounts).toBeInstanceOf(Array);
      expect((result as any).accounts.length).toBe(3);
    });

    it('should handle query with all parameters', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ id: 1, name: 'Test', status: 'ACTIVE' }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.query({
        table_name: 'alerts',
        filters: { status: 'ACTIVE', priority: 'HIGH' },
        columns: ['id', 'name', 'status'],
        limit: 100,
      });

      expect(result.data.length).toBe(1);
      expect(result.status).toBe('success');
    });

    it('should handle getCounterpartyNodeFullData with different granularities', async () => {
      const networkResponse = {
        status: 'success',
        data: [
          {
            from_counterparty_id: 'cp1',
            to_counterparty_id: 'cp2',
            tx_count: 5,
            total_amount: 2500,
            currency_hint: 'EUR',
            first_event_ts: '2024-01-01',
            last_event_ts: '2024-01-05',
            is_alerted_edge: 0,
            is_investigated_edge: 0,
          },
        ],
      };
      const metricsResponse = { status: 'success', data: [{ transactions: 5, total_value: 2500, is_alerted: 0, is_investigated: 0 }] };
      const nameResponse = { status: 'success', data: [{ name: 'CP Name', type: 'CREDITOR' }] };
      const alertResponse = { status: 'success', data: [{ alert_count: 0 }] };
      const investigationResponse = { status: 'success', data: [{ investigation_count: 0 }] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(networkResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(metricsResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(nameResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(alertResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(investigationResponse)) as any);

      const result = await service.getCounterpartyNodeFullData('cp1', 'DEFAULT', 'day');

      expect(result.network.nodes.length).toBeGreaterThan(0);
    });

    it('should handle getCounterpartyNodeFullData with error during SQL query', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('SQL query failed')) as any);

      await expect(service.getCounterpartyNodeFullData('cp1', 'DEFAULT', 'month')).rejects.toThrow(HttpException);
    });

    it('should handle getCounterpartyNodeFullData with alerted and investigated edges', async () => {
      const networkResponse = {
        status: 'success',
        data: [
          {
            from_counterparty_id: 'cp1',
            to_counterparty_id: 'cp2',
            tx_count: 25,
            total_amount: 15000,
            currency_hint: 'USD',
            first_event_ts: '2024-01-01',
            last_event_ts: '2024-02-28',
            is_alerted_edge: 1,
            is_investigated_edge: 1,
          },
          {
            from_counterparty_id: 'cp2',
            to_counterparty_id: 'cp3',
            tx_count: 10,
            total_amount: 5000,
            currency_hint: 'USD',
            first_event_ts: '2024-01-15',
            last_event_ts: '2024-02-15',
            is_alerted_edge: 1,
            is_investigated_edge: 0,
          },
        ],
      };
      const metricsResponse = { status: 'success', data: [{ transactions: 35, total_value: 20000, is_alerted: 1, is_investigated: 1 }] };
      const nameResponse = { status: 'success', data: [{ holder_name: 'Counterparty Business' }] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(networkResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(metricsResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(nameResponse)) as any);

      const result = await service.getCounterpartyNodeFullData('cp1', 'DEFAULT', 'month');

      expect(result.network.nodes.length).toBe(3);
      expect(result.counterpartyDetails.flags.alerted).toBe(true);
      expect(result.counterpartyDetails.flags.investigated).toBe(true);
    });

    it('should handle getCounterpartyNodeFullData with fromId as new node', async () => {
      const networkResponse = {
        status: 'success',
        data: [
          {
            from_counterparty_id: 'cp5',
            to_counterparty_id: 'cp1',
            tx_count: 8,
            total_amount: 4000,
            currency_hint: 'EUR',
            first_event_ts: '2024-01-01',
            last_event_ts: '2024-01-31',
            is_alerted_edge: 0,
            is_investigated_edge: 1,
          },
        ],
      };
      const metricsResponse = { status: 'success', data: [{ transactions: 8, total_value: 4000, is_alerted: 0, is_investigated: 1 }] };
      const nameResponse = { status: 'success', data: [{ holder_name: 'Test Entity' }] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(networkResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(metricsResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(nameResponse)) as any);

      const result = await service.getCounterpartyNodeFullData('cp1', 'DEFAULT', 'day');

      expect(result.network.nodes.length).toBe(2);
      expect(result.network.edges.length).toBe(1);
    });

    it('should handle getCounterpartyNetworkData when no counterparties found', async () => {
      const accountHolderResponse = {
        status: 'success',
        data: [{ debtor_name: 'Test Account', creditor_name: 'Test Creditor', debtor_account_id: 'acc1', creditor_account_id: 'acc2' }],
      };
      const emptyCounterpartyLinksResponse = { status: 'success', data: [] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(accountHolderResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(emptyCounterpartyLinksResponse)) as any);

      await expect(service.getCounterpartyNetworkData('acc1', 'DEFAULT')).rejects.toThrow('Failed to fetch counterparty network data');
    });

    it('should handle getAlertHistoryTimeline with 90days date range', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ date: '2024-01-01', alert_count: 2, case_count: 1, investigation_count: 0, total_value: 500 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryTimeline('e2e123', 'DEFAULT', '90days');
      expect(result.alertCountOverTime).toBeDefined();
    });

    it('should handle getAlertHistoryTimeline with 6months date range', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ date: '2023-09-01', alert_count: 5, case_count: 3, investigation_count: 2, total_value: 2500 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryTimeline('e2e123', 'DEFAULT', '6months');
      expect(result.alertCountOverTime.length).toBeGreaterThan(0);
    });

    it('should handle getAlertHistoryTimeline with 1year date range', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ date: '2023-03-01', alert_count: 10, case_count: 7, investigation_count: 5, total_value: 10000 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryTimeline('e2e123', 'DEFAULT', '1year');
      expect(result.alertCountOverTime.length).toBeGreaterThan(0);
    });

    it('should handle getAlertHistoryTimeline with default/unknown date range', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ date: '2024-01-01', alert_count: 1, case_count: 0, investigation_count: 0, total_value: 100 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryTimeline('e2e123', 'DEFAULT', 'unknown');
      expect(result).toHaveProperty('alertCountOverTime');
    });

    it('should handle getAlertHistoryAlerts with 90days date range', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ alert_id: 5, alert_date: '2024-01-15', typology_id: 'typ2', rule_ids: 'rule5', status: 'INVESTIGATING' }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryAlerts('e2e123', 'DEFAULT', '90days');
      expect(result.alerts).toBeInstanceOf(Array);
    });

    it('should handle getAlertHistoryAlerts with 6months date range', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ alert_id: 6, alert_date: '2023-09-15', typology_id: 'typ3', rule_ids: 'rule6', status: 'CLOSED' }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryAlerts('e2e123', 'DEFAULT', '6months');
      expect(result.alerts).toBeInstanceOf(Array);
    });

    it('should handle getAlertHistoryAlerts with 1year date range', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ alert_id: 7, alert_date: '2023-03-15', typology_id: 'typ4', rule_ids: 'rule7', status: 'RESOLVED' }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryAlerts('e2e123', 'DEFAULT', '1year');
      expect(result.alerts).toBeInstanceOf(Array);
    });

    it('should handle getAlertHistoryAlerts with default/unknown date range', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ alert_id: 8, alert_date: '2024-01-01', typology_id: 'typ1', rule_ids: 'rule1', status: 'OPEN' }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryAlerts('e2e123', 'DEFAULT', 'custom');
      expect(result.alerts).toBeDefined();
    });

    it('should handle getTransactionHistoryByEndToEndId with empty UUID results', async () => {
      const emptyResponse = { status: 'success', data: [] };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(emptyResponse)) as any);

      const result = await service.getTransactionHistoryData('00000000-0000-0000-0000-000000000000', 'DEFAULT');

      expect((result as any).summary.totalTransactions).toBe(0);
      expect((result as any).entityPerspectives).toEqual([]);
    });

    it('should handle getAlertNavigatorData with rules having weight', async () => {
      const alertResponse = {
        status: 'success',
        data: [
          {
            alert_id: 200,
            transaction_id: 'tx100',
            end_to_end_id: 'e2e100',
            alert_status: 'INVESTIGATING',
            alert_tx_type: 'TRANSFER',
            alert_tx_amount: 5000,
            alert_tx_ccy: 'EUR',
            created_at_ts: '2024-01-15',
          },
        ],
      };
      const typologiesResponse = {
        status: 'success',
        data: [
          {
            typology_id: 'typ100',
            typology_cfg: '100',
            typology_score: 90,
            alert_threshold: 80,
            interdiction_threshold: 95,
          },
        ],
      };
      const rulesResponse = {
        status: 'success',
        data: [
          {
            rule_id: 'rule100',
            rule_cfg: '100@1.0.0',
            rule_weight: 15,
            rule_score: 100,
            rule_desc: 'High risk rule',
            rule_sub_ref: 'SUB100',
            typology_cfg: '100',
          },
        ],
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(alertResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(typologiesResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(rulesResponse)) as any);

      const result = await service.getAlertNavigatorData(200, 'DEFAULT');

      expect(result.typologies).toBeDefined();
      expect(result.typologies[0]).toHaveProperty('rules');
      expect(result.statistics.totalRules).toBe(1);
    });

    it('should handle getTransactionHistoryData with both startDate and endDate', async () => {
      const eventsResponse = {
        status: 'success',
        data: [
          {
            transaction_id: 'tx1',
            entity_id: 'entity1',
            event_date: '2024-01-15',
            event_ts: '2024-01-15T10:00:00Z',
            tx_amount: 150,
            tx_ccy: 'USD',
            tx_type: 'PAYMENT',
            is_alerted: 0,
            is_investigated: 0,
          },
        ],
      };
      const baselineResponse = { status: 'success', data: [{ expected_tx_count: 20, expected_volume: 2000 }] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(eventsResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(baselineResponse)) as any);

      const result = await service.getTransactionHistoryData('entity1', 'DEFAULT', '2024-01-01', '2024-01-31');

      expect((result as any).summary).toBeDefined();
      expect((result as any).meta.startDate).toBe('2024-01-01');
      expect((result as any).meta.endDate).toBe('2024-01-31');
    });

    it('should handle getAlertHistoryTimeline with day granularity', async () => {
      const mockResponse = {
        status: 'success',
        data: [
          { date: '2024-01-01', alert_count: 1, case_count: 0, investigation_count: 0, total_value: 100 },
          { date: '2024-01-02', alert_count: 2, case_count: 1, investigation_count: 0, total_value: 200 },
        ],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryTimeline('e2e123', 'DEFAULT', '30days', 'day');
      expect(result.alertCountOverTime.length).toBe(2);
    });

    it('should handle getAlertHistoryTimeline with month granularity', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ date: '2024-01-01', alert_count: 10, case_count: 5, investigation_count: 3, total_value: 5000 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryTimeline('e2e123', 'DEFAULT', '1year', 'month');
      expect(result.alertCountOverTime).toBeDefined();
    });

    it('should handle getAlertHistoryTimeline with year granularity', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ date: '2024-01-01', alert_count: 100, case_count: 50, investigation_count: 30, total_value: 50000 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryTimeline('e2e123', 'DEFAULT', 'all', 'year');
      expect(result.alertCountOverTime).toBeDefined();
    });

    it('should handle getAlertHistoryAlerts with 30days date range', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ alert_id: 9, alert_date: '2024-02-01', typology_id: 'typ5', rule_ids: 'rule9', status: 'INVESTIGATING' }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistoryAlerts('e2e123', 'DEFAULT', '30days', 1, 20);
      expect(result.alerts).toBeDefined();
    });

    it('should handle getCounterpartyNetworkData when counterparty names are missing', async () => {
      const accountHolderResponse = {
        status: 'success',
        data: [{ debtor_name: 'Holder', debtor_account_id: 'acc1', creditor_name: 'Other', creditor_account_id: 'acc2' }],
      };
      const counterpartyLinksResponse = { status: 'success', data: [{ counterparty_id: 'cp_unknown' }] };
      const networkEdgesResponse = {
        status: 'success',
        data: [
          {
            from_counterparty_id: 'cp_unknown',
            to_counterparty_id: 'cp_other',
            tx_count: 5,
            total_amount: 2500,
            is_alerted_edge: 0,
            is_investigated_edge: 0,
            first_event_ts: '2024-01-01',
            last_event_ts: '2024-01-31',
          },
        ],
      };
      const emptyNamesResponse = { status: 'success', data: [] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(accountHolderResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(counterpartyLinksResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(networkEdgesResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(emptyNamesResponse)) as any);

      const result = await service.getCounterpartyNetworkData('acc1', 'DEFAULT', '30d');
      expect(result.counterparties).toBeDefined();
    });

    it('should handle getTransactionNetworkData with accounts having HIGH velocity', async () => {
      const centerAccountResponse = { status: 'success', data: [{ account_id: 'acc1', account_name: 'High Volume Account' }] };
      const outboundResponse = {
        status: 'success',
        data: [
          {
            connected_account_id: 'acc2',
            connected_account_name: 'Target Account',
            flow_direction: 'OUTBOUND',
            total_transactions: 100,
            total_value: 50000,
            avg_value: 500,
            first_tx_date: '2024-01-01',
            last_tx_date: '2024-01-31',
            duration_days: 30,
          },
        ],
      };
      const inboundResponse = { status: 'success', data: [] };
      const alertsResponse = { status: 'success', data: [] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(centerAccountResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(outboundResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(inboundResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(alertsResponse)) as any);

      const result = await service.getTransactionNetworkData('acc1', 'DEFAULT', '30d');
      expect(result.connectedAccounts[0].transactionStats.velocity).toBe('HIGH');
    });

    it('should handle getTransactionNetworkData with accounts having MEDIUM velocity', async () => {
      const centerAccountResponse = { status: 'success', data: [{ account_id: 'acc1', account_name: 'Medium Volume Account' }] };
      const outboundResponse = {
        status: 'success',
        data: [
          {
            connected_account_id: 'acc2',
            connected_account_name: 'Target',
            flow_direction: 'OUTBOUND',
            total_transactions: 7,
            total_value: 3500,
            avg_value: 500,
            first_tx_date: '2024-01-01',
            last_tx_date: '2024-01-31',
            duration_days: 30,
          },
        ],
      };
      const inboundResponse = { status: 'success', data: [] };
      const alertsResponse = { status: 'success', data: [] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(centerAccountResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(outboundResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(inboundResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(alertsResponse)) as any);

      const result = await service.getTransactionNetworkData('acc1', 'DEFAULT', '30d');
      expect(result.connectedAccounts[0].transactionStats.velocity).toBe('MEDIUM');
    });

    it('should handle getTransactionNetworkData with accounts having LOW velocity', async () => {
      const centerAccountResponse = { status: 'success', data: [{ account_id: 'acc1', account_name: 'Low Volume Account' }] };
      const outboundResponse = {
        status: 'success',
        data: [
          {
            connected_account_id: 'acc2',
            connected_account_name: 'Target',
            flow_direction: 'OUTBOUND',
            total_transactions: 2,
            total_value: 1000,
            avg_value: 500,
            first_tx_date: '2024-01-01',
            last_tx_date: '2024-01-31',
            duration_days: 30,
          },
        ],
      };
      const inboundResponse = { status: 'success', data: [] };
      const alertsResponse = { status: 'success', data: [] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(centerAccountResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(outboundResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(inboundResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(alertsResponse)) as any);

      const result = await service.getTransactionNetworkData('acc1', 'DEFAULT', '30d');
      expect(result.connectedAccounts[0].transactionStats.velocity).toBe('LOW');
    });

    it('should handle getTransactionHistoryByEndToEndId with error thrown', async () => {
      jest.spyOn(httpService, 'post').mockReturnValue(throwError(() => new Error('Database connection failed')) as any);

      await expect(service.getTransactionHistoryData('550e8400-e29b-41d4-a716-446655440000', 'DEFAULT')).rejects.toThrow();
    });

    it('should handle getAlertHistorySummary with invalid date range', async () => {
      const mockResponse = {
        status: 'success',
        data: [{ total_alerts: 3, cases_opened: 1, investigations: 0, sar_filings: 0, total_value: 1500 }],
      };
      jest.spyOn(httpService, 'post').mockReturnValue(of(createMockHttpResponse(mockResponse)) as any);

      const result = await service.getAlertHistorySummary('e2e123', 'DEFAULT', 'invalid_range');
      expect(result.totalAlerts).toBe(3);
    });

    it('should handle getCounterpartyNetworkData with multiple edges for same counterparty pair', async () => {
      const accountHolderResponse = {
        status: 'success',
        data: [{ debtor_name: 'Main Account', debtor_account_id: 'acc1', creditor_name: 'Other', creditor_account_id: 'acc2' }],
      };
      const counterpartyLinksResponse = { status: 'success', data: [{ counterparty_id: 'dbtr_acc1' }, { counterparty_id: 'cdtr_acc2' }] };
      const networkEdgesResponse = {
        status: 'success',
        data: [
          {
            from_counterparty_id: 'dbtr_acc1',
            to_counterparty_id: 'cdtr_acc2',
            tx_count: 10,
            total_amount: 5000,
            is_alerted_edge: 1,
            is_investigated_edge: 1,
            first_event_ts: '2024-01-01',
            last_event_ts: '2024-01-15',
          },
          {
            from_counterparty_id: 'dbtr_acc1',
            to_counterparty_id: 'cdtr_acc3',
            tx_count: 5,
            total_amount: 2500,
            is_alerted_edge: 0,
            is_investigated_edge: 0,
            first_event_ts: '2024-01-16',
            last_event_ts: '2024-01-31',
          },
        ],
      };
      const namesResponse = {
        status: 'success',
        data: [
          { counterparty_id: 'dbtr_acc1', name: 'CP1' },
          { counterparty_id: 'cdtr_acc2', name: 'CP2' },
          { counterparty_id: 'cdtr_acc3', name: 'CP3' },
        ],
      };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(accountHolderResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(counterpartyLinksResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(networkEdgesResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(namesResponse)) as any);

      const result = await service.getCounterpartyNetworkData('acc1', 'DEFAULT', '30d');
      expect(result.counterparties.length).toBeGreaterThan(0);
    });

    it('should handle getTransactionHistoryData with granularity but no date range', async () => {
      const eventsResponse = {
        status: 'success',
        data: [
          {
            transaction_id: 'tx1',
            entity_id: 'entity1',
            event_date: '2024-01-01',
            event_ts: '2024-01-01T12:00:00Z',
            tx_amount: 100,
            tx_ccy: 'USD',
            tx_type: 'PAYMENT',
            is_alerted: 0,
            is_investigated: 0,
          },
        ],
      };
      const aggResponse = {
        status: 'success',
        data: [{ bucket_start: '2024-01-01', bucket_tx_count: 10, bucket_tx_amount: 1000, bucket_granularity: 'month' }],
      };
      const baselineResponse = { status: 'success', data: [] };

      jest
        .spyOn(httpService, 'post')
        .mockReturnValueOnce(of(createMockHttpResponse(eventsResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(aggResponse)) as any)
        .mockReturnValueOnce(of(createMockHttpResponse(baselineResponse)) as any);

      const result = await service.getTransactionHistoryData('entity1', 'DEFAULT', undefined, undefined, 'month');
      expect((result as any).volumeDistribution).toBeDefined();
    });
  });
});
