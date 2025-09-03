/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { TriageController } from '../../src/triage/triage.controller';
import { TriageService } from '../../src/triage/triage.service';

const mockTriageService = {
  handleNewAlert: jest.fn(),
  updateAlertData: jest.fn(),
  manualCloseAlert: jest.fn(),
  getAlertsForUser: jest.fn(),
  getAlertDetails: jest.fn(),
};

describe('TriageController', () => {
  let controller: TriageController;
  let triageService: typeof mockTriageService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TriageController],
      providers: [
        { provide: TriageService, useValue: mockTriageService },
      ],
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
      networkMap: { nodes: [], edges: [] }
    } as any;
    const req = { user: { token: { clientId: 'user1', tenantId: 'tenant1' } } } as any;
    triageService.handleNewAlert.mockResolvedValue('submitted');
    const result = await controller.submitAlert(dto, req);
    expect(triageService.handleNewAlert).toHaveBeenCalledWith(dto, 'user1', 'tenant1', 'REST API');
    expect(result).toBe('submitted');
  });

  it('should update alert', async () => {
    const alertId = 'alert1';
    const dto = { note: 'Test note', confidence_per: 85 } as any;
    const req = { user: { token: { clientId: 'user1', tenantId: 'tenant1' } } } as any;
    triageService.updateAlertData.mockResolvedValue('updated');
    const result = await controller.updateAlert(alertId, dto, req);
    expect(triageService.updateAlertData).toHaveBeenCalledWith(alertId, dto, 'user1', 'tenant1');
    expect(result).toBe('updated');
  });

  it('should close alert', async () => {
    const alertId = 'alert1';
    const dto = { reason: 'Test reason' } as any;
    const req = { user: { token: { clientId: 'user1', tenantId: 'tenant1' } } } as any;
    triageService.manualCloseAlert.mockResolvedValue('closed');
    const result = await controller.closeAlert(alertId, dto, req);
    expect(triageService.manualCloseAlert).toHaveBeenCalledWith(alertId, dto, 'user1', 'tenant1');
    expect(result).toBe('closed');
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
});
