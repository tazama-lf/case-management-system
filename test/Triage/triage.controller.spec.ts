import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { TriageController } from '../../src/triage/triage.controller';
import { TriageService } from '../../src/triage/triage.service';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { RolesGuard } from '../../src/auth/roles.guard';
import { SubmitAlertDto } from '../../src/triage/dto/submit-alert.dto';
import { UpdateAlertDto } from '../../src/triage/dto/update-alert.dto';
import { AutoCloseAlertDto } from '../../src/triage/dto/auto-close-alert.dto';
import { AlertStatus, Priority } from '@prisma/client';

describe('TriageController', () => {
  let controller: TriageController;
  let triageService: jest.Mocked<TriageService>;

  const mockTriageService = {
    handleNewAlert: jest.fn(),
    updateAlertData: jest.fn(),
    manualCloseAlert: jest.fn(),
  };

  const mockAuditLogService = {
    log: jest.fn(),
    create: jest.fn(),
  };

  const mockReflector = {
    get: jest.fn(),
    getAllAndOverride: jest.fn(),
    getAllAndMerge: jest.fn(),
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
          provide: Reflector,
          useValue: mockReflector,
        },
        RolesGuard,
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
    const mockSubmitAlertDto: SubmitAlertDto = {
      result: {
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
        transaction: { test: 'transaction' },
        network_map: { test: 'network' },
        confidence_per: 0,
        alert_status: AlertStatus.NEW,
        case_id: null,
      });
      mockTriageService.investigateAlert.mockResolvedValue({
        case_id: 'case-789',
      });

      // Simulate missing/invalid confidence threshold
      const originalEnv = process.env.CONFIDENCE_THRESHOLD;
      process.env.CONFIDENCE_THRESHOLD = '';

      const result = await controller.submitAlert(dto, req);

      expect(consoleSpy).toHaveBeenCalledWith('CASE_WILL_BE_CREATED');
      expect(mockTriageService.handleNewAlert).toHaveBeenCalledWith(
        dto,
        'user-123',
        'tenant-456',
      );
      expect(mockTriageService.investigateAlert).toHaveBeenCalledWith(
        'alert-123',
        expect.anything(), // CaseType.FRAUD
        'user-123',
        'tenant-456',
      );
      expect(result.case_id).toBe('case-789');

      process.env.CONFIDENCE_THRESHOLD = originalEnv;
      consoleSpy.mockRestore();
    });
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
  });

  describe('getTest', () => {
    it('should return test status', () => {
      const result = controller.getTest();
      expect(result).toEqual({ status: 'ok' });
    });
  });

  describe('updateAlert', () => {
    const mockUpdateAlertDto: UpdateAlertDto = {
      confidence_per: 85,
      priority: Priority.HIGH,
    };

    const mockRequest = {
      user: {
        user_id: 'test-user-id',
<<<<<<< HEAD
        tenantId: 'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
      },
    };

    it('should update alert successfully', async () => {
      const expectedResult = {
        alert_id: 'alert-123',
        tenant_id: 'test-tenant-id',
        priority: Priority.HIGH,
        source: 'test-source',
        txtp: null,
        message: 'Test alert message',
        alert_data: { test: 'report data' },
        transaction: { test: 'transaction data' },
        network_map: { test: 'network data' },
        confidence_per: 85,
        alert_status: AlertStatus.NEW,
        case_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      triageService.updateAlertData.mockResolvedValue(expectedResult);

      const result = await controller.updateAlert(
        'alert-123',
        mockUpdateAlertDto,
        mockRequest,
      );

      expect(triageService.updateAlertData).toHaveBeenCalledWith(
        'alert-123',
        mockUpdateAlertDto,
        'test-user-id',
<<<<<<< HEAD
        'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
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
        'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
      );
    });
  });

  describe('autoCloseAlert', () => {
    const mockAutoCloseDto: AutoCloseAlertDto = {
      status: AlertStatus.AUTOCLOSED_CONFIRMED,
    };

    const mockRequest = {
      user: {
        user_id: 'test-user-id',
<<<<<<< HEAD
        tenantId: 'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
      },
    };

    it('should auto-close alert successfully', async () => {
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
        alert_status: AlertStatus.AUTOCLOSED_CONFIRMED,
        case_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      triageService.manualCloseAlert.mockResolvedValue(expectedResult);

      const result = await controller.autoCloseAlert(
        'alert-123',
        mockAutoCloseDto,
        mockRequest,
      );

      expect(triageService.manualCloseAlert).toHaveBeenCalledWith(
        'alert-123',
        AlertStatus.AUTOCLOSED_CONFIRMED,
        'test-user-id',
<<<<<<< HEAD
        'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
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
        'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
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
        'test-tenant-id',
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
      );
      expect(result).toEqual(expectedResult);
    });
  });
<<<<<<< HEAD

  describe('console.log branch coverage', () => {
    it('should log user.role when available', async () => {
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
          role: 'test-role', // role is available
          permissions: 'test-permissions',
        },
      };

      mockTriageService.handleNewAlert.mockResolvedValue({
        alert_id: 'alert-123',
        message: 'Alert created',
      });

      await controller.submitAlert(dto, req);

      expect(consoleSpy).toHaveBeenCalledWith(
        'JWT permissions/roles:',
        'test-role',
      );
      expect(mockTriageService.handleNewAlert).toHaveBeenCalledWith(
        dto,
        'user-123',
        'tenant-456',
      );

      consoleSpy.mockRestore();
    });

    it('should log user.permissions when role is not available', async () => {
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
          role: null, // role is null, should fallback to permissions
          permissions: 'test-permissions',
        },
      };

      mockTriageService.handleNewAlert.mockResolvedValue({
        alert_id: 'alert-123',
        message: 'Alert created',
      });

      await controller.submitAlert(dto, req);

      expect(consoleSpy).toHaveBeenCalledWith(
        'JWT permissions/roles:',
        'test-permissions',
      );
      expect(mockTriageService.handleNewAlert).toHaveBeenCalledWith(
        dto,
        'user-123',
        'tenant-456',
      );

      consoleSpy.mockRestore();
    });

    it('should log user.permissions when role is undefined', async () => {
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
          // role is undefined, should fallback to permissions
          permissions: 'test-permissions',
        },
      };

      mockTriageService.handleNewAlert.mockResolvedValue({
        alert_id: 'alert-123',
        message: 'Alert created',
      });

      await controller.submitAlert(dto, req);

      expect(consoleSpy).toHaveBeenCalledWith(
        'JWT permissions/roles:',
        'test-permissions',
      );
      expect(mockTriageService.handleNewAlert).toHaveBeenCalledWith(
        dto,
        'user-123',
        'tenant-456',
      );

      consoleSpy.mockRestore();
    });

    it('should log user.permissions when role is empty string', async () => {
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
          role: '', // empty string, should fallback to permissions
          permissions: 'test-permissions',
        },
      };

      mockTriageService.handleNewAlert.mockResolvedValue({
        alert_id: 'alert-123',
        message: 'Alert created',
      });

      await controller.submitAlert(dto, req);

      expect(consoleSpy).toHaveBeenCalledWith(
        'JWT permissions/roles:',
        'test-permissions',
      );
      expect(mockTriageService.handleNewAlert).toHaveBeenCalledWith(
        dto,
        'user-123',
        'tenant-456',
      );

      consoleSpy.mockRestore();
    });
  });
=======
>>>>>>> 0d032a5 (feat:Test to Triage Module)
});
