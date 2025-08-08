/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { TriageService } from '../../src/triage/triage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { SubmitAlertDto } from '../../src/triage/dto/submit-alert.dto';

import {
  AlertStatus,
  Priority,
  CaseType,
  CaseStatus,
  CaseCreationType,
} from '@prisma/client';

import {
  Logger,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { UpdateAlertDto } from 'src/triage/dto/update-alert.dto';
import { ConvertAlertToCase } from 'src/triage/dto/convert-alert-to-case.dto';
// Suppress Logger.error output during tests
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

// Create a deep mock for PrismaService
const createMockPrismaService = () => ({
  alert: {
    create: jest.fn(),
    findUnique: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    // Add any other methods used in TriageService here
  },
  case: {
    create: jest.fn(),
  },
  // Add other Prisma models if needed
});

describe('TriageService', () => {
  let service: TriageService;
  let prismaService: any;
  let auditService: any;

  beforeEach(async () => {
    const mockPrismaService = createMockPrismaService();
    const mockAuditService = {
      logAction: jest.fn().mockResolvedValue({
        audit_log_id: 'audit-123',
        user_id: 'user-123',
        operation: 'TEST',
        entity_name: 'Test',
        action_performed: 'Test action',
        outcome: 'SUCCESS',
        performed_at: new Date(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TriageService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<TriageService>(TriageService);
    prismaService = module.get(PrismaService);
    auditService = module.get(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleNewAlert', () => {
    const mockSubmitAlertDto: SubmitAlertDto = {
      result: {
        message: 'Test alert message',
        report: { test: 'report data' },
        transaction: { test: 'transaction data' },
        networkMap: { test: 'network data' },
        source: 'test-source',
      },
    };

    const userId = 'test-user-id';
    const tenantId = 'test-tenant-id';

    it('should create new alert successfully', async () => {
      const expectedAlert = {
        alert_id: 'alert-123',
        tenant_id: tenantId,
        priority: Priority.LOW,
        source: 'test-source',
        txtp: '',
        alert_status: AlertStatus.NEW,
        message: 'Test alert message',
        alert_data: mockSubmitAlertDto.result.report,
        transaction: mockSubmitAlertDto.result.transaction,
        network_map: mockSubmitAlertDto.result.networkMap,
        confidence_per: 0,
        case_id: null,
        created_at: new Date(),
        updated_at: new Date(),
      };

      prismaService.alert.create.mockResolvedValue(expectedAlert);

      const result = await service.handleNewAlert(
        mockSubmitAlertDto,
        userId,
        tenantId,
      );

      expect(prismaService.alert.create).toHaveBeenCalled();
      expect(auditService.logAction).toHaveBeenCalled();
      expect(result).toEqual(expectedAlert);
    });
  });

  describe('updateAlertData', () => {
    const alertId = 'alert-123';
    const userId = 'test-user-id';
    const mockUpdateDto: UpdateAlertDto = {
      confidence_per: 85,
      priority: Priority.HIGH,
    };

    const mockExistingAlert = {
      alert_id: alertId,
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

    it('should update alert successfully', async () => {
      const updatedAlert = {
        ...mockExistingAlert,
        confidence_per: 85,
        priority: Priority.HIGH,
      };

      prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
      prismaService.alert.update.mockResolvedValue(updatedAlert);

      const result = await service.updateAlertData(
        alertId,
        mockUpdateDto,
        userId,
        'test-tenant-id',
      );

      expect(prismaService.alert.findUnique).toHaveBeenCalled();
      expect(prismaService.alert.update).toHaveBeenCalled();
      expect(auditService.logAction).toHaveBeenCalled();
      expect(result).toEqual(updatedAlert);
    });

    it('should throw NotFoundException when alert not found', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAlertData(alertId, mockUpdateDto, userId, 'tenant-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when alert not accessible for tenant', async () => {
      const alertWithDifferentTenant = {
        ...mockExistingAlert,
        tenant_id: 'different-tenant-id',
      };

      prismaService.alert.findUnique.mockResolvedValue(
        alertWithDifferentTenant,
      );

      await expect(
        service.updateAlertData(alertId, mockUpdateDto, userId, 'tenant-123'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when alert is closed', async () => {
      const closedAlert = {
        ...mockExistingAlert,
        alert_status: AlertStatus.CLOSED,
      };

      prismaService.alert.findUnique.mockResolvedValue(closedAlert);

      await expect(
        service.updateAlertData(
          alertId,
          mockUpdateDto,
          userId,
          'test-tenant-id',
        ),
      ).rejects.toThrow(
        'Alert alert-123 is closed status and can not be updated',
      );
    });

    it('should handle database errors during update operation', async () => {
      prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
      prismaService.alert.update.mockRejectedValue(new Error('Database error'));

      await expect(
        service.updateAlertData(
          alertId,
          mockUpdateDto,
          userId,
          'test-tenant-id',
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('manualCloseAlert', () => {
    const alertId = 'alert-123';
    const userId = 'test-user-id';
    const closeAlertDto = { reason: 'Alert marked as false positive' };

    const mockExistingAlert = {
      alert_id: alertId,
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

    it('should close alert successfully', async () => {
      const closedAlert = {
        ...mockExistingAlert,
        alert_status: AlertStatus.CLOSED,
      };

      prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
      prismaService.alert.update.mockResolvedValue(closedAlert);

      const result = await service.manualCloseAlert(
        alertId,
        closeAlertDto,
        userId,
        'test-tenant-id',
      );

      expect(prismaService.alert.findUnique).toHaveBeenCalled();
      expect(prismaService.alert.update).toHaveBeenCalled();
      expect(auditService.logAction).toHaveBeenCalled();
      expect(result).toEqual(closedAlert);
    });

    it('should throw NotFoundException when alert not found', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.manualCloseAlert(
          alertId,
          closeAlertDto,
          userId,
          'test-tenant-id',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when alert not accessible for tenant', async () => {
      const alertWithDifferentTenant = {
        ...mockExistingAlert,
        tenant_id: 'different-tenant-id',
      };

      prismaService.alert.findUnique.mockResolvedValue(
        alertWithDifferentTenant,
      );

      await expect(
        service.manualCloseAlert(
          alertId,
          closeAlertDto,
          userId,
          'test-tenant-id',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when alert is already closed', async () => {
      const closedAlert = {
        ...mockExistingAlert,
        alert_status: AlertStatus.CLOSED,
      };

      prismaService.alert.findUnique.mockResolvedValue(closedAlert);

      await expect(
        service.manualCloseAlert(
          alertId,
          closeAlertDto,
          userId,
          'test-tenant-id',
        ),
      ).rejects.toThrow('Alert alert-123 is already closed');
    });

    it('should handle database errors during close operation', async () => {
      prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
      prismaService.alert.update.mockRejectedValue(new Error('Database error'));

      await expect(
        service.manualCloseAlert(
          alertId,
          closeAlertDto,
          userId,
          'test-tenant-id',
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('source extraction coverage', () => {
    it('should extract source from result.source', async () => {
      const dto: SubmitAlertDto = {
        result: {
          message: 'Test alert',
          report: { test: 'data' },
          transaction: { test: 'transaction' },
          networkMap: { test: 'network' },
          source: 'direct-source',
        },
      };

      const mockAlert = {
        alert_id: 'alert-123',
        tenant_id: 'tenant-123',
        priority: Priority.LOW,
        source: 'direct-source',
        txtp: '',
        alert_status: AlertStatus.NEW,
        message: 'Test alert',
      };

      prismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.handleNewAlert(
        dto,
        'user-123',
        'tenant-123',
      );

      expect(prismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'REST API',
        }),
      });
      expect(result).toEqual(mockAlert);
    });

    it('should extract source from result.report.source when result.source is not available', async () => {
      const dto: SubmitAlertDto = {
        result: {
          message: 'Test alert',
          report: { source: 'report-source' },
          transaction: { test: 'transaction' },
          networkMap: { test: 'network' },
          source: '', // empty string, should fallback to report
        },
      };

      const mockAlert = {
        alert_id: 'alert-123',
        tenant_id: 'tenant-123',
        priority: Priority.LOW,
        source: 'report-source',
        txtp: '',
        alert_status: AlertStatus.NEW,
        message: 'Test alert',
      };

      prismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.handleNewAlert(
        dto,
        'user-123',
        'tenant-123',
      );

      expect(prismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'REST API',
        }),
      });
      expect(result).toEqual(mockAlert);
    });

    it('should use default empty source when neither result.source nor result.report.source are available', async () => {
      const dto: SubmitAlertDto = {
        result: {
          message: 'Test alert',
          report: { test: 'data' }, // no source property
          transaction: { test: 'transaction' },
          networkMap: { test: 'network' },
          source: '', // empty source
        },
      };

      const mockAlert = {
        alert_id: 'alert-123',
        tenant_id: 'tenant-123',
        priority: Priority.LOW,
        source: '',
        txtp: '',
        alert_status: AlertStatus.NEW,
        message: 'Test alert',
      };

      prismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.handleNewAlert(
        dto,
        'user-123',
        'tenant-123',
      );

      expect(prismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          source: 'REST API',
        }),
      });
      expect(result).toEqual(mockAlert);
    });
  });

  describe('txtp extraction coverage', () => {
    it('should extract txtp from result.report.txtp', async () => {
      const dto: SubmitAlertDto = {
        result: {
          message: 'Test alert',
          report: { txtp: 'report-txtp' },
          transaction: { test: 'transaction' },
          networkMap: { test: 'network' },
          source: 'test-source',
        },
      };

      const mockAlert = {
        alert_id: 'alert-123',
        tenant_id: 'tenant-123',
        priority: Priority.LOW,
        source: 'test-source',
        txtp: 'report-txtp',
        alert_status: AlertStatus.NEW,
        message: 'Test alert',
      };

      prismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.handleNewAlert(
        dto,
        'user-123',
        'tenant-123',
      );

      expect(prismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          txtp: '',
        }),
      });
      expect(result).toEqual(mockAlert);
    });

    it('should extract txtp from result.transaction.TxTp', async () => {
      const dto: SubmitAlertDto = {
        result: {
          message: 'Test alert',
          report: { test: 'data' },
          transaction: { TxTp: 'transaction-txtp' },
          networkMap: { test: 'network' },
          source: 'test-source',
        },
      };

      const mockAlert = {
        alert_id: 'alert-123',
        tenant_id: 'tenant-123',
        priority: Priority.LOW,
        source: 'test-source',
        txtp: 'transaction-txtp',
        alert_status: AlertStatus.NEW,
        message: 'Test alert',
      };

      prismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.handleNewAlert(
        dto,
        'user-123',
        'tenant-123',
      );

      expect(prismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          txtp: 'transaction-txtp',
        }),
      });
      expect(result).toEqual(mockAlert);
    });

    it('should extract txtp from result.networkMap.txtp', async () => {
      const dto: SubmitAlertDto = {
        result: {
          message: 'Test alert',
          report: { test: 'data' },
          transaction: { test: 'transaction' },
          networkMap: { txtp: 'network-txtp' },
          source: 'test-source',
        },
      };

      const mockAlert = {
        alert_id: 'alert-123',
        tenant_id: 'tenant-123',
        priority: Priority.LOW,
        source: 'test-source',
        txtp: 'network-txtp',
        alert_status: AlertStatus.NEW,
        message: 'Test alert',
      };

      prismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.handleNewAlert(
        dto,
        'user-123',
        'tenant-123',
      );

      expect(prismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          txtp: '',
        }),
      });
      expect(result).toEqual(mockAlert);
    });
  });

  describe('error handling coverage', () => {
    it('should handle database errors in handleNewAlert', async () => {
      const dto: SubmitAlertDto = {
        result: {
          message: 'Test alert',
          report: { test: 'data' },
          transaction: { test: 'transaction' },
          networkMap: { test: 'network' },
          source: 'test-source',
        },
      };

      prismaService.alert.create.mockRejectedValue(new Error('Database error'));

      await expect(
        service.handleNewAlert(dto, 'user-123', 'tenant-123'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle database errors in manualCloseAlert', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.manualCloseAlert(
          'alert-123',
          { reason: 'Test close reason' },
          'user-123',
          'tenant-123',
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('investigateAlert', () => {
    const alertId = 'alert-123';
    const userId = 'test-user-id';
    const tenantId = 'test-tenant-id';
    const caseType = CaseType.FRAUD;

    const mockExistingAlert = {
      alert_id: alertId,
      tenant_id: tenantId,
      priority: Priority.HIGH,
      source: 'test-source',
      txtp: null,
      message: 'Test alert message',
      alert_data: { test: 'report data' },
      transaction: { test: 'transaction data' },
      network_map: { test: 'network data' },
      confidence_per: 80,
      alert_status: AlertStatus.NEW,
      case_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should create case and update alert for investigation successfully', async () => {
      const mockCase = {
        case_id: 'case-123',
        case_creator_user_id: userId,
        case_owner_user_id: userId,
        tenant_id: tenantId,
        priority: Priority.HIGH,
        status: CaseStatus.DRAFT,
        parent_id: null,
        case_type: caseType,
        case_creation_type: CaseCreationType.MANUAL,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedAlert = {
        ...mockExistingAlert,
        alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
        case_id: mockCase.case_id,
      };

      prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
      prismaService.case.create.mockResolvedValue(mockCase);
      prismaService.alert.update.mockResolvedValue(updatedAlert);

      const result = await service.investigateAlert(
        alertId,
        caseType,
        userId,
        tenantId,
      );

      expect(prismaService.alert.findUnique).toHaveBeenCalledWith({
        where: { alert_id: alertId },
      });
      expect(prismaService.case.create).toHaveBeenCalledWith({
        data: {
          case_creator_user_id: userId,
          case_owner_user_id: userId,
          tenant_id: tenantId,
          priority: Priority.HIGH,
          status: CaseStatus.DRAFT,
          parent_id: null,
          case_type: caseType,
          case_creation_type: CaseCreationType.MANUAL,
        },
      });
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: alertId },
        data: {
          alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
          case_id: mockCase.case_id,
        },
      });
      expect(auditService.logAction).toHaveBeenCalled();
      expect(result).toEqual(updatedAlert);
    });

    it('should throw NotFoundException when alert not found', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.investigateAlert(alertId, caseType, userId, tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when alert not accessible for tenant', async () => {
      const alertWithDifferentTenant = {
        ...mockExistingAlert,
        tenant_id: 'different-tenant-id',
      };

      prismaService.alert.findUnique.mockResolvedValue(
        alertWithDifferentTenant,
      );

      await expect(
        service.investigateAlert(alertId, caseType, userId, tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should use LOW priority as default when alert priority is null', async () => {
      const alertWithNullPriority = {
        ...mockExistingAlert,
        priority: null,
      };

      const mockCase = {
        case_id: 'case-123',
        case_creator_user_id: userId,
        case_owner_user_id: userId,
        tenant_id: tenantId,
        priority: Priority.LOW,
        status: CaseStatus.DRAFT,
        parent_id: null,
        case_type: caseType,
        case_creation_type: CaseCreationType.MANUAL,
      };

      const updatedAlert = {
        ...alertWithNullPriority,
        alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
        case_id: mockCase.case_id,
      };

      prismaService.alert.findUnique.mockResolvedValue(alertWithNullPriority);
      prismaService.case.create.mockResolvedValue(mockCase);
      prismaService.alert.update.mockResolvedValue(updatedAlert);

      await service.investigateAlert(alertId, caseType, userId, tenantId);

      expect(prismaService.case.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: Priority.LOW,
        }),
      });
    });

    it('should handle database errors during investigation', async () => {
      prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
      prismaService.case.create.mockRejectedValue(new Error('Database error'));

      await expect(
        service.investigateAlert(alertId, caseType, userId, tenantId),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getAlertsForUser', () => {
    const mockParams = {
      tenantId: 'test-tenant-id',
      page: 1,
      limit: 10,
      sortBy: 'created_at',
      sortOrder: 'desc' as const,
    };

    const mockAlerts = [
      {
        alert_id: 'alert-1',
        txtp: 'PAYMENT',
        priority: Priority.HIGH,
        confidence_per: 85,
        alert_status: AlertStatus.NEW,
        created_at: new Date(),
      },
      {
        alert_id: 'alert-2',
        txtp: 'TRANSFER',
        priority: Priority.LOW,
        confidence_per: 45,
        alert_status: AlertStatus.CLOSED,
        created_at: new Date(),
      },
    ];

    it('should return paginated alerts successfully', async () => {
      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(2);

      const result = await service.getAlertsForUser(mockParams);

      expect(prismaService.alert.findMany).toHaveBeenCalled();
      expect(prismaService.alert.count).toHaveBeenCalled();
      expect(result).toEqual({
        data: mockAlerts,
        page: 1,
        limit: 10,
        total: 2,
        totalPages: 1,
      });
    });

    it('should throw BadRequestException for invalid page', async () => {
      const invalidParams = { ...mockParams, page: 0 };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow(
        'Page must be a positive integer',
      );
    });

    it('should throw BadRequestException for invalid limit', async () => {
      const invalidParams = { ...mockParams, limit: -1 };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow(
        'Limit must be a positive integer',
      );
    });

    it('should throw BadRequestException for invalid sortBy field', async () => {
      const invalidParams = { ...mockParams, sortBy: 'invalid_field' };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow(
        'Invalid sortBy field: invalid_field',
      );
    });

    it('should throw BadRequestException for invalid sortOrder', async () => {
      const invalidParams = { ...mockParams, sortOrder: 'invalid' as any };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow(
        'sortOrder must be "asc" or "desc"',
      );
    });

    it('should throw BadRequestException for invalid priority', async () => {
      const invalidParams = { ...mockParams, priority: 'INVALID_PRIORITY' };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow(
        'Invalid priority: INVALID_PRIORITY',
      );
    });

    it('should throw BadRequestException for invalid status', async () => {
      const invalidParams = { ...mockParams, status: 'INVALID_STATUS' };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow(
        'Invalid status: INVALID_STATUS',
      );
    });

    it('should handle search with UUID (36 characters)', async () => {
      const searchParams = {
        ...mockParams,
        search: '123e4567-e89b-12d3-a456-426614174000',
      };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(searchParams);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { alert_id: { equals: '123e4567-e89b-12d3-a456-426614174000' } },
              { case_id: { equals: '123e4567-e89b-12d3-a456-426614174000' } },
            ]),
          }),
        }),
      );
    });

    it('should handle search with priority match', async () => {
      const searchParams = { ...mockParams, search: 'HIGH' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(searchParams);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { priority: { equals: Priority.HIGH } },
            ]),
          }),
        }),
      );
    });

    it('should handle search with status match', async () => {
      const searchParams = { ...mockParams, search: 'CLOSED' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(searchParams);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { alert_status: { equals: AlertStatus.CLOSED } },
            ]),
          }),
        }),
      );
    });

    it('should handle search with general text (txtp contains)', async () => {
      const searchParams = { ...mockParams, search: 'payment' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(searchParams);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { txtp: { contains: 'payment', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should handle database errors', async () => {
      prismaService.alert.findMany.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(service.getAlertsForUser(mockParams)).rejects.toThrow(
        InternalServerErrorException,
      );
    });

    it('should filter alerts by priority when provided', async () => {
      const paramsWithPriority = { ...mockParams, priority: 'HIGH' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(paramsWithPriority);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: Priority.HIGH,
          }),
        }),
      );
    });

    it('should filter alerts by status when provided', async () => {
      const paramsWithStatus = { ...mockParams, status: 'NEW' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(paramsWithStatus);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            alert_status: AlertStatus.NEW,
          }),
        }),
      );
    });

    it('should filter alerts by type when provided', async () => {
      const paramsWithType = { ...mockParams, type: 'PAYMENT' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(paramsWithType);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            txtp: 'PAYMENT',
          }),
        }),
      );
    });

    it('should handle database errors', async () => {});
  });

  describe('getAlertDetails', () => {
    const alertId = 'alert-123';
    const tenantId = 'test-tenant-id';
    const userId = 'test-user-id';

    const mockAlert = {
      alert_id: alertId,
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
      tenant_id: tenantId,
    };

    it('should return alert details successfully', async () => {
      const loggerSpy = jest
        .spyOn(service['logger'], 'log')
        .mockImplementation();

      prismaService.alert.findUnique.mockResolvedValue(mockAlert);

      const result = await service.getAlertDetails(alertId, tenantId, userId);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tenant_id, ...expectedResult } = mockAlert;
      expect(result).toEqual(expectedResult);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Alert ${alertId} opened by user ${userId}`),
      );

      loggerSpy.mockRestore();
    });

    it('should throw NotFoundException when alert not found', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.getAlertDetails(alertId, tenantId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when alert not accessible for tenant', async () => {
      const alertWithDifferentTenant = {
        ...mockAlert,
        tenant_id: 'different-tenant-id',
      };

      prismaService.alert.findUnique.mockResolvedValue(
        alertWithDifferentTenant,
      );

      await expect(
        service.getAlertDetails(alertId, tenantId, userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle database errors', async () => {
      prismaService.alert.findUnique.mockRejectedValue(
        new Error('Database error'),
      );

      await expect(
        service.getAlertDetails(alertId, tenantId, userId),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('convertToCase', () => {
    const alertId = 'alert-123';
    const userId = 'test-user-id';
    const tenantId = 'test-tenant-id';
    const convertDto: ConvertAlertToCase = {
      priority: Priority.HIGH,
      caseType: CaseType.FRAUD,
    };

    const mockExistingAlert = {
      alert_id: alertId,
      tenant_id: tenantId,
      priority: Priority.LOW,
      source: 'test-source',
      txtp: null,
      message: 'Test alert message',
      alert_data: { test: 'report data' },
      transaction: { test: 'transaction data' },
      network_map: { test: 'network data' },
      confidence_per: 80,
      alert_status: AlertStatus.NEW,
      case_id: null,
      created_at: new Date(),
      updated_at: new Date(),
    };

    it('should convert alert to case successfully', async () => {
      const mockCase = {
        case_id: 'case-123',
        case_creator_user_id: userId,
        case_owner_user_id: userId,
        tenant_id: tenantId,
        priority: Priority.HIGH,
        status: CaseStatus.DRAFT,
        parent_id: null,
        case_type: CaseType.FRAUD,
        case_creation_type: CaseCreationType.MANUAL,
        created_at: new Date(),
        updated_at: new Date(),
      };

      const updatedAlert = {
        ...mockExistingAlert,
        alert_status: AlertStatus.CONVERTED,
        case_id: mockCase.case_id,
      };

      prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
      prismaService.case.create.mockResolvedValue(mockCase);
      prismaService.alert.update.mockResolvedValue(updatedAlert);

      const result = await service.convertToCase(
        alertId,
        convertDto,
        userId,
        tenantId,
      );

      expect(prismaService.alert.findUnique).toHaveBeenCalledWith({
        where: { alert_id: alertId },
      });
      expect(prismaService.case.create).toHaveBeenCalledWith({
        data: {
          case_creator_user_id: userId,
          case_owner_user_id: userId,
          tenant_id: tenantId,
          priority: Priority.HIGH,
          status: CaseStatus.DRAFT,
          parent_id: null,
          case_type: CaseType.FRAUD,
          case_creation_type: CaseCreationType.MANUAL,
        },
      });
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: alertId },
        data: {
          alert_status: AlertStatus.CONVERTED,
          case_id: mockCase.case_id,
        },
      });
      expect(auditService.logAction).toHaveBeenCalled();
      expect(result).toEqual(mockCase);
    });

    it('should throw NotFoundException when alert not found', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.convertToCase(alertId, convertDto, userId, tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when alert not accessible for tenant', async () => {
      const alertWithDifferentTenant = {
        ...mockExistingAlert,
        tenant_id: 'different-tenant-id',
      };

      prismaService.alert.findUnique.mockResolvedValue(
        alertWithDifferentTenant,
      );

      await expect(
        service.convertToCase(alertId, convertDto, userId, tenantId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when alert is already closed', async () => {
      const closedAlert = {
        ...mockExistingAlert,
        alert_status: AlertStatus.CLOSED,
      };

      prismaService.alert.findUnique.mockResolvedValue(closedAlert);

      await expect(
        service.convertToCase(alertId, convertDto, userId, tenantId),
      ).rejects.toThrow('Alert alert-123 is already closed');
    });

    it('should throw BadRequestException when alert is already converted', async () => {
      const convertedAlert = {
        ...mockExistingAlert,
        alert_status: AlertStatus.CONVERTED,
      };

      prismaService.alert.findUnique.mockResolvedValue(convertedAlert);

      await expect(
        service.convertToCase(alertId, convertDto, userId, tenantId),
      ).rejects.toThrow('Alert alert-123 is already converted to a case');
    });

    it('should use alert priority when convertDto priority is not provided', async () => {
      const convertDtoWithoutPriority = {
        caseType: CaseType.FRAUD,
      } as ConvertAlertToCase;

      const mockCase = {
        case_id: 'case-123',
        case_creator_user_id: userId,
        case_owner_user_id: userId,
        tenant_id: tenantId,
        priority: Priority.LOW, // Should use alert's priority
        status: CaseStatus.DRAFT,
        parent_id: null,
        case_type: CaseType.FRAUD,
        case_creation_type: CaseCreationType.MANUAL,
      };

      prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
      prismaService.case.create.mockResolvedValue(mockCase);
      prismaService.alert.update.mockResolvedValue({
        ...mockExistingAlert,
        alert_status: AlertStatus.CONVERTED,
        case_id: mockCase.case_id,
      });

      await service.convertToCase(
        alertId,
        convertDtoWithoutPriority,
        userId,
        tenantId,
      );

      expect(prismaService.case.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          priority: Priority.LOW, // Alert's original priority
        }),
      });
    });

    it('should handle database errors during conversion', async () => {
      prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
      prismaService.case.create.mockRejectedValue(new Error('Database error'));

      await expect(
        service.convertToCase(alertId, convertDto, userId, tenantId),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
