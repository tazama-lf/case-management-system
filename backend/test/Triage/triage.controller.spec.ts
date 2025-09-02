/* eslint-disable @typescript-eslint/unbound-method */

import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { TriageController } from '../../src/triage/triage.controller';
import { TriageService } from '../../src/triage/triage.service';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { RolesGuard } from '../../src/auth/roles.guard';
import { SubmitAlertDto } from '../../src/triage/dto/submit-alert.dto';
import { UpdateAlertDto } from '../../src/triage/dto/update-alert.dto';
import { CloseAlertDto } from '../../src/triage/dto/close-alert.dto';
import { AlertStatus, AlertType, Priority } from '@prisma/client';

describe('TriageController', () => {
  let controller: TriageController;
  let triageService: jest.Mocked<TriageService>;

  const mockTriageService = {
    handleNewAlert: jest.fn(),
    updateAlertData: jest.fn(),
    manualCloseAlert: jest.fn(),
    investigateAlert: jest.fn(),
    getAlertsForUser: jest.fn(),
    getAlertDetails: jest.fn(),
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
        alert_type: null,
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
      const result = await controller.submitAlert(mockSubmitAlertDto, mockRequest);

      expect(triageService.handleNewAlert).toHaveBeenCalledWith(mockSubmitAlertDto, 'test-user-id', 'test-tenant-id', 'REST API');
      expect(triageService.handleNewAlert).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors during alert submission', async () => {
      const error = new Error('Service error');
      triageService.handleNewAlert.mockRejectedValue(error);

      await expect(controller.submitAlert(mockSubmitAlertDto, mockRequest)).rejects.toThrow('Service error');

      expect(triageService.handleNewAlert).toHaveBeenCalledWith(mockSubmitAlertDto, 'test-user-id', 'test-tenant-id', 'REST API');
    });

    it('should extract user data correctly from request', async () => {
      const expectedResult = {
        alert_id: 'alert-456',
        tenant_id: 'test-tenant-id',
        priority: Priority.LOW,
        alert_type: null,
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
      // triageService.investigateAlert.mockResolvedValue({
      //   ...expectedResult,
      //   case_id: 'case-456',
      // });

      await controller.submitAlert(mockSubmitAlertDto, mockRequest);

      expect(triageService.handleNewAlert).toHaveBeenCalledWith(mockSubmitAlertDto, 'test-user-id', 'test-tenant-id', 'REST API');
    });
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
        tenantId: 'test-tenant-id',
      },
    };

    it('should update alert successfully', async () => {
      const expectedResult = {
        alert_id: 'alert-123',
        tenant_id: 'test-tenant-id',
        priority: Priority.HIGH,
        alert_type: null,
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

      const result = await controller.updateAlert('alert-123', mockUpdateAlertDto, mockRequest);

      expect(triageService.updateAlertData).toHaveBeenCalledWith('alert-123', mockUpdateAlertDto, 'test-user-id', 'test-tenant-id');
      expect(triageService.updateAlertData).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors during alert update', async () => {
      const error = new Error('Update failed');
      triageService.updateAlertData.mockRejectedValue(error);

      await expect(controller.updateAlert('alert-123', mockUpdateAlertDto, mockRequest)).rejects.toThrow('Update failed');

      expect(triageService.updateAlertData).toHaveBeenCalledWith('alert-123', mockUpdateAlertDto, 'test-user-id', 'test-tenant-id');
    });
  });

  describe('closeAlert', () => {
    const mockCloseDto: CloseAlertDto = {
      reason: 'Alert marked as false positive',
    };

    const mockRequest = {
      user: {
        user_id: 'test-user-id',
        tenantId: 'test-tenant-id',
      },
    };

    it('should close alert successfully', async () => {
      const expectedResult = {
        alert_id: 'alert-123',
        tenant_id: 'test-tenant-id',
        priority: Priority.LOW,
        alert_type: null,
        source: 'test-source',
        txtp: null,
        message: 'Test alert message',
        alert_data: { test: 'report data' },
        transaction: { test: 'transaction data' },
        network_map: { test: 'network data' },
        confidence_per: 85,
        alert_status: AlertStatus.CLOSED,
        case_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      triageService.manualCloseAlert.mockResolvedValue(expectedResult);

      const result = await controller.closeAlert('alert-123', mockCloseDto, mockRequest);

      expect(triageService.manualCloseAlert).toHaveBeenCalledWith('alert-123', mockCloseDto, 'test-user-id', 'test-tenant-id');
      expect(triageService.manualCloseAlert).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors during alert closure', async () => {
      const error = new Error('Close failed');
      triageService.manualCloseAlert.mockRejectedValue(error);

      await expect(controller.closeAlert('alert-123', mockCloseDto, mockRequest)).rejects.toThrow('Close failed');

      expect(triageService.manualCloseAlert).toHaveBeenCalledWith('alert-123', mockCloseDto, 'test-user-id', 'test-tenant-id');
    });

    it('should handle different close reasons', async () => {
      const customReasonDto: CloseAlertDto = {
        reason: 'Duplicate alert - already processed',
      };
      const expectedResult = {
        alert_id: 'alert-123',
        tenant_id: 'test-tenant-id',
        priority: Priority.LOW,
        alert_type: null,
        source: 'test-source',
        txtp: null,
        message: 'Test alert message',
        alert_data: { test: 'report data' },
        transaction: { test: 'transaction data' },
        network_map: { test: 'network data' },
        confidence_per: 85,
        alert_status: AlertStatus.CLOSED,
        case_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };
      triageService.manualCloseAlert.mockResolvedValue(expectedResult);

      const result = await controller.closeAlert('alert-123', customReasonDto, mockRequest);

      expect(triageService.manualCloseAlert).toHaveBeenCalledWith('alert-123', customReasonDto, 'test-user-id', 'test-tenant-id');
      expect(result).toEqual(expectedResult);
    });
  });

  describe('getUserAlerts', () => {
    const mockRequest = {
      user: {
        tenantId: 'test-tenant-id',
      },
    };

    it('should get user alerts with default parameters', async () => {
      const expectedResult = {
        data: [
          {
            alert_id: 'alert-1',
            txtp: 'PAYMENT',
            priority: Priority.HIGH,
            confidence_per: 85,
            alert_status: AlertStatus.NEW,
            source: 'REST API',
            alert_type: AlertType.AML,
            created_at: new Date(),
          },
        ],
        page: 1,
        limit: 10,
        total: 1,
        totalPages: 1,
      };
      triageService.getAlertsForUser.mockResolvedValue(expectedResult);

      const result = await controller.getUserAlerts(mockRequest);

      expect(triageService.getAlertsForUser).toHaveBeenCalledWith({
        tenantId: 'test-tenant-id',
        priority: undefined,
        status: undefined,
        type: undefined,
        search: undefined,
        page: 1,
        limit: 10,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });
      expect(result).toEqual(expectedResult);
    });

    it('should get user alerts with custom parameters', async () => {
      const expectedResult = {
        data: [],
        page: 2,
        limit: 5,
        total: 0,
        totalPages: 0,
      };

      triageService.getAlertsForUser.mockResolvedValue(expectedResult);

      const result = await controller.getUserAlerts(
        mockRequest,
        'HIGH',
        'NEW',
        'PAYMENT',
        'AML',
        'test search',
        'REST API',
        2,
        5,
        'priority',
        'asc',
      );

      expect(triageService.getAlertsForUser).toHaveBeenCalledWith({
        tenantId: 'test-tenant-id',
        priority: 'HIGH',
        status: 'NEW',
        type: 'PAYMENT',
        alertType: 'AML',
        search: 'test search',
        source: 'REST API',
        page: 2,
        limit: 5,
        sortBy: 'priority',
        sortOrder: 'asc',
      });
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors', async () => {
      const error = new Error('Failed to fetch alerts');
      triageService.getAlertsForUser.mockRejectedValue(error);

      await expect(controller.getUserAlerts(mockRequest)).rejects.toThrow('Failed to fetch alerts');
    });
  });

  describe('getAlertDetails', () => {
    const mockRequest = {
      user: {
        user_id: 'test-user-id',
        tenantId: 'test-tenant-id',
      },
    };

    it('should get alert details successfully', async () => {
      const expectedResult = {
        alert_id: 'alert-123',
        txtp: 'PAYMENT',
        priority: Priority.HIGH,
        confidence_per: 85,
        alert_status: AlertStatus.NEW,
        created_at: new Date(),
        source: 'test-source',
        message: 'Test alert message',
        alert_data: { test: 'report data' },
        transaction: { test: 'transaction data' },
        network_map: { test: 'network data' },
        case_id: null,
      };

      triageService.getAlertDetails.mockResolvedValue(expectedResult);

      const result = await controller.getAlertDetails('alert-123', mockRequest);

      expect(triageService.getAlertDetails).toHaveBeenCalledWith('alert-123', 'test-tenant-id', 'test-user-id');
      expect(triageService.getAlertDetails).toHaveBeenCalledTimes(1);
      expect(result).toEqual(expectedResult);
    });

    it('should handle service errors', async () => {
      const error = new Error('Alert not found');
      triageService.getAlertDetails.mockRejectedValue(error);

      await expect(controller.getAlertDetails('alert-123', mockRequest)).rejects.toThrow('Alert not found');

      expect(triageService.getAlertDetails).toHaveBeenCalledWith('alert-123', 'test-tenant-id', 'test-user-id');
    });
  });
});
