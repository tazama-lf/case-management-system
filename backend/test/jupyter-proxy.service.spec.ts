import { Test, TestingModule } from '@nestjs/testing';
import { JupyterProxyService } from '../src/modules/jupyter/jupyter-proxy.service';
import { GoldLakehouseService } from '../src/modules/gold-lakehouse/gold-lakehouse.service';

describe('JupyterProxyService', () => {
  let service: JupyterProxyService;
  let svc: jest.Mocked<GoldLakehouseService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JupyterProxyService,
        {
          provide: GoldLakehouseService,
          useValue: {
            getCounterpartyNetworkData: jest.fn().mockResolvedValue({}),
            getCounterpartyNodeFullData: jest.fn().mockResolvedValue({}),
            getAlertHistorySummary: jest.fn().mockResolvedValue({}),
            getTransactionHistoryData: jest.fn().mockResolvedValue({}),
            getAlertHistoryTimeline: jest.fn().mockResolvedValue({}),
            getAlertHistoryAlerts: jest.fn().mockResolvedValue({}),
            getTransactionNetworkData: jest.fn().mockResolvedValue({}),
            getAccountNodeFullData: jest.fn().mockResolvedValue({}),
            getBenfordAnalysisByAccount: jest.fn().mockResolvedValue({}),
            getConditionsContextByTransaction: jest.fn().mockResolvedValue({}),
            getConditionsSummaryByAccount: jest.fn().mockResolvedValue({}),
            getConditionsListByAccount: jest.fn().mockResolvedValue({}),
            getEvaluatedTransactionsByAccount: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<JupyterProxyService>(JupyterProxyService);
    svc = module.get(GoldLakehouseService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getCounterpartyNetworkData', () => {
    it('delegates to GoldLakehouseService', async () => {
      const result = await service.getCounterpartyNetworkData('acc1', 'DEFAULT', '30d');
      expect(svc.getCounterpartyNetworkData).toHaveBeenCalledWith('acc1', 'DEFAULT', '30d');
      expect(result).toEqual({});
    });
  });

  describe('getCounterpartyNodeFullData', () => {
    it('delegates with explicit granularity', async () => {
      await service.getCounterpartyNodeFullData('cp1', 'DEFAULT', 'day');
      expect(svc.getCounterpartyNodeFullData).toHaveBeenCalledWith('cp1', 'DEFAULT', 'day');
    });

    it('defaults granularity to "month" when omitted', async () => {
      await service.getCounterpartyNodeFullData('cp1', 'DEFAULT');
      expect(svc.getCounterpartyNodeFullData).toHaveBeenCalledWith('cp1', 'DEFAULT', 'month');
    });
  });

  describe('getAlertHistorySummary', () => {
    it('delegates with explicit dateRange', async () => {
      const result = await service.getAlertHistorySummary('e2e1', 'DEFAULT', '30days');
      expect(svc.getAlertHistorySummary).toHaveBeenCalledWith('e2e1', 'DEFAULT', '30days');
      expect(result).toEqual({});
    });

    it('defaults dateRange to "all" when omitted', async () => {
      await service.getAlertHistorySummary('e2e1', 'DEFAULT');
      expect(svc.getAlertHistorySummary).toHaveBeenCalledWith('e2e1', 'DEFAULT', 'all');
    });
  });

  describe('getTransactionHistoryData', () => {
    it('delegates with all parameters', async () => {
      await service.getTransactionHistoryData('ent1', 'TENANT_A', '2024-01-01', '2024-12-31', 'day');
      expect(svc.getTransactionHistoryData).toHaveBeenCalledWith('ent1', 'TENANT_A', '2024-01-01', '2024-12-31', 'day');
    });

    it('defaults tenantId to "DEFAULT" when omitted', async () => {
      await service.getTransactionHistoryData('ent1');
      expect(svc.getTransactionHistoryData).toHaveBeenCalledWith('ent1', 'DEFAULT', undefined, undefined, undefined);
    });
  });

  describe('getAlertHistoryTimeline', () => {
    it('delegates with all parameters', async () => {
      await service.getAlertHistoryTimeline('e2e1', 'DEFAULT', '30days', 'month');
      expect(svc.getAlertHistoryTimeline).toHaveBeenCalledWith('e2e1', 'DEFAULT', '30days', 'month');
    });

    it('applies defaults when parameters are omitted', async () => {
      await service.getAlertHistoryTimeline();
      expect(svc.getAlertHistoryTimeline).toHaveBeenCalledWith(undefined, undefined, 'all', 'day');
    });
  });

  describe('getAlertHistoryAlerts', () => {
    it('delegates with all parameters', async () => {
      const result = await service.getAlertHistoryAlerts('e2e1', 'DEFAULT', '30days', 2, 50);
      expect(svc.getAlertHistoryAlerts).toHaveBeenCalledWith('e2e1', 'DEFAULT', '30days', 2, 50);
      expect(result).toEqual({});
    });

    it('applies defaults when parameters are omitted', async () => {
      await service.getAlertHistoryAlerts();
      expect(svc.getAlertHistoryAlerts).toHaveBeenCalledWith(undefined, undefined, 'all', 1, 20);
    });
  });

  describe('getTransactionNetworkData', () => {
    it('delegates with all parameters', async () => {
      await service.getTransactionNetworkData('acc1', 'TENANT_A', '90d');
      expect(svc.getTransactionNetworkData).toHaveBeenCalledWith('acc1', 'TENANT_A', '90d');
    });

    it('defaults tenantId and timeRange when omitted', async () => {
      await service.getTransactionNetworkData('acc1');
      expect(svc.getTransactionNetworkData).toHaveBeenCalledWith('acc1', 'DEFAULT', '30d');
    });
  });

  describe('getAccountNetworkData', () => {
    it('delegates with all parameters', async () => {
      await service.getAccountNetworkData('acc1', 'TENANT_A', 'year');
      expect(svc.getAccountNodeFullData).toHaveBeenCalledWith('acc1', 'TENANT_A', 'year');
    });

    it('defaults tenantId and granularity when omitted', async () => {
      await service.getAccountNetworkData('acc1');
      expect(svc.getAccountNodeFullData).toHaveBeenCalledWith('acc1', 'DEFAULT', 'month');
    });
  });

  describe('getBenfordByAccount', () => {
    it('delegates to GoldLakehouseService', async () => {
      const result = await service.getBenfordByAccount('acc1', 'DEFAULT', '2024-01-01', '2024-12-31');
      expect(svc.getBenfordAnalysisByAccount).toHaveBeenCalledWith('acc1', 'DEFAULT', '2024-01-01', '2024-12-31');
      expect(result).toEqual({});
    });
  });

  describe('getConditionsContextByTransaction', () => {
    it('delegates with explicit tenantId', async () => {
      await service.getConditionsContextByTransaction(1, 'TENANT_A', '2024-01-01');
      expect(svc.getConditionsContextByTransaction).toHaveBeenCalledWith(1, 'TENANT_A', '2024-01-01');
    });

    it('defaults tenantId to "DEFAULT" when omitted', async () => {
      await service.getConditionsContextByTransaction(1);
      expect(svc.getConditionsContextByTransaction).toHaveBeenCalledWith(1, 'DEFAULT', undefined);
    });
  });

  describe('getConditionsSummary', () => {
    it('delegates with explicit tenantId', async () => {
      await service.getConditionsSummary('acc1', 'TENANT_A', '2024-01-01');
      expect(svc.getConditionsSummaryByAccount).toHaveBeenCalledWith('acc1', 'TENANT_A', undefined, '2024-01-01');
    });

    it('defaults tenantId to "DEFAULT" when omitted', async () => {
      await service.getConditionsSummary('acc1');
      expect(svc.getConditionsSummaryByAccount).toHaveBeenCalledWith('acc1', 'DEFAULT', undefined, undefined);
    });
  });

  describe('getConditionsDetails', () => {
    it('delegates with all parameters', async () => {
      await service.getConditionsDetails('acc1', 'TENANT_A', '2024-01-01', true);
      expect(svc.getConditionsListByAccount).toHaveBeenCalledWith('acc1', 'TENANT_A', '2024-01-01', true);
    });

    it('applies defaults when parameters are omitted', async () => {
      await service.getConditionsDetails('acc1');
      expect(svc.getConditionsListByAccount).toHaveBeenCalledWith('acc1', 'DEFAULT', undefined, false);
    });
  });

  describe('getConditionsEvaluatedTransactions', () => {
    it('delegates with explicit tenantId', async () => {
      await service.getConditionsEvaluatedTransactions('acc1', 'TENANT_A', '2024-01-01');
      expect(svc.getEvaluatedTransactionsByAccount).toHaveBeenCalledWith('acc1', 'TENANT_A', '2024-01-01');
    });

    it('defaults tenantId to "DEFAULT" when omitted', async () => {
      await service.getConditionsEvaluatedTransactions('acc1');
      expect(svc.getEvaluatedTransactionsByAccount).toHaveBeenCalledWith('acc1', 'DEFAULT', undefined);
    });
  });

  describe('error propagation', () => {
    it('propagates errors from GoldLakehouseService', async () => {
      svc.getCounterpartyNetworkData.mockRejectedValue(new Error('network error'));
      await expect(service.getCounterpartyNetworkData('acc1', 'DEFAULT', '30d')).rejects.toThrow('network error');
    });

    it('propagates errors from getAlertHistorySummary', async () => {
      svc.getAlertHistorySummary.mockRejectedValue(new Error('summary error'));
      await expect(service.getAlertHistorySummary()).rejects.toThrow('summary error');
    });
  });
});
