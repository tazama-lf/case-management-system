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
        'tenant-123',
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

      const result = await service.manualCloseAlert(
        alertId,
        status,
        userId,
        'tenant-123',
      );

      expect(prismaService.alert.findUnique).toHaveBeenCalled();
      expect(prismaService.alert.update).toHaveBeenCalled();
      expect(auditService.logAction).toHaveBeenCalled();
      expect(result).toEqual(closedAlert);
    });

    it('should throw NotFoundException when alert not found', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.manualCloseAlert(alertId, status, userId, 'tenant-123'),
      ).rejects.toThrow(NotFoundException);
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
          source: 'direct-source',
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
          source: 'report-source',
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
          source: '',
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
          txtp: 'report-txtp',
        }),
      });
      expect(result).toEqual(mockAlert);
    });

    it('should extract txtp from result.transaction.txtp', async () => {
      const dto: SubmitAlertDto = {
        result: {
          message: 'Test alert',
          report: { test: 'data' },
          transaction: { txtp: 'transaction-txtp' },
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
          txtp: 'network-txtp',
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

    it('should handle database errors in updateAlertData', async () => {
      const dto: UpdateAlertDto = {
        priority: Priority.HIGH,
      };

      // Mock findUnique to return a valid alert first
      prismaService.alert.findUnique.mockResolvedValue({
        alert_id: 'alert-123',
        priority: Priority.MEDIUM,
      });

      // Then mock update to throw an error
      prismaService.alert.update.mockRejectedValue(new Error('Database error'));

      await expect(
        service.updateAlertData('alert-123', dto, 'user-123', 'tenant-123'),
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should handle database errors in manualCloseAlert', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(
        service.manualCloseAlert(
          'alert-123',
          AlertStatus.AUTOCLOSED_CONFIRMED,
          'user-123',
          'tenant-123',
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle database errors in manualCloseAlert update', async () => {
      const mockAlert = {
        alert_id: 'alert-123',
        tenant_id: 'tenant-123',
        alert_status: AlertStatus.NEW,
      };

      prismaService.alert.findUnique.mockResolvedValue(mockAlert);
      prismaService.alert.update.mockRejectedValue(new Error('Database error'));

      await expect(
        service.manualCloseAlert(
          'alert-123',
          AlertStatus.AUTOCLOSED_CONFIRMED,
          'user-123',
          'tenant-123',
        ),
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
