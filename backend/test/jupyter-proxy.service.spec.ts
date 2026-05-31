import { Test, TestingModule } from '@nestjs/testing';
import { JupyterProxyService } from '../src/modules/jupyter/jupyter-proxy.service';
import { TransactionLakehouseService } from '../src/modules/gold-lakehouse/transaction-lakehouse.service';
import { AccountLakehouseService } from '../src/modules/gold-lakehouse/account-lakehouse.service';
import { AlertsLakehouseService } from '../src/modules/gold-lakehouse/alerts-lakehouse.service';
import { BenfordsLawLakehouseService } from '../src/modules/gold-lakehouse/benfordsLaw-lakehouse.service';
import { ConditionLakehouseService } from '../src/modules/gold-lakehouse/condition-lakehouse.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { CacheService } from '../src/modules/shared/cache.service';

const MOCK_USER_ID = 'user-1';
const MOCK_JWT = 'mock-jwt-token';

describe('JupyterProxyService', () => {
  let service: JupyterProxyService;
  let transactionSvc: jest.Mocked<TransactionLakehouseService>;
  let accountSvc: jest.Mocked<AccountLakehouseService>;
  let alertsSvc: jest.Mocked<AlertsLakehouseService>;
  let benfordsSvc: jest.Mocked<BenfordsLawLakehouseService>;
  let conditionSvc: jest.Mocked<ConditionLakehouseService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JupyterProxyService,
        {
          provide: TransactionLakehouseService,
          useValue: {
            getCounterpartyNetworkData: jest.fn().mockResolvedValue({}),
            getTransactionHistoryByAccountId: jest.fn().mockResolvedValue({}),
            getTransactionNetworkData: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: AccountLakehouseService,
          useValue: {
            getCounterpartyNodeFullData: jest.fn().mockResolvedValue({}),
            getAccountNodeFullData: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: AlertsLakehouseService,
          useValue: {
            getAlertHistorySummary: jest.fn().mockResolvedValue({}),
            getAlertHistoryTimeline: jest.fn().mockResolvedValue({}),
            getAlertHistoryAlerts: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: BenfordsLawLakehouseService,
          useValue: {
            getBenfordAnalysisByAccount: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: ConditionLakehouseService,
          useValue: {
            getConditionsContextByTransaction: jest.fn().mockResolvedValue({}),
            getConditionsSummaryByAccount: jest.fn().mockResolvedValue({}),
            getConditionsListByAccount: jest.fn().mockResolvedValue({}),
            getEvaluatedTransactionsByAccount: jest.fn().mockResolvedValue({}),
          },
        },
        {
          provide: AuthService,
          useValue: {
            isTokenExpired: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: CacheService,
          useValue: {
            getUserToken: jest.fn().mockResolvedValue(MOCK_JWT),
          },
        },
        {
          provide: AuthService,
          useValue: {
            isTokenExpired: jest.fn().mockReturnValue(false),
          },
        },
        {
          provide: CacheService,
          useValue: {
            getUserToken: jest.fn().mockResolvedValue(MOCK_JWT),
          },
        },
      ],
    }).compile();

    service = module.get<JupyterProxyService>(JupyterProxyService);
    transactionSvc = module.get(TransactionLakehouseService);
    accountSvc = module.get(AccountLakehouseService);
    alertsSvc = module.get(AlertsLakehouseService);
    benfordsSvc = module.get(BenfordsLawLakehouseService);
    conditionSvc = module.get(ConditionLakehouseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCounterpartyNetworkData', () => {
    it('delegates to GoldLakehouseService', async () => {
      const result = await service.getCounterpartyNetworkData(MOCK_USER_ID, 'acc1', 'DEFAULT', '30d');
      expect(transactionSvc.getCounterpartyNetworkData).toHaveBeenCalledWith('acc1', 'DEFAULT', '30d', MOCK_JWT);
      expect(result).toEqual({});
    });
  });

  describe('getCounterpartyNodeFullData', () => {
    it('delegates with explicit granularity', async () => {
      await service.getCounterpartyNodeFullData(MOCK_USER_ID, 'cp1', 'DEFAULT', 'day');
      expect(accountSvc.getCounterpartyNodeFullData).toHaveBeenCalledWith('cp1', 'DEFAULT', 'day', MOCK_JWT);
    });

    it('defaults granularity to "month" when omitted', async () => {
      await service.getCounterpartyNodeFullData(MOCK_USER_ID, 'cp1', 'DEFAULT');
      expect(accountSvc.getCounterpartyNodeFullData).toHaveBeenCalledWith('cp1', 'DEFAULT', 'month', MOCK_JWT);
    });
  });

  describe('getAlertHistorySummary', () => {
    it('delegates with explicit dateRange', async () => {
      const result = await service.getAlertHistorySummary(MOCK_USER_ID, 'e2e1', 'DEFAULT', '30days');
      expect(alertsSvc.getAlertHistorySummary).toHaveBeenCalledWith('e2e1', 'DEFAULT', '30days', MOCK_JWT);
      expect(result).toEqual({});
    });

    it('defaults dateRange to "all" when omitted', async () => {
      await service.getAlertHistorySummary(MOCK_USER_ID, 'e2e1', 'DEFAULT');
      expect(alertsSvc.getAlertHistorySummary).toHaveBeenCalledWith('e2e1', 'DEFAULT', 'all', MOCK_JWT);
    });
  });

  describe('getTransactionHistoryData', () => {
    it('delegates with all parameters', async () => {
      await service.getTransactionHistoryData(MOCK_USER_ID, 'ent1', 'TENANT_A', '2024-01-01', '2024-12-31', 'day');
      expect(transactionSvc.getTransactionHistoryByAccountId).toHaveBeenCalledWith(
        'ent1',
        'TENANT_A',
        '2024-01-01',
        '2024-12-31',
        'day',
        MOCK_JWT,
      );
    });

    it('defaults tenantId to "DEFAULT" when omitted', async () => {
      await service.getTransactionHistoryData(MOCK_USER_ID, 'ent1');
      expect(transactionSvc.getTransactionHistoryByAccountId).toHaveBeenCalledWith(
        'ent1',
        'DEFAULT',
        undefined,
        undefined,
        undefined,
        MOCK_JWT,
      );
    });
  });

  describe('getAlertHistoryTimeline', () => {
    it('delegates with all parameters', async () => {
      await service.getAlertHistoryTimeline(MOCK_USER_ID, 'e2e1', 'DEFAULT', '30days', 'month');
      expect(alertsSvc.getAlertHistoryTimeline).toHaveBeenCalledWith('e2e1', 'DEFAULT', '30days', 'month', MOCK_JWT);
    });

    it('applies defaults when parameters are omitted', async () => {
      await service.getAlertHistoryTimeline(MOCK_USER_ID);
      expect(alertsSvc.getAlertHistoryTimeline).toHaveBeenCalledWith(undefined, undefined, 'all', 'day', MOCK_JWT);
    });
  });

  describe('getAlertHistoryAlerts', () => {
    it('delegates with all parameters', async () => {
      const result = await service.getAlertHistoryAlerts(MOCK_USER_ID, 'e2e1', 'DEFAULT', '30days', 2, 50);
      expect(alertsSvc.getAlertHistoryAlerts).toHaveBeenCalledWith('e2e1', 'DEFAULT', '30days', 2, 50, MOCK_JWT);
      expect(result).toEqual({});
    });

    it('applies defaults when parameters are omitted', async () => {
      await service.getAlertHistoryAlerts(MOCK_USER_ID);
      expect(alertsSvc.getAlertHistoryAlerts).toHaveBeenCalledWith(undefined, undefined, 'all', 1, 20, MOCK_JWT);
    });
  });

  describe('getTransactionNetworkData', () => {
    it('delegates with all parameters', async () => {
      await service.getTransactionNetworkData(MOCK_USER_ID, 'acc1', 'TENANT_A', '90d');
      expect(transactionSvc.getTransactionNetworkData).toHaveBeenCalledWith('acc1', 'TENANT_A', '90d', MOCK_JWT);
    });

    it('delegates with given parameters', async () => {
      await service.getTransactionNetworkData(MOCK_USER_ID, 'acc1', 'DEFAULT', 'day');
      expect(transactionSvc.getTransactionNetworkData).toHaveBeenCalledWith('acc1', 'DEFAULT', 'day', MOCK_JWT);
    });
  });

  describe('getAccountNetworkData', () => {
    it('delegates with all parameters', async () => {
      await service.getAccountNetworkData(MOCK_USER_ID, 'acc1', 'TENANT_A', 'year');
      expect(accountSvc.getAccountNodeFullData).toHaveBeenCalledWith('acc1', 'TENANT_A', 'year', MOCK_JWT);
    });

    it('defaults tenantId and granularity when omitted', async () => {
      await service.getAccountNetworkData(MOCK_USER_ID, 'acc1');
      expect(accountSvc.getAccountNodeFullData).toHaveBeenCalledWith('acc1', 'DEFAULT', 'month', MOCK_JWT);
    });
  });

  describe('getBenfordByAccount', () => {
    it('delegates to GoldLakehouseService', async () => {
      const result = await service.getBenfordByAccount(MOCK_USER_ID, 'acc1', 'DEFAULT', '2024-01-01', '2024-12-31');
      expect(benfordsSvc.getBenfordAnalysisByAccount).toHaveBeenCalledWith('acc1', 'DEFAULT', '2024-01-01', '2024-12-31', MOCK_JWT);
      expect(result).toEqual({});
    });
  });

  describe('getConditionsContextByTransaction', () => {
    it('delegates with explicit tenantId', async () => {
      await service.getConditionsContextByTransaction(MOCK_USER_ID, 'TMICFBPK2801321903297120', 'TENANT_A', '2024-01-01');
      expect(conditionSvc.getConditionsContextByTransaction).toHaveBeenCalledWith(
        'TMICFBPK2801321903297120',
        'TENANT_A',
        '2024-01-01',
        MOCK_JWT,
      );
    });

    it('omits asOfDate when not provided', async () => {
      await service.getConditionsContextByTransaction(MOCK_USER_ID, 'TMICFBPK2801321903297120', 'DEFAULT');
      expect(conditionSvc.getConditionsContextByTransaction).toHaveBeenCalledWith(
        'TMICFBPK2801321903297120',
        'DEFAULT',
        undefined,
        MOCK_JWT,
      );
    });
  });

  describe('getConditionsSummary', () => {
    it('delegates with explicit tenantId', async () => {
      await service.getConditionsSummary(MOCK_USER_ID, 'acc1', 'TENANT_A', '2024-01-01');
      expect(conditionSvc.getConditionsSummaryByAccount).toHaveBeenCalledWith('acc1', 'TENANT_A', undefined, '2024-01-01', MOCK_JWT);
    });

    it('omits asOfDate when not provided', async () => {
      await service.getConditionsSummary(MOCK_USER_ID, 'acc1', 'DEFAULT');
      expect(conditionSvc.getConditionsSummaryByAccount).toHaveBeenCalledWith('acc1', 'DEFAULT', undefined, undefined, MOCK_JWT);
    });
  });

  describe('getConditionsDetails', () => {
    it('delegates with all parameters', async () => {
      await service.getConditionsDetails(MOCK_USER_ID, 'acc1', 'TENANT_A', '2024-01-01', true);
      expect(conditionSvc.getConditionsListByAccount).toHaveBeenCalledWith('acc1', 'TENANT_A', '2024-01-01', true, MOCK_JWT);
    });

    it('applies defaults when parameters are omitted', async () => {
      await service.getConditionsDetails(MOCK_USER_ID, 'acc1', 'DEFAULT');
      expect(conditionSvc.getConditionsListByAccount).toHaveBeenCalledWith('acc1', 'DEFAULT', undefined, false, MOCK_JWT);
    });
  });

  describe('getConditionsEvaluatedTransactions', () => {
    it('delegates with explicit tenantId', async () => {
      await service.getConditionsEvaluatedTransactions(MOCK_USER_ID, 'acc1', 'TENANT_A', '2024-01-01');
      expect(conditionSvc.getEvaluatedTransactionsByAccount).toHaveBeenCalledWith('acc1', 'TENANT_A', '2024-01-01', MOCK_JWT);
    });

    it('omits fromDate when not provided', async () => {
      await service.getConditionsEvaluatedTransactions(MOCK_USER_ID, 'acc1', 'DEFAULT');
      expect(conditionSvc.getEvaluatedTransactionsByAccount).toHaveBeenCalledWith('acc1', 'DEFAULT', undefined, MOCK_JWT);
    });
  });

  describe('error propagation', () => {
    it('propagates errors from TransactionLakehouseService', async () => {
      transactionSvc.getCounterpartyNetworkData.mockRejectedValue(new Error('network error'));
      await expect(service.getCounterpartyNetworkData(MOCK_USER_ID, 'acc1', 'DEFAULT', '30d')).rejects.toThrow('network error');
    });

    it('propagates errors from AlertsLakehouseService', async () => {
      alertsSvc.getAlertHistorySummary.mockRejectedValue(new Error('summary error'));
      await expect(service.getAlertHistorySummary(MOCK_USER_ID)).rejects.toThrow('summary error');
    });
  });
});
