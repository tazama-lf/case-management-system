import { Test, TestingModule } from '@nestjs/testing';
import { TriageService } from '../../src/triage/triage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { SubmitAlertDto } from '../../src/triage/dto/submit-alert.dto';
import { UpdateAlertDto } from '../../src/triage/dto/update-alert.dto';
import { AlertStatus, Priority } from '@prisma/client';
import {
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';

describe('TriageService', () => {
  let service: TriageService;
  let prismaService: any;
  let auditService: any;

  beforeEach(async () => {
    const mockPrismaService = {
      alert: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
    };

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

    it('should handle database errors', async () => {
      const error = new Error('Database error');
      prismaService.alert.create.mockRejectedValue(error);

      await expect(
        service.handleNewAlert(mockSubmitAlertDto, userId, tenantId),
      ).rejects.toThrow(InternalServerErrorException);
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
      );

      expect(prismaService.alert.findUnique).toHaveBeenCalled();
      expect(prismaService.alert.update).toHaveBeenCalled();
      expect(auditService.logAction).toHaveBeenCalled();
      expect(result).toEqual(updatedAlert);
    });

    it('should throw NotFoundException when alert not found', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.updateAlertData(alertId, mockUpdateDto, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('manualCloseAlert', () => {
    const alertId = 'alert-123';
    const userId = 'test-user-id';
    const status = AlertStatus.AUTOCLOSED_CONFIRMED;

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
        alert_status: AlertStatus.AUTOCLOSED_CONFIRMED,
      };

      prismaService.alert.findUnique.mockResolvedValue(mockExistingAlert);
      prismaService.alert.update.mockResolvedValue(closedAlert);

      const result = await service.manualCloseAlert(alertId, status, userId);

      expect(prismaService.alert.findUnique).toHaveBeenCalled();
      expect(prismaService.alert.update).toHaveBeenCalled();
      expect(auditService.logAction).toHaveBeenCalled();
      expect(result).toEqual(closedAlert);
    });

    it('should throw NotFoundException when alert not found', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.manualCloseAlert(alertId, status, userId),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
