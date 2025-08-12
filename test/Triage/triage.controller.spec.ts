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
<<<<<<< HEAD
        message: 'Test alert message',
        report: { test: 'report data' },
        transaction: { test: 'transaction data' },
        networkMap: { test: 'network data' },
        source: 'test-source',
      },
    };

    const mockRequest = {
      user: {
        user_id: 'test-user-id',
        tenantId: 'test-tenant-id',
        role: 'test-role',
        permissions: ['test-permission'],
      },
    };

    it('should submit alert successfully', async () => {
      const expectedResult = {
        alert_id: 'alert-123',
        tenant_id: 'test-tenant-id',
        priority: Priority.LOW,
        source: 'test-source',
        txtp: null,
        message: 'Test alert message',
        alert_data: { test: 'report data' },
        transaction: { test: 'transaction data' },
        network_map: { test: 'network data' },
        confidence_per: 0,
        alert_status: AlertStatus.NEW,
        case_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      triageService.handleNewAlert.mockResolvedValue(expectedResult);

      const result = await controller.submitAlert(
        mockSubmitAlertDto,
        mockRequest,
      );

      expect(triageService.handleNewAlert).toHaveBeenCalledWith(
        mockSubmitAlertDto,
        'test-user-id',
        'test-tenant-id',
      );
      expect(triageService.handleNewAlert).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors during alert submission', async () => {
      const error = new Error('Service error');
      triageService.handleNewAlert.mockRejectedValue(error);

      await expect(
        controller.submitAlert(mockSubmitAlertDto, mockRequest),
      ).rejects.toThrow('Service error');

      expect(triageService.handleNewAlert).toHaveBeenCalledWith(
        mockSubmitAlertDto,
        'test-user-id',
        'test-tenant-id',
      );
    });

    it('should extract user data correctly from request', async () => {
      const expectedResult = {
        alert_id: 'alert-456',
        tenant_id: 'test-tenant-id',
        priority: Priority.LOW,
        source: 'test-source',
        txtp: null,
        message: 'Test alert message',
        alert_data: { test: 'report data' },
        transaction: { test: 'transaction data' },
        network_map: { test: 'network data' },
        confidence_per: 0,
        alert_status: AlertStatus.NEW,
        case_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      triageService.handleNewAlert.mockResolvedValue(expectedResult);

      await controller.submitAlert(mockSubmitAlertDto, mockRequest);

      expect(triageService.handleNewAlert).toHaveBeenCalledWith(
        mockSubmitAlertDto,
        'test-user-id',
        'test-tenant-id',
      );
    });
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 85c2ac7 (fix:jest.config.js to jest.config.ts)

    it('should log case creation when confidence threshold is missing/invalid', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      const dto: SubmitAlertDto = {
        result: {
          message: 'Test',
          report: { test: 'data' },
          transaction: { test: 'transaction' },
          networkMap: { test: 'network' },
          source: 'test-source',
        },
      };

      const req = {
        user: {
          user_id: 'user-123',
          tenantId: 'tenant-456',
          role: 'test-role',
          permissions: 'test-permissions',
        },
      };

      mockTriageService.handleNewAlert.mockResolvedValue({
        alert_id: 'alert-123',
        tenant_id: 'tenant-456',
        priority: Priority.LOW,
        source: 'test-source',
        txtp: null,
        message: 'Test',
        alert_data: { test: 'data' },
=======
        message: 'Test alert',
        report: { test: 'data' },
>>>>>>> 02dd359 (fix: improve test coverage and fix failing tests)
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
<<<<<<< HEAD
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
=======
>>>>>>> 85c2ac7 (fix:jest.config.js to jest.config.ts)
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

<<<<<<< HEAD
    const mockRequest = {
      user: {
        user_id: 'test-user-id',
<<<<<<< HEAD
<<<<<<< HEAD
        tenantId: 'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
=======
        tenantId: 'test-tenant-id',
>>>>>>> 70c13fd (feat: Authentication Guards Added at Controller Level)
      },
=======
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
>>>>>>> 02dd359 (fix: improve test coverage and fix failing tests)
    };

    it('should update alert successfully', async () => {
      triageService.updateAlertData.mockResolvedValue(mockUpdatedAlert);

      const result = await controller.updateAlert(alertId, updateDto, mockRequest);

      expect(triageService.updateAlertData).toHaveBeenCalledWith(
<<<<<<< HEAD
        'alert-123',
        mockUpdateAlertDto,
        'test-user-id',
<<<<<<< HEAD
<<<<<<< HEAD
        'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
=======
        'test-tenant-id',
>>>>>>> 70c13fd (feat: Authentication Guards Added at Controller Level)
      );
      expect(triageService.updateAlertData).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors during alert update', async () => {
      const error = new Error('Update failed');
      triageService.updateAlertData.mockRejectedValue(error);

      await expect(
        controller.updateAlert('alert-123', mockUpdateAlertDto, mockRequest),
      ).rejects.toThrow('Update failed');

      expect(triageService.updateAlertData).toHaveBeenCalledWith(
        'alert-123',
        mockUpdateAlertDto,
        'test-user-id',
<<<<<<< HEAD
<<<<<<< HEAD
        'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
=======
        'test-tenant-id',
>>>>>>> 70c13fd (feat: Authentication Guards Added at Controller Level)
=======
        alertId,
        updateDto,
        mockUser.user_id,
        mockUser.tenantId,
>>>>>>> 02dd359 (fix: improve test coverage and fix failing tests)
      );
      expect(result).toEqual(mockUpdatedAlert);
    });
  });

  describe('autoCloseAlert', () => {
    const alertId = 'alert-123';
    const autoCloseDto: AutoCloseAlertDto = {
      status: AlertStatus.AUTOCLOSED_CONFIRMED,
    };

<<<<<<< HEAD
    const mockRequest = {
      user: {
        user_id: 'test-user-id',
<<<<<<< HEAD
<<<<<<< HEAD
        tenantId: 'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
=======
        tenantId: 'test-tenant-id',
>>>>>>> 70c13fd (feat: Authentication Guards Added at Controller Level)
      },
=======
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
>>>>>>> 02dd359 (fix: improve test coverage and fix failing tests)
    };

    it('should auto-close alert successfully', async () => {
      triageService.manualCloseAlert.mockResolvedValue(mockClosedAlert);

      const result = await controller.autoCloseAlert(alertId, autoCloseDto, mockRequest);

      expect(triageService.manualCloseAlert).toHaveBeenCalledWith(
<<<<<<< HEAD
        'alert-123',
        AlertStatus.AUTOCLOSED_CONFIRMED,
        'test-user-id',
<<<<<<< HEAD
<<<<<<< HEAD
        'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
=======
        'test-tenant-id',
>>>>>>> 70c13fd (feat: Authentication Guards Added at Controller Level)
      );
      expect(triageService.manualCloseAlert).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors during alert closure', async () => {
      const error = new Error('Close failed');
      triageService.manualCloseAlert.mockRejectedValue(error);

      await expect(
        controller.autoCloseAlert('alert-123', mockAutoCloseDto, mockRequest),
      ).rejects.toThrow('Close failed');

      expect(triageService.manualCloseAlert).toHaveBeenCalledWith(
        'alert-123',
        AlertStatus.AUTOCLOSED_CONFIRMED,
        'test-user-id',
<<<<<<< HEAD
<<<<<<< HEAD
        'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
=======
        'test-tenant-id',
>>>>>>> 70c13fd (feat: Authentication Guards Added at Controller Level)
      );
    });

    it('should handle different alert statuses', async () => {
      const refutedDto: AutoCloseAlertDto = {
        status: AlertStatus.AUTOCLOSED_REFUTED,
      };
      const expectedResult = {
        alert_id: 'alert-123',
        tenant_id: 'test-tenant-id',
        priority: Priority.LOW,
        source: 'test-source',
        txtp: null,
        message: 'Test alert message',
        alert_data: { test: 'report data' },
        transaction: { test: 'transaction data' },
        network_map: { test: 'network data' },
        confidence_per: 85,
        alert_status: AlertStatus.AUTOCLOSED_REFUTED,
        case_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      triageService.manualCloseAlert.mockResolvedValue(expectedResult);

      const result = await controller.autoCloseAlert(
        'alert-123',
        refutedDto,
        mockRequest,
      );

      expect(triageService.manualCloseAlert).toHaveBeenCalledWith(
        'alert-123',
        AlertStatus.AUTOCLOSED_REFUTED,
        'test-user-id',
<<<<<<< HEAD
<<<<<<< HEAD
        'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
=======
        'test-tenant-id',
>>>>>>> 70c13fd (feat: Authentication Guards Added at Controller Level)
      );
      expect(result).toEqual(expectedResult);
=======
        alertId,
        autoCloseDto.status,
        mockUser.user_id,
        mockUser.tenantId,
      );
      expect(result).toEqual(mockClosedAlert);
>>>>>>> 02dd359 (fix: improve test coverage and fix failing tests)
    });
  });
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 2d59734 (feat: Test Coverage for Triage Module)

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
<<<<<<< HEAD
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
=======
>>>>>>> 2d59734 (feat: Test Coverage for Triage Module)
});
