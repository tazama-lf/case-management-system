import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { TriageController } from '../../src/triage/triage.controller';
import { TriageService } from '../../src/triage/triage.service';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { RolesGuard } from '../../src/auth/roles.guard';
import { SubmitAlertDto } from '../../src/triage/dto/submit-alert.dto';
import { UpdateAlertDto } from '../../src/triage/dto/update-alert.dto';
import { AutoCloseAlertDto } from '../../src/triage/dto/auto-close-alert.dto';
import { InvestigateAlertDto } from '../../src/triage/dto/investigate-alert-dto';
import { AlertStatus, Priority, CaseType } from '@prisma/client';

describe('TriageController', () => {
  let controller: TriageController;
  let triageService: jest.Mocked<TriageService>;

  const mockTriageService = {
    handleNewAlert: jest.fn(),
    updateAlertData: jest.fn(),
    manualCloseAlert: jest.fn(),
    investigateAlert: jest.fn(),
  };

  const mockAuditLogService = {
    logAction: jest.fn(),
    logPermissionDenied: jest.fn(),
    getLogs: jest.fn(),
  };

  const mockUser = {
    user_id: 'user-123',
    tenantId: 'tenant-123',
  };

  const mockRequest = {
    user: mockUser,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TriageController],
      providers: [
        {
          provide: TriageService,
          useValue: mockTriageService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: RolesGuard,
          useValue: {
            canActivate: jest.fn().mockReturnValue(true),
          },
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<TriageController>(TriageController);
    triageService = module.get(TriageService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('submitAlert', () => {
    const submitAlertDto: SubmitAlertDto = {
      result: {
        message: 'Test alert',
        report: { test: 'data' },
        transaction: { test: 'transaction' },
        networkMap: { test: 'network' },
        source: 'test-source',
      },
    };

    const mockAlert = {
      alert_id: 'alert-123',
      tenant_id: 'tenant-123',
      priority: Priority.LOW,
      source: 'REST API',
      txtp: '',
      alert_status: AlertStatus.NEW,
      message: 'Test alert',
      confidence_per: 0,
      case_id: null,
      alert_data: { test: 'data' },
      transaction: { test: 'transaction' },
      network_map: { test: 'network' },
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should submit alert and auto-investigate when confidence threshold is invalid', async () => {
      // Mock environment variable to be invalid
      const originalEnv = process.env.CONFIDENCE_THRESHOLD;
      process.env.CONFIDENCE_THRESHOLD = 'invalid';

      const mockCaseAlert = {
        ...mockAlert,
        case_id: 'case-123',
        alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
      };

      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      triageService.investigateAlert.mockResolvedValue(mockCaseAlert);

      const result = await controller.submitAlert(submitAlertDto, mockRequest);

      expect(triageService.handleNewAlert).toHaveBeenCalledWith(
        submitAlertDto,
        mockUser.user_id,
        mockUser.tenantId,
      );
      expect(triageService.investigateAlert).toHaveBeenCalledWith(
        'alert-123',
        CaseType.FRAUD,
        mockUser.user_id,
        mockUser.tenantId,
      );
      expect(result.case_id).toBe('case-123');

      // Restore environment variable
      process.env.CONFIDENCE_THRESHOLD = originalEnv;
    });

    it('should submit alert and auto-investigate when confidence threshold is undefined', async () => {
      // Mock environment variable to be undefined
      const originalEnv = process.env.CONFIDENCE_THRESHOLD;
      delete process.env.CONFIDENCE_THRESHOLD;

      const mockCaseAlert = {
        ...mockAlert,
        case_id: 'case-123',
        alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
      };

      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      triageService.investigateAlert.mockResolvedValue(mockCaseAlert);

      const result = await controller.submitAlert(submitAlertDto, mockRequest);

      expect(triageService.handleNewAlert).toHaveBeenCalledWith(
        submitAlertDto,
        mockUser.user_id,
        mockUser.tenantId,
      );
      expect(triageService.investigateAlert).toHaveBeenCalledWith(
        'alert-123',
        CaseType.FRAUD,
        mockUser.user_id,
        mockUser.tenantId,
      );
      expect(result.case_id).toBe('case-123');

      // Restore environment variable
      process.env.CONFIDENCE_THRESHOLD = originalEnv;
    });

    it('should submit alert and auto-investigate when confidence threshold is null', async () => {
      // Mock environment variable to be undefined (simulating null)
      const originalEnv = process.env.CONFIDENCE_THRESHOLD;
      delete process.env.CONFIDENCE_THRESHOLD;

      const mockCaseAlert = {
        ...mockAlert,
        case_id: 'case-123',
        alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
      };

      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      triageService.investigateAlert.mockResolvedValue(mockCaseAlert);

      const result = await controller.submitAlert(submitAlertDto, mockRequest);

      expect(triageService.investigateAlert).toHaveBeenCalled();
      expect(result.case_id).toBe('case-123');

      // Restore environment variable
      process.env.CONFIDENCE_THRESHOLD = originalEnv;
    });

    it('should submit alert and auto-investigate when confidence threshold is empty string', async () => {
      // Mock environment variable to be empty
      const originalEnv = process.env.CONFIDENCE_THRESHOLD;
      process.env.CONFIDENCE_THRESHOLD = '';

      const mockCaseAlert = {
        ...mockAlert,
        case_id: 'case-123',
        alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
      };

      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      triageService.investigateAlert.mockResolvedValue(mockCaseAlert);

      const result = await controller.submitAlert(submitAlertDto, mockRequest);

      expect(triageService.investigateAlert).toHaveBeenCalled();
      expect(result.case_id).toBe('case-123');

      // Restore environment variable
      process.env.CONFIDENCE_THRESHOLD = originalEnv;
    });

    it('should submit alert and auto-investigate when confidence threshold is whitespace', async () => {
      // Mock environment variable to be whitespace
      const originalEnv = process.env.CONFIDENCE_THRESHOLD;
      process.env.CONFIDENCE_THRESHOLD = '   ';

      const mockCaseAlert = {
        ...mockAlert,
        case_id: 'case-123',
        alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
      };

      triageService.handleNewAlert.mockResolvedValue(mockAlert);
      triageService.investigateAlert.mockResolvedValue(mockCaseAlert);

      const result = await controller.submitAlert(submitAlertDto, mockRequest);

      expect(triageService.investigateAlert).toHaveBeenCalled();
      expect(result.case_id).toBe('case-123');

      // Restore environment variable
      process.env.CONFIDENCE_THRESHOLD = originalEnv;
    });

    it('should only submit alert when confidence threshold is valid', async () => {
      // Mock environment variable to be valid
      const originalEnv = process.env.CONFIDENCE_THRESHOLD;
      process.env.CONFIDENCE_THRESHOLD = '75';

      triageService.handleNewAlert.mockResolvedValue(mockAlert);

      const result = await controller.submitAlert(submitAlertDto, mockRequest);

      expect(triageService.handleNewAlert).toHaveBeenCalledWith(
        submitAlertDto,
        mockUser.user_id,
        mockUser.tenantId,
      );
      expect(triageService.investigateAlert).not.toHaveBeenCalled();
      expect(result).toEqual(mockAlert);

      // Restore environment variable
      process.env.CONFIDENCE_THRESHOLD = originalEnv;
    });
  });

  describe('getTest', () => {
    it('should return status ok', () => {
      const result = controller.getTest();
      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('updateAlert', () => {
    const alertId = 'alert-123';
    const updateDto: UpdateAlertDto = {
      confidence_per: 85,
      priority: Priority.HIGH,
    };

    const mockUpdatedAlert = {
      alert_id: alertId,
      tenant_id: 'tenant-123',
      priority: Priority.HIGH,
      confidence_per: 85,
      source: 'REST API',
      txtp: '',
      alert_status: AlertStatus.NEW,
      message: 'Test alert',
      case_id: null,
      alert_data: { test: 'data' },
      transaction: { test: 'transaction' },
      network_map: { test: 'network' },
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should update alert successfully', async () => {
      triageService.updateAlertData.mockResolvedValue(mockUpdatedAlert);

      const result = await controller.updateAlert(alertId, updateDto, mockRequest);

      expect(triageService.updateAlertData).toHaveBeenCalledWith(
        alertId,
        updateDto,
        mockUser.user_id,
        mockUser.tenantId,
      );
      expect(result).toEqual(mockUpdatedAlert);
    });
  });

  describe('autoCloseAlert', () => {
    const alertId = 'alert-123';
    const autoCloseDto: AutoCloseAlertDto = {
      status: AlertStatus.AUTOCLOSED_CONFIRMED,
    };

    const mockClosedAlert = {
      alert_id: alertId,
      tenant_id: 'tenant-123',
      priority: Priority.LOW,
      source: 'REST API',
      txtp: '',
      alert_status: AlertStatus.AUTOCLOSED_CONFIRMED,
      message: 'Test alert',
      case_id: null,
      alert_data: { test: 'data' },
      transaction: { test: 'transaction' },
      network_map: { test: 'network' },
      confidence_per: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should auto-close alert successfully', async () => {
      triageService.manualCloseAlert.mockResolvedValue(mockClosedAlert);

      const result = await controller.autoCloseAlert(alertId, autoCloseDto, mockRequest);

      expect(triageService.manualCloseAlert).toHaveBeenCalledWith(
        alertId,
        autoCloseDto.status,
        mockUser.user_id,
        mockUser.tenantId,
      );
      expect(result).toEqual(mockClosedAlert);
    });
  });

  describe('sendForInvestigation', () => {
    const alertId = 'alert-123';
    const investigateDto: InvestigateAlertDto = {
      caseType: CaseType.FRAUD,
    };

    const mockInvestigatedAlert = {
      alert_id: alertId,
      tenant_id: 'tenant-123',
      priority: Priority.LOW,
      source: 'REST API',
      txtp: '',
      alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
      message: 'Test alert',
      case_id: 'case-123',
      alert_data: { test: 'data' },
      transaction: { test: 'transaction' },
      network_map: { test: 'network' },
      confidence_per: 0,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should send alert for investigation successfully', async () => {
      triageService.investigateAlert.mockResolvedValue(mockInvestigatedAlert);

      const result = await controller.sendForInvestigation(alertId, investigateDto, mockRequest);

      expect(triageService.investigateAlert).toHaveBeenCalledWith(
        alertId,
        investigateDto.caseType,
        mockUser.user_id,
        mockUser.tenantId,
      );
      expect(result).toEqual(mockInvestigatedAlert);
    });
  });
});
