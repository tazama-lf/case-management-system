import { Test, TestingModule } from '@nestjs/testing';
import { JupyterProxyService } from '../src/modules/jupyter/jupyter-proxy.service';
import { GoldLakehouseService } from '../src/modules/gold-lakehouse/gold-lakehouse.service';

describe('JupyterProxyService', () => {
  let service: JupyterProxyService;
  let goldLakehouseService: GoldLakehouseService;

  const mockCounterpartyNetworkResponse: any = {
    accountId: 'acc1',
    accountHolder: 'Account Holder',
    centerCounterparty: {
      counterpartyId: 'cp1',
      counterpartyName: 'Test CP',
      type: 'Business',
      totalTransactions: 100,
      totalValue: 50000,
      flags: { alerted: false, investigated: false },
    },
    counterparties: [],
    edges: [],
    timeRange: '30d',
    tenantId: 'DEFAULT',
    queryTimestamp: '2024-01-01T00:00:00.000Z',
  };

  const mockCounterpartyNodeFullDataResponse = {
    network: {
      rootNodeId: 'cp1',
      nodes: [
        {
          id: 'cp1',
          type: 'COUNTERPARTY' as const,
          label: 'CP 1',
          flags: { alerted: false, investigated: false },
        },
      ],
      edges: [],
    },
    counterpartyDetails: {
      counterpartyId: 'cp1',
      name: 'Test Counterparty',
      type: 'Business',
      transactions: 50,
      totalValue: 25000,
      velocity: 'MEDIUM',
      flags: { alerted: false, investigated: false },
    },
    meta: {
      tenantId: 'DEFAULT',
      granularity: 'month' as const,
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
  };

  const mockAlertHistorySummaryResponse = {
    totalAlerts: 10,
    casesOpened: 5,
    investigations: 3,
    sarFilings: 1,
    totalValue: 100000,
  };

  const mockTransactionHistoryResponse = {
    summary: {
      totalTransactions: 50,
      transactionCount: 50,
      alertsTriggered: 5,
      alertsPercentage: 10,
      investigated: 2,
      investigatedPercentage: 4,
      avgTransactionsPerDay: 1.67,
      durationDays: 30,
      bucketTotalVolume: 25000,
      bucketTotalTransactions: 50,
      expected: { transactionCount: null, volume: null },
      actual: { transactionCount: 50, volume: 25000 },
    },
    timeline: [],
    cumulative: { totalTransactions: 50, totalVolume: 25000, data: [] },
    volumeDistribution: [],
    recentTransactions: [],
    meta: {
      entityId: 'entity1',
      tenantId: 'DEFAULT',
      granularity: null,
      startDate: null,
      endDate: null,
      eventRowCount: 50,
      aggRowCount: 0,
      queryTimestamp: '2024-01-01T00:00:00.000Z',
    },
  };

  const mockAlertHistoryTimelineResponse = {
    alertCountOverTime: [{ date: '2024-01-01', count: 5 }],
    alertValueOverTime: [{ date: '2024-01-01', value: 10000 }],
    meta: {
      endToEndId: 'e2e123',
      tenantId: 'DEFAULT',
      dateRange: 'all',
      granularity: 'day',
    },
  };

  const mockAlertHistoryAlertsResponse: any = {
    alerts: [
      {
        alertId: 1,
        date: '2024-01-01',
        type: 'typology',
        severity: 'High',
        status: 'OPEN',
        caseId: null,
        outcome: 'Pending',
        actions: {
          viewAlertNavigator: '/alert/1',
          viewTransactionDetails: null,
        },
      },
    ],
    pagination: {
      total: 10,
      page: 1,
      limit: 20,
      totalPages: 1,
    },
  };

  const mockTransactionNetworkResponse: any = {
    centerAccount: {
      accountId: 'acc1',
      accountName: 'Test Account',
      totalTransactions: 100,
      totalValue: 50000,
      networkSummary: {
        connectedAccounts: 10,
        totalTransactions: 100,
        totalValue: 50000,
      },
      flags: { alerted: false, investigated: false },
    },
    connectedAccounts: [],
    edges: [],
    timeRange: '30d',
    tenantId: 'DEFAULT',
    queryTimestamp: '2024-01-01T00:00:00.000Z',
  };

  const mockAccountNodeFullDataResponse = {
    network: {
      rootNodeId: 'acc1',
      nodes: [
        {
          id: 'acc1',
          type: 'ACCOUNT' as const,
          label: 'Account 1',
          flags: { alerted: false, investigated: false },
        },
      ],
      edges: [],
    },
    accountDetails: {
      accountId: 'acc1',
      accountHolder: 'Test Holder',
      relationship: 'DEBTOR',
      transactions: 75,
      totalValue: 37500,
      velocity: 'HIGH',
      flags: { alerted: true, investigated: false },
    },
    meta: {
      tenantId: 'DEFAULT',
      granularity: 'month' as const,
      generatedAt: '2024-01-01T00:00:00.000Z',
    },
  };

  const mockBenfordAnalysisResponse = {
    expected: { 1: 0.301, 2: 0.176, 3: 0.125 },
    actual: { 1: 0.3, 2: 0.18, 3: 0.12 },
    sampleSize: 100,
    meta: {
      accountId: 'acc1',
      tenantId: 'DEFAULT',
      fromDate: '2024-01-01',
      toDate: '2024-12-31',
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JupyterProxyService,
        {
          provide: GoldLakehouseService,
          useValue: {
            getCounterpartyNetworkData: jest.fn(),
            getCounterpartyNodeFullData: jest.fn(),
            getAlertHistorySummary: jest.fn(),
            getTransactionHistoryData: jest.fn(),
            getAlertHistoryTimeline: jest.fn(),
            getAlertHistoryAlerts: jest.fn(),
            getTransactionNetworkData: jest.fn(),
            getAccountNodeFullData: jest.fn(),
            getBenfordAnalysisByAccount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<JupyterProxyService>(JupyterProxyService);
    goldLakehouseService = module.get<GoldLakehouseService>(GoldLakehouseService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    it('should be defined', () => {
      expect(service).toBeDefined();
    });

    it('should inject GoldLakehouseService', () => {
      expect(goldLakehouseService).toBeDefined();
    });
  });

  describe('getCounterpartyNetworkData', () => {
    it('should call GoldLakehouseService.getCounterpartyNetworkData with correct parameters', async () => {
      jest.spyOn(goldLakehouseService, 'getCounterpartyNetworkData').mockResolvedValue(mockCounterpartyNetworkResponse);

      const result = await service.getCounterpartyNetworkData('acc1', 'DEFAULT', '30d');

      expect(goldLakehouseService.getCounterpartyNetworkData).toHaveBeenCalledWith('acc1', 'DEFAULT', '30d');
      expect(goldLakehouseService.getCounterpartyNetworkData).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockCounterpartyNetworkResponse);
    });

    it('should pass through different tenantId values', async () => {
      jest.spyOn(goldLakehouseService, 'getCounterpartyNetworkData').mockResolvedValue(mockCounterpartyNetworkResponse);

      await service.getCounterpartyNetworkData('acc2', 'TENANT_A', '90d');

      expect(goldLakehouseService.getCounterpartyNetworkData).toHaveBeenCalledWith('acc2', 'TENANT_A', '90d');
    });

    it('should pass through different timeRange values', async () => {
      jest.spyOn(goldLakehouseService, 'getCounterpartyNetworkData').mockResolvedValue(mockCounterpartyNetworkResponse);

      await service.getCounterpartyNetworkData('acc3', 'DEFAULT', '1year');

      expect(goldLakehouseService.getCounterpartyNetworkData).toHaveBeenCalledWith('acc3', 'DEFAULT', '1year');
    });
  });

  describe('getCounterpartyNodeFullData', () => {
    it('should call GoldLakehouseService.getCounterpartyNodeFullData with correct parameters', async () => {
      jest.spyOn(goldLakehouseService, 'getCounterpartyNodeFullData').mockResolvedValue(mockCounterpartyNodeFullDataResponse);

      const result = await service.getCounterpartyNodeFullData('cp1', 'DEFAULT', 'month');

      expect(goldLakehouseService.getCounterpartyNodeFullData).toHaveBeenCalledWith('cp1', 'DEFAULT', 'month');
      expect(goldLakehouseService.getCounterpartyNodeFullData).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockCounterpartyNodeFullDataResponse);
    });

    it('should use default granularity of "month" when not provided', async () => {
      jest.spyOn(goldLakehouseService, 'getCounterpartyNodeFullData').mockResolvedValue(mockCounterpartyNodeFullDataResponse);

      await service.getCounterpartyNodeFullData('cp2', 'DEFAULT');

      expect(goldLakehouseService.getCounterpartyNodeFullData).toHaveBeenCalledWith('cp2', 'DEFAULT', 'month');
    });

    it('should pass through day granularity', async () => {
      jest.spyOn(goldLakehouseService, 'getCounterpartyNodeFullData').mockResolvedValue(mockCounterpartyNodeFullDataResponse);

      await service.getCounterpartyNodeFullData('cp3', 'TENANT_B', 'day');

      expect(goldLakehouseService.getCounterpartyNodeFullData).toHaveBeenCalledWith('cp3', 'TENANT_B', 'day');
    });

    it('should pass through year granularity', async () => {
      jest.spyOn(goldLakehouseService, 'getCounterpartyNodeFullData').mockResolvedValue(mockCounterpartyNodeFullDataResponse);

      await service.getCounterpartyNodeFullData('cp4', 'DEFAULT', 'year');

      expect(goldLakehouseService.getCounterpartyNodeFullData).toHaveBeenCalledWith('cp4', 'DEFAULT', 'year');
    });
  });

  describe('getAlertHistorySummary', () => {
    it('should call GoldLakehouseService.getAlertHistorySummary with correct parameters', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistorySummary').mockResolvedValue(mockAlertHistorySummaryResponse);

      const result = await service.getAlertHistorySummary('e2e123', 'DEFAULT', '30days');

      expect(goldLakehouseService.getAlertHistorySummary).toHaveBeenCalledWith('e2e123', 'DEFAULT', '30days');
      expect(goldLakehouseService.getAlertHistorySummary).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockAlertHistorySummaryResponse);
    });

    it('should use default dateRange of "all" when not provided', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistorySummary').mockResolvedValue(mockAlertHistorySummaryResponse);

      await service.getAlertHistorySummary('e2e456', 'DEFAULT');

      expect(goldLakehouseService.getAlertHistorySummary).toHaveBeenCalledWith('e2e456', 'DEFAULT', 'all');
    });

    it('should handle undefined endToEndId', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistorySummary').mockResolvedValue(mockAlertHistorySummaryResponse);

      await service.getAlertHistorySummary(undefined, 'DEFAULT', '90days');

      expect(goldLakehouseService.getAlertHistorySummary).toHaveBeenCalledWith(undefined, 'DEFAULT', '90days');
    });

    it('should handle undefined tenantId', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistorySummary').mockResolvedValue(mockAlertHistorySummaryResponse);

      await service.getAlertHistorySummary('e2e789', undefined, '6months');

      expect(goldLakehouseService.getAlertHistorySummary).toHaveBeenCalledWith('e2e789', undefined, '6months');
    });

    it('should pass through different date ranges', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistorySummary').mockResolvedValue(mockAlertHistorySummaryResponse);

      await service.getAlertHistorySummary('e2e999', 'TENANT_C', '1year');

      expect(goldLakehouseService.getAlertHistorySummary).toHaveBeenCalledWith('e2e999', 'TENANT_C', '1year');
    });
  });

  describe('getTransactionHistoryData', () => {
    it('should call GoldLakehouseService.getTransactionHistoryData with all parameters', async () => {
      jest.spyOn(goldLakehouseService, 'getTransactionHistoryData').mockResolvedValue(mockTransactionHistoryResponse);

      const result = await service.getTransactionHistoryData('entity1', 'DEFAULT', '2024-01-01', '2024-01-31', 'day');

      expect(goldLakehouseService.getTransactionHistoryData).toHaveBeenCalledWith('entity1', 'DEFAULT', '2024-01-01', '2024-01-31', 'day');
      expect(goldLakehouseService.getTransactionHistoryData).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockTransactionHistoryResponse);
    });

    it('should use default tenantId of "DEFAULT" when not provided', async () => {
      jest.spyOn(goldLakehouseService, 'getTransactionHistoryData').mockResolvedValue(mockTransactionHistoryResponse);

      await service.getTransactionHistoryData('entity2');

      expect(goldLakehouseService.getTransactionHistoryData).toHaveBeenCalledWith('entity2', 'DEFAULT', undefined, undefined, undefined);
    });

    it('should handle optional parameters', async () => {
      jest.spyOn(goldLakehouseService, 'getTransactionHistoryData').mockResolvedValue(mockTransactionHistoryResponse);

      await service.getTransactionHistoryData('entity3', 'TENANT_D');

      expect(goldLakehouseService.getTransactionHistoryData).toHaveBeenCalledWith('entity3', 'TENANT_D', undefined, undefined, undefined);
    });

    it('should pass through date range without granularity', async () => {
      jest.spyOn(goldLakehouseService, 'getTransactionHistoryData').mockResolvedValue(mockTransactionHistoryResponse);

      await service.getTransactionHistoryData('entity4', 'DEFAULT', '2024-01-01', '2024-12-31');

      expect(goldLakehouseService.getTransactionHistoryData).toHaveBeenCalledWith(
        'entity4',
        'DEFAULT',
        '2024-01-01',
        '2024-12-31',
        undefined,
      );
    });

    it('should pass through granularity without date range', async () => {
      jest.spyOn(goldLakehouseService, 'getTransactionHistoryData').mockResolvedValue(mockTransactionHistoryResponse);

      await service.getTransactionHistoryData('entity5', 'DEFAULT', undefined, undefined, 'month');

      expect(goldLakehouseService.getTransactionHistoryData).toHaveBeenCalledWith('entity5', 'DEFAULT', undefined, undefined, 'month');
    });
  });

  describe('getAlertHistoryTimeline', () => {
    it('should call GoldLakehouseService.getAlertHistoryTimeline with all parameters', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistoryTimeline').mockResolvedValue(mockAlertHistoryTimelineResponse);

      const result = await service.getAlertHistoryTimeline('e2e123', 'DEFAULT', '30days', 'day');

      expect(goldLakehouseService.getAlertHistoryTimeline).toHaveBeenCalledWith('e2e123', 'DEFAULT', '30days', 'day');
      expect(goldLakehouseService.getAlertHistoryTimeline).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockAlertHistoryTimelineResponse);
    });

    it('should use default dateRange of "all" when not provided', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistoryTimeline').mockResolvedValue(mockAlertHistoryTimelineResponse);

      await service.getAlertHistoryTimeline('e2e456', 'DEFAULT', undefined, 'month');

      expect(goldLakehouseService.getAlertHistoryTimeline).toHaveBeenCalledWith('e2e456', 'DEFAULT', 'all', 'month');
    });

    it('should use default granularity of "day" when not provided', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistoryTimeline').mockResolvedValue(mockAlertHistoryTimelineResponse);

      await service.getAlertHistoryTimeline('e2e789', 'TENANT_E', '90days');

      expect(goldLakehouseService.getAlertHistoryTimeline).toHaveBeenCalledWith('e2e789', 'TENANT_E', '90days', 'day');
    });

    it('should handle undefined parameters', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistoryTimeline').mockResolvedValue(mockAlertHistoryTimelineResponse);

      await service.getAlertHistoryTimeline();

      expect(goldLakehouseService.getAlertHistoryTimeline).toHaveBeenCalledWith(undefined, undefined, 'all', 'day');
    });

    it('should pass through year granularity', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistoryTimeline').mockResolvedValue(mockAlertHistoryTimelineResponse);

      await service.getAlertHistoryTimeline('e2e999', 'DEFAULT', '1year', 'year');

      expect(goldLakehouseService.getAlertHistoryTimeline).toHaveBeenCalledWith('e2e999', 'DEFAULT', '1year', 'year');
    });
  });

  describe('getAlertHistoryAlerts', () => {
    it('should call GoldLakehouseService.getAlertHistoryAlerts with all parameters', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistoryAlerts').mockResolvedValue(mockAlertHistoryAlertsResponse);

      const result = await service.getAlertHistoryAlerts('e2e123', 'DEFAULT', '30days', 2, 50);

      expect(goldLakehouseService.getAlertHistoryAlerts).toHaveBeenCalledWith('e2e123', 'DEFAULT', '30days', 2, 50);
      expect(goldLakehouseService.getAlertHistoryAlerts).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockAlertHistoryAlertsResponse);
    });

    it('should use default dateRange of "all" when not provided', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistoryAlerts').mockResolvedValue(mockAlertHistoryAlertsResponse);

      await service.getAlertHistoryAlerts('e2e456', 'DEFAULT', undefined, 1, 20);

      expect(goldLakehouseService.getAlertHistoryAlerts).toHaveBeenCalledWith('e2e456', 'DEFAULT', 'all', 1, 20);
    });

    it('should use default page of 1 when not provided', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistoryAlerts').mockResolvedValue(mockAlertHistoryAlertsResponse);

      await service.getAlertHistoryAlerts('e2e789', 'TENANT_F', '90days');

      expect(goldLakehouseService.getAlertHistoryAlerts).toHaveBeenCalledWith('e2e789', 'TENANT_F', '90days', 1, 20);
    });

    it('should use default limit of 20 when not provided', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistoryAlerts').mockResolvedValue(mockAlertHistoryAlertsResponse);

      await service.getAlertHistoryAlerts('e2e999', 'DEFAULT', '6months', 3);

      expect(goldLakehouseService.getAlertHistoryAlerts).toHaveBeenCalledWith('e2e999', 'DEFAULT', '6months', 3, 20);
    });

    it('should handle undefined parameters with defaults', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistoryAlerts').mockResolvedValue(mockAlertHistoryAlertsResponse);

      await service.getAlertHistoryAlerts();

      expect(goldLakehouseService.getAlertHistoryAlerts).toHaveBeenCalledWith(undefined, undefined, 'all', 1, 20);
    });

    it('should pass custom pagination values', async () => {
      jest.spyOn(goldLakehouseService, 'getAlertHistoryAlerts').mockResolvedValue(mockAlertHistoryAlertsResponse);

      await service.getAlertHistoryAlerts('e2e111', 'DEFAULT', '1year', 5, 100);

      expect(goldLakehouseService.getAlertHistoryAlerts).toHaveBeenCalledWith('e2e111', 'DEFAULT', '1year', 5, 100);
    });
  });

  describe('getTransactionNetworkData', () => {
    it('should call GoldLakehouseService.getTransactionNetworkData with all parameters', async () => {
      jest.spyOn(goldLakehouseService, 'getTransactionNetworkData').mockResolvedValue(mockTransactionNetworkResponse);

      const result = await service.getTransactionNetworkData('acc1', 'DEFAULT', '30d');

      expect(goldLakehouseService.getTransactionNetworkData).toHaveBeenCalledWith('acc1', 'DEFAULT', '30d');
      expect(goldLakehouseService.getTransactionNetworkData).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockTransactionNetworkResponse);
    });

    it('should use default tenantId of "DEFAULT" when not provided', async () => {
      jest.spyOn(goldLakehouseService, 'getTransactionNetworkData').mockResolvedValue(mockTransactionNetworkResponse);

      await service.getTransactionNetworkData('acc2');

      expect(goldLakehouseService.getTransactionNetworkData).toHaveBeenCalledWith('acc2', 'DEFAULT', '30d');
    });

    it('should use default timeRange of "30d" when not provided', async () => {
      jest.spyOn(goldLakehouseService, 'getTransactionNetworkData').mockResolvedValue(mockTransactionNetworkResponse);

      await service.getTransactionNetworkData('acc3', 'TENANT_G');

      expect(goldLakehouseService.getTransactionNetworkData).toHaveBeenCalledWith('acc3', 'TENANT_G', '30d');
    });

    it('should pass through different time ranges', async () => {
      jest.spyOn(goldLakehouseService, 'getTransactionNetworkData').mockResolvedValue(mockTransactionNetworkResponse);

      await service.getTransactionNetworkData('acc4', 'DEFAULT', '90d');

      expect(goldLakehouseService.getTransactionNetworkData).toHaveBeenCalledWith('acc4', 'DEFAULT', '90d');
    });

    it('should handle 1year timeRange', async () => {
      jest.spyOn(goldLakehouseService, 'getTransactionNetworkData').mockResolvedValue(mockTransactionNetworkResponse);

      await service.getTransactionNetworkData('acc5', 'TENANT_H', '1year');

      expect(goldLakehouseService.getTransactionNetworkData).toHaveBeenCalledWith('acc5', 'TENANT_H', '1year');
    });
  });

  describe('getAccountNetworkData', () => {
    it('should call GoldLakehouseService.getAccountNodeFullData with all parameters', async () => {
      jest.spyOn(goldLakehouseService, 'getAccountNodeFullData').mockResolvedValue(mockAccountNodeFullDataResponse);

      const result = await service.getAccountNetworkData('acc1', 'DEFAULT', 'month');

      expect(goldLakehouseService.getAccountNodeFullData).toHaveBeenCalledWith('acc1', 'DEFAULT', 'month');
      expect(goldLakehouseService.getAccountNodeFullData).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockAccountNodeFullDataResponse);
    });

    it('should use default tenantId of "DEFAULT" when not provided', async () => {
      jest.spyOn(goldLakehouseService, 'getAccountNodeFullData').mockResolvedValue(mockAccountNodeFullDataResponse);

      await service.getAccountNetworkData('acc2');

      expect(goldLakehouseService.getAccountNodeFullData).toHaveBeenCalledWith('acc2', 'DEFAULT', 'month');
    });

    it('should use default granularity of "month" when not provided', async () => {
      jest.spyOn(goldLakehouseService, 'getAccountNodeFullData').mockResolvedValue(mockAccountNodeFullDataResponse);

      await service.getAccountNetworkData('acc3', 'TENANT_I');

      expect(goldLakehouseService.getAccountNodeFullData).toHaveBeenCalledWith('acc3', 'TENANT_I', 'month');
    });

    it('should pass through day granularity', async () => {
      jest.spyOn(goldLakehouseService, 'getAccountNodeFullData').mockResolvedValue(mockAccountNodeFullDataResponse);

      await service.getAccountNetworkData('acc4', 'DEFAULT', 'day');

      expect(goldLakehouseService.getAccountNodeFullData).toHaveBeenCalledWith('acc4', 'DEFAULT', 'day');
    });

    it('should pass through year granularity', async () => {
      jest.spyOn(goldLakehouseService, 'getAccountNodeFullData').mockResolvedValue(mockAccountNodeFullDataResponse);

      await service.getAccountNetworkData('acc5', 'TENANT_J', 'year');

      expect(goldLakehouseService.getAccountNodeFullData).toHaveBeenCalledWith('acc5', 'TENANT_J', 'year');
    });
  });

  describe('getBenfordByAccount', () => {
    it('should call GoldLakehouseService.getBenfordAnalysisByAccount with correct parameters', async () => {
      jest.spyOn(goldLakehouseService, 'getBenfordAnalysisByAccount').mockResolvedValue(mockBenfordAnalysisResponse);

      const result = await service.getBenfordByAccount('acc1', 'DEFAULT', '2024-01-01', '2024-12-31');

      expect(goldLakehouseService.getBenfordAnalysisByAccount).toHaveBeenCalledWith('acc1', 'DEFAULT', '2024-01-01', '2024-12-31');
      expect(goldLakehouseService.getBenfordAnalysisByAccount).toHaveBeenCalledTimes(1);
      expect(result).toEqual(mockBenfordAnalysisResponse);
    });

    it('should pass through different account IDs', async () => {
      jest.spyOn(goldLakehouseService, 'getBenfordAnalysisByAccount').mockResolvedValue(mockBenfordAnalysisResponse);

      await service.getBenfordByAccount('acc2', 'TENANT_K', '2023-01-01', '2023-12-31');

      expect(goldLakehouseService.getBenfordAnalysisByAccount).toHaveBeenCalledWith('acc2', 'TENANT_K', '2023-01-01', '2023-12-31');
    });

    it('should pass through different date ranges', async () => {
      jest.spyOn(goldLakehouseService, 'getBenfordAnalysisByAccount').mockResolvedValue(mockBenfordAnalysisResponse);

      await service.getBenfordByAccount('acc3', 'DEFAULT', '2024-06-01', '2024-06-30');

      expect(goldLakehouseService.getBenfordAnalysisByAccount).toHaveBeenCalledWith('acc3', 'DEFAULT', '2024-06-01', '2024-06-30');
    });

    it('should pass through different tenant IDs', async () => {
      jest.spyOn(goldLakehouseService, 'getBenfordAnalysisByAccount').mockResolvedValue(mockBenfordAnalysisResponse);

      await service.getBenfordByAccount('acc4', 'TENANT_L', '2024-01-01', '2024-03-31');

      expect(goldLakehouseService.getBenfordAnalysisByAccount).toHaveBeenCalledWith('acc4', 'TENANT_L', '2024-01-01', '2024-03-31');
    });
  });

  describe('Error Handling', () => {
    it('should propagate errors from getCounterpartyNetworkData', async () => {
      const error = new Error('Network error');
      jest.spyOn(goldLakehouseService, 'getCounterpartyNetworkData').mockRejectedValue(error);

      await expect(service.getCounterpartyNetworkData('acc1', 'DEFAULT', '30d')).rejects.toThrow('Network error');
    });

    it('should propagate errors from getCounterpartyNodeFullData', async () => {
      const error = new Error('Node data error');
      jest.spyOn(goldLakehouseService, 'getCounterpartyNodeFullData').mockRejectedValue(error);

      await expect(service.getCounterpartyNodeFullData('cp1', 'DEFAULT', 'month')).rejects.toThrow('Node data error');
    });

    it('should propagate errors from getAlertHistorySummary', async () => {
      const error = new Error('Summary error');
      jest.spyOn(goldLakehouseService, 'getAlertHistorySummary').mockRejectedValue(error);

      await expect(service.getAlertHistorySummary('e2e123', 'DEFAULT', '30days')).rejects.toThrow('Summary error');
    });

    it('should propagate errors from getTransactionHistoryData', async () => {
      const error = new Error('Transaction history error');
      jest.spyOn(goldLakehouseService, 'getTransactionHistoryData').mockRejectedValue(error);

      await expect(service.getTransactionHistoryData('entity1', 'DEFAULT')).rejects.toThrow('Transaction history error');
    });

    it('should propagate errors from getAlertHistoryTimeline', async () => {
      const error = new Error('Timeline error');
      jest.spyOn(goldLakehouseService, 'getAlertHistoryTimeline').mockRejectedValue(error);

      await expect(service.getAlertHistoryTimeline('e2e123', 'DEFAULT', '30days', 'day')).rejects.toThrow('Timeline error');
    });

    it('should propagate errors from getAlertHistoryAlerts', async () => {
      const error = new Error('Alerts error');
      jest.spyOn(goldLakehouseService, 'getAlertHistoryAlerts').mockRejectedValue(error);

      await expect(service.getAlertHistoryAlerts('e2e123', 'DEFAULT', '30days', 1, 20)).rejects.toThrow('Alerts error');
    });

    it('should propagate errors from getTransactionNetworkData', async () => {
      const error = new Error('Transaction network error');
      jest.spyOn(goldLakehouseService, 'getTransactionNetworkData').mockRejectedValue(error);

      await expect(service.getTransactionNetworkData('acc1', 'DEFAULT', '30d')).rejects.toThrow('Transaction network error');
    });

    it('should propagate errors from getAccountNetworkData', async () => {
      const error = new Error('Account network error');
      jest.spyOn(goldLakehouseService, 'getAccountNodeFullData').mockRejectedValue(error);

      await expect(service.getAccountNetworkData('acc1', 'DEFAULT', 'month')).rejects.toThrow('Account network error');
    });

    it('should propagate errors from getBenfordByAccount', async () => {
      const error = new Error('Benford analysis error');
      jest.spyOn(goldLakehouseService, 'getBenfordAnalysisByAccount').mockRejectedValue(error);

      await expect(service.getBenfordByAccount('acc1', 'DEFAULT', '2024-01-01', '2024-12-31')).rejects.toThrow('Benford analysis error');
    });
  });
});
