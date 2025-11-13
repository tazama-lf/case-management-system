/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { TriageController } from '../../src/triage/triage.controller';
import { TriageService } from '../../src/triage/triage.service';

const mockTriageService = {
  handleNewAlert: jest.fn(),
  handleManualTriage: jest.fn(),
  getAlertsForUser: jest.fn(),
  getAlertDetails: jest.fn(),
  getAlertActionHistory: jest.fn(),
};

describe('TriageController', () => {
  let controller: TriageController;
  let triageService: typeof mockTriageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TriageController],
      providers: [{ provide: TriageService, useValue: mockTriageService }],
    }).compile();

    controller = module.get<TriageController>(TriageController);
    triageService = mockTriageService;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should submit alert', async () => {
    const dto = {
      message: 'Test alert message',
      report: { evaluationID: 'test', status: 'active', timestamp: new Date(), tadpResult: {} },
      transaction: { TenantId: 'tenant1', TxTp: 'payment' },
      networkMap: { nodes: [], edges: [] },
    } as any;
    const req = { user: { token: { clientId: 'user1', tenantId: 'tenant1' } } } as any;
    triageService.handleNewAlert.mockResolvedValue('submitted');
    const result = await controller.submitAlert(dto, req);
    expect(triageService.handleNewAlert).toHaveBeenCalledWith(dto, 'user1', 'tenant1', 'REST API');
    expect(result).toBe('submitted');
  });

  it('should handle manual triage', async () => {
    const alertId = 'alert1';
    const dto = { action: 'escalate', comment: 'Test comment' } as any;
    const req = { user: { token: { clientId: 'user1', tenantId: 'tenant1' } } } as any;
    triageService.handleManualTriage.mockResolvedValue('triaged');
    const result = await controller.manualTriage(alertId, dto, req);
    expect(triageService.handleManualTriage).toHaveBeenCalledWith(alertId, dto, 'user1', 'tenant1');
    expect(result).toBe('triaged');
  });

  it('should get alert details', async () => {
    const alertId = 'alert1';
    const req = { user: { token: { clientId: 'user1', tenantId: 'tenant1' } } } as any;
    triageService.getAlertDetails.mockResolvedValue({ id: 'alert1', status: 'open' });
    const result = await controller.getAlertDetails(alertId, req);
    expect(triageService.getAlertDetails).toHaveBeenCalledWith(alertId, 'tenant1', 'user1');
    expect(result).toEqual({ id: 'alert1', status: 'open' });
  });

  it('should get user alerts', async () => {
    const req = { user: { token: { tenantId: 'tenant1' } } } as any;
    const query = {
      priority: 'high',
      type: 'type1',
      alertType: 'typeA',
      search: 'search',
      source: 'source',
      page: '2',
      limit: '5',
      sortBy: 'created_at',
      sortOrder: 'asc',
    };
    triageService.getAlertsForUser.mockResolvedValue(['alert1', 'alert2']);
    const result = await controller.getUserAlerts(
      req,
      query.priority,
      query.type,
      query.alertType,
      query.search,
      query.source,
      parseInt(query.page),
      parseInt(query.limit),
      query.sortBy,
      query.sortOrder as 'asc' | 'desc',
    );
    expect(triageService.getAlertsForUser).toHaveBeenCalledWith({
      tenantId: 'tenant1',
      priority: 'high',
      type: 'type1',
      alertType: 'typeA',
      search: 'search',
      source: 'source',
      page: 2,
      limit: 5,
      sortBy: 'created_at',
      sortOrder: 'asc',
    });
    expect(result).toEqual(['alert1', 'alert2']);
  });

  it('should get alert details', async () => {
    const alertId = 'alert1';
    const req = { user: { token: { clientId: 'user1', tenantId: 'tenant1' } } } as any;
    triageService.getAlertDetails.mockResolvedValue('details');
    const result = await controller.getAlertDetails(alertId, req);
    expect(triageService.getAlertDetails).toHaveBeenCalledWith(alertId, 'tenant1', 'user1');
    expect(result).toBe('details');
  });

  it('should get alert action history', async () => {
    const alertId = 'alert1';
    const req = { user: { token: { clientId: 'user1', tenantId: 'tenant1' } } } as any;
    triageService.getAlertActionHistory.mockResolvedValue([{ action: 'created', timestamp: new Date() }]);
    const result = await controller.getAlertActionHistory(alertId, req);
    expect(triageService.getAlertActionHistory).toHaveBeenCalledWith(alertId, 'tenant1', 'user1');
    expect(result).toEqual([{ action: 'created', timestamp: expect.any(Date) }]);
  });
});
