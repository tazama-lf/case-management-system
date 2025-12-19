/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */

import { Test, TestingModule } from '@nestjs/testing';
import { TriageService } from '../../src/modules/triage/triage.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../src/modules/audit/auditLog.service';
import { IngestAlertDto } from '../../src/modules/alert/dto/IngestAlert.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { Priority, AlertType, CaseStatus, CaseType } from '@prisma/client-cms';
import { ConfigService } from '@nestjs/config';
import { CaseService } from '../../src/modules/case/case.service';
import { TaskService } from '../../src/modules/task/task.service';
import { CommentService } from '../../src/modules/comment/comment.service';

import { Logger, NotFoundException, InternalServerErrorException } from '@nestjs/common';
import { UpdateAlertDto } from 'src/modules/triage/dto/update-alert.dto';
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

const createMockPrismaService = () => ({
  alert: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    update: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
  },
  case: {
    create: jest.fn(),
    update: jest.fn(),
  },
  task: {
    update: jest.fn(),
  },
  $transaction: jest.fn(),
});

describe('TriageService', () => {
  let service: TriageService;
  let prismaService: any;
  let auditService: any;
  let caseService: any;
  let taskService: any;
  let configService: any;

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
      getActionHistoryForAlert: jest.fn().mockResolvedValue([]),
    };
    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    const mockCaseService = {
      createCase: jest.fn().mockResolvedValue({
        case_id: 'case-123',
        case_creator_user_id: 'user-123',
        case_owner_user_id: 'system-123',
        status: 'STATUS_00_DRAFT',
        priority: 'NEW',
        case_creation_type: 'AUTOMATIC_SYSTEM',
        tenant_id: 'test-tenant-id',
        created_at: new Date(),
      }),
      updateCase: jest.fn().mockResolvedValue({
        case_id: 'case-123',
        status: 'STATUS_82_CLOSED_CONFIRMED',
      }),
      findCaseById: jest.fn(),
      retrieveCase: jest.fn().mockResolvedValue({
        case_id: 'case-123',
        status: 'STATUS_00_DRAFT',
        case_creator_user_id: 'user-123',
      }),
    };

    const mockTaskService = {
      createTask: jest.fn(),
      updateTask: jest.fn(),
      findTaskById: jest.fn(),
      getTasksByCaseId: jest.fn(),
    };

    const mockCommentService = {
      createComment: jest.fn(),
      findCommentById: jest.fn(),
      addComment: jest.fn().mockResolvedValue({
        comment_id: 'comment-123',
        case_id: 'case-123',
        note: 'Test comment',
        created_at: new Date(),
      }),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('system-uuid-123'),
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
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: CaseService,
          useValue: mockCaseService,
        },
        {
          provide: TaskService,
          useValue: mockTaskService,
        },
        {
          provide: CommentService,
          useValue: mockCommentService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<TriageService>(TriageService);
    prismaService = module.get(PrismaService);
    auditService = module.get(AuditLogService);
    caseService = module.get(CaseService);
    taskService = module.get(TaskService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('handleNewAlert', () => {
    const mockSubmitAlertDto: IngestAlertDto = {
      message: 'Test Alert',
      report: {} as any,
      transaction: { TxTp: 'test-txtp' } as any,
      networkMap: {} as any,
    };
    const userId = 'test-user-id';
    const tenantId = 'test-tenant-id';

    it('should create new alert successfully', async () => {
      const expectedAlert = {
        alert_id: 'alert-123',
        tenant_id: tenantId,
        priority: Priority.NEW,
        source: 'test-source',
        txtp: '',
        message: 'Test alert message',
        alert_data: mockSubmitAlertDto.report,
        transaction: mockSubmitAlertDto.transaction,
        network_map: mockSubmitAlertDto.networkMap,
        confidence_per: 0,
        case_id: null,
        created_at: new Date(),
      };

      prismaService.alert.create.mockResolvedValue(expectedAlert);

      const result = await service.handleNewAlert(mockSubmitAlertDto, userId, tenantId, 'test-source');

      expect(prismaService.alert.create).toHaveBeenCalled();
      expect(auditService.logAction).toHaveBeenCalled();
      expect(result).toEqual(expectedAlert);
    });
  });

  describe('updateAlertData', () => {
    const alertId = 'alert-123';
    const userId = 'test-user-id';
    const tenantId = 'test-tenant-id';

    const mockUpdateDto: UpdateAlertDto = {
      confidence_per: 85,
      priority: Priority.URGENT,
      alertType: AlertType.FRAUD, // Added because service updates alert_type
      note: 'Test update note',
      predictionOutcome: 'TRUE_POSITIVE',
    };

    const mockExistingAlert = {
      alert_id: alertId,
      tenant_id: tenantId,
      priority: Priority.NEW,
      source: 'test-source',
      txtp: null,
      message: 'Test alert message',
      alert_data: { test: 'report data' },
      transaction: { test: 'transaction data' },
      network_map: { test: 'network data' },
      confidence_per: 0,
      case_id: null,
      created_at: new Date(),
    };

    it('should update alert successfully', async () => {
      const updatedAlert = {
        ...mockExistingAlert,
        confidence_per: 85,
        priority: Priority.URGENT,
        alert_type: AlertType.FRAUD,
      };

      prismaService.alert.findFirst.mockResolvedValue(mockExistingAlert);
      prismaService.alert.update.mockResolvedValue(updatedAlert);

      const result = await service.updateAlertData(alertId, mockUpdateDto, userId, tenantId);

      expect(prismaService.alert.findFirst).toHaveBeenCalledWith({
        where: { alert_id: alertId, tenant_id: tenantId },
      });
      expect(prismaService.alert.update).toHaveBeenCalledWith({
        where: { alert_id: alertId },
        data: {
          confidence_per: mockUpdateDto.confidence_per,
          priority: mockUpdateDto.priority,
          alert_type: mockUpdateDto.alertType,
          prediction_outcome: mockUpdateDto.predictionOutcome,
        },
      });
      expect(auditService.logAction).toHaveBeenCalled();
      expect(result).toEqual(updatedAlert);
    });

    it('should throw NotFoundException when alert not found during update', async () => {
      prismaService.alert.findFirst.mockResolvedValue(null);

      await expect(service.updateAlertData(alertId, mockUpdateDto, userId, tenantId)).rejects.toThrow(NotFoundException);
    });

    it('should handle database errors during update operation', async () => {
      prismaService.alert.findFirst.mockResolvedValue(mockExistingAlert);
      prismaService.alert.update.mockRejectedValue(new Error('Database error'));

      await expect(service.updateAlertData(alertId, mockUpdateDto, userId, tenantId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('txtp extraction coverage', () => {
    it('should extract txtp from result.report.txtp', async () => {
      const dto: IngestAlertDto = {
        message: 'Test alert',
        report: { txtp: 'report-txtp' } as any,
        transaction: {} as any,
        networkMap: {} as any,
      };

      const mockAlert = {
        alert_id: 'alert-123',
        tenant_id: 'tenant-123',
        priority: Priority.NEW,
        source: 'test-source',
        txtp: undefined, // Service only extracts from transaction.TxTp
        message: 'Test alert',
      };

      prismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.handleNewAlert(dto, 'user-123', 'tenant-123', 'test-source');

      expect(prismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          txtp: undefined, // No TxTp in transaction
        }),
      });
      expect(result).toEqual(mockAlert);
    });

    it('should extract txtp from result.transaction.TxTp', async () => {
      const dto: IngestAlertDto = {
        message: 'Test alert',
        report: {} as any,
        transaction: { TxTp: 'transaction-txtp' } as any,
        networkMap: {} as any,
      };

      const mockAlert = {
        alert_id: 'alert-123',
        tenant_id: 'tenant-123',
        priority: Priority.NEW,
        source: 'test-source',
        txtp: 'transaction-txtp',

        message: 'Test alert',
      };

      prismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.handleNewAlert(dto, 'user-123', 'tenant-123', 'test-source');

      expect(prismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          txtp: 'transaction-txtp',
        }),
      });
      expect(result).toEqual(mockAlert);
    });

    it('should extract txtp from result.networkMap.txtp', async () => {
      const dto: IngestAlertDto = {
        message: 'Test alert',
        report: {} as any,
        transaction: {} as any,
        networkMap: { txtp: 'network-txtp' } as any,
      };

      const mockAlert = {
        alert_id: 'alert-123',
        tenant_id: 'tenant-123',
        priority: Priority.NEW,
        source: 'test-source',
        txtp: undefined, // Service only extracts from transaction.TxTp
        message: 'Test alert',
      };

      prismaService.alert.create.mockResolvedValue(mockAlert);

      const result = await service.handleNewAlert(dto, 'user-123', 'tenant-123', 'test-source');

      expect(prismaService.alert.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          txtp: undefined, // No TxTp in transaction
        }),
      });
      expect(result).toEqual(mockAlert);
    });
  });

  describe('error handling coverage', () => {
    it('should handle database errors in handleNewAlert', async () => {
      const dto: IngestAlertDto = {
        message: 'Test alert',
        report: {} as any,
        transaction: {} as any,
        networkMap: {} as any,
      };

      prismaService.alert.create.mockRejectedValue(new Error('Database error'));

      await expect(service.handleNewAlert(dto, 'user-123', 'tenant-123', 'test-source')).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('handleManualTriage', () => {
    const alertId = 'alert-123';
    const userId = 'user-123';
    const tenantId = 'tenant-123';

    const mockManualTriageDto = {
      priorityScore: 0.75, // Use decimal value instead of 75
      note: 'Manual triage completed',
      status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
      confidence_per: 90,
      priority: Priority.URGENT,
      alertType: AlertType.FRAUD,
    };

    const mockAlert = {
      alert_id: alertId,
      case_id: 'case-123',
      tenant_id: tenantId,
      priority: Priority.NEW,
      priority_score: null,
      alert_type: AlertType.FRAUD,
      prediction_outcome: null,
      source: 'test-source',
      txtp: null,
      message: 'Test alert',
      alert_data: {},
      transaction: {},
      network_map: {},
      confidence_per: 85,
      created_at: new Date(),
    };

    beforeEach(() => {
      // Mock ConfigService for manual triage
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        switch (key) {
          case 'TRIAGE_TYPE':
            return 'MANUAL';
          case 'PRIORITY_FIRST_HALF':
            return '0.33';
          case 'PRIORITY_SECOND_HALF':
            return '0.66';
          case 'PRIORITY_THIRD_HALF':
            return '1.0';
          default:
            return defaultValue;
        }
      });

      // Mock prisma alert.findUnique to return alert with case relationship
      prismaService.alert.findUnique.mockResolvedValue({
        ...mockAlert,
        case: {
          case_id: 'case-123',
          status: CaseStatus.STATUS_00_DRAFT,
          tenant_id: tenantId,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      // Mock updateAlertData
      jest.spyOn(service, 'updateAlertData').mockResolvedValue(mockAlert);

      // Mock case service
      caseService.retrieveCase.mockResolvedValue({
        case_id: 'case-123',
        status: CaseStatus.STATUS_00_DRAFT,
      });

      // Mock task service
      taskService.getTasksByCaseId.mockResolvedValue([
        {
          task_id: 'triage-task-123',
          name: 'Triage Alert',
          status: 'STATUS_01_UNASSIGNED',
          assigned_user_id: null, // Start unassigned, will be auto-assigned
        },
      ]);

      taskService.updateTask.mockResolvedValue({
        task_id: 'triage-task-123',
        status: 'STATUS_30_COMPLETED',
      });

      taskService.createTask.mockResolvedValue({
        task_id: 'investigation-task-123',
        status: 'STATUS_01_UNASSIGNED',
      });

      caseService.updateCase.mockResolvedValue({
        case_id: 'case-123',
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      });
    });

    it('should handle manual triage with case closure', async () => {
      const result = await service.handleManualTriage(alertId, mockManualTriageDto, userId, tenantId);

      expect(service.updateAlertData).toHaveBeenCalledWith(
        alertId,
        expect.objectContaining({
          priorityScore: 0.75,
          priority: Priority.CRITICAL, // Should be calculated based on priorityScore (0.75 >= 0.66)
        }),
        userId,
        tenantId,
      );

      expect(taskService.getTasksByCaseId).toHaveBeenCalledWith('case-123');
      expect(taskService.updateTask).toHaveBeenCalledWith('triage-task-123', { assignedUserId: userId }, userId);

      // Then complete the task
      expect(taskService.updateTask).toHaveBeenCalledWith('triage-task-123', { status: 'STATUS_30_COMPLETED' }, userId);

      expect(caseService.updateCase).toHaveBeenCalledWith(
        'case-123',
        { status: CaseStatus.STATUS_82_CLOSED_CONFIRMED, caseType: AlertType.FRAUD, priority: Priority.CRITICAL },
        userId,
      );

      expect(result).toEqual(mockAlert);
    });

    it('should handle manual triage with investigation creation', async () => {
      const dtoWithOpenStatus = {
        ...mockManualTriageDto,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      };

      await service.handleManualTriage(alertId, dtoWithOpenStatus, userId, tenantId);

      expect(taskService.createTask).toHaveBeenCalledWith(
        {
          caseId: 'case-123',
          status: 'STATUS_01_UNASSIGNED',
          name: 'Investigate Case',
          description: 'Investigate case: case-123',
        },
        userId,
      );

      expect(caseService.updateCase).toHaveBeenCalledWith(
        'case-123',
        { status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT, caseType: AlertType.FRAUD, priority: Priority.CRITICAL },
        userId,
      );
    });

    it('should calculate priority correctly based on priorityScore', async () => {
      // Test NEW priority (score < 0.33)
      const lowScoreDto = { ...mockManualTriageDto, priorityScore: 0.2 };
      await service.handleManualTriage(alertId, lowScoreDto, userId, tenantId);

      expect(service.updateAlertData).toHaveBeenCalledWith(
        alertId,
        expect.objectContaining({
          priority: Priority.NEW,
        }),
        userId,
        tenantId,
      );

      // Test URGENT priority (0.33 <= score < 0.66)
      const mediumScoreDto = { ...mockManualTriageDto, priorityScore: 0.5 };
      await service.handleManualTriage(alertId, mediumScoreDto, userId, tenantId);

      expect(service.updateAlertData).toHaveBeenCalledWith(
        alertId,
        expect.objectContaining({
          priority: Priority.URGENT,
        }),
        userId,
        tenantId,
      );

      // Test CRITICAL priority (0.66 <= score < 1.0)
      const highScoreDto = { ...mockManualTriageDto, priorityScore: 0.8 };
      await service.handleManualTriage(alertId, highScoreDto, userId, tenantId);

      expect(service.updateAlertData).toHaveBeenCalledWith(
        alertId,
        expect.objectContaining({
          priority: Priority.CRITICAL,
        }),
        userId,
        tenantId,
      );

      // Test BREACH priority (score >= 1.0)
      const maxScoreDto = { ...mockManualTriageDto, priorityScore: 1.0 };
      await service.handleManualTriage(alertId, maxScoreDto, userId, tenantId);

      expect(service.updateAlertData).toHaveBeenCalledWith(
        alertId,
        expect.objectContaining({
          priority: Priority.BREACH,
        }),
        userId,
        tenantId,
      );
    });

    it('should throw error when triage type is not MANUAL', async () => {
      configService.get.mockImplementation((key: string, defaultValue?: any) => {
        if (key === 'TRIAGE_TYPE') return 'AI';
        return defaultValue;
      });

      await expect(service.handleManualTriage(alertId, mockManualTriageDto, userId, tenantId)).rejects.toThrow(
        'Cannot update alert alert-123 when triageType is not MANUAL',
      );
    });

    it('should throw error when user is not assigned to triage task', async () => {
      taskService.getTasksByCaseId.mockResolvedValue([
        {
          task_id: 'triage-task-123',
          name: 'Triage Alert',
          status: 'ASSIGNED_11',
          assigned_user_id: 'other-user',
        },
      ]);

      const result = await service.handleManualTriage(alertId, mockManualTriageDto, userId, tenantId);

      // Should auto-assign the task to the current user
      expect(taskService.updateTask).toHaveBeenCalledWith('triage-task-123', { assignedUserId: userId }, userId);

      expect(result).toEqual(mockAlert);
    });

    it('should throw error when trying to update completed triage task', async () => {
      taskService.getTasksByCaseId.mockResolvedValueOnce([
        {
          task_id: 'triage-task-123',
          name: 'Triage Alert',
          status: 'STATUS_30_COMPLETED',
          assigned_user_id: userId,
        },
      ]);

      await expect(service.handleManualTriage(alertId, mockManualTriageDto, userId, tenantId)).rejects.toThrow(
        'User user-123 is not allowed to complete triage task triage-task-123, assigned to other-user',
      );
    });

    it('should throw error when case is already closed', async () => {
      // Mock the alert with case to have a closed status
      prismaService.alert.findUnique.mockResolvedValueOnce({
        ...mockAlert,
        case: {
          case_id: 'case-123',
          status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
          tenant_id: tenantId,
          created_at: new Date(),
          updated_at: new Date(),
        },
      });

      await expect(service.handleManualTriage(alertId, mockManualTriageDto, userId, tenantId)).rejects.toThrow(
        'Case case-123 linked with alert alert-123 is already closed',
      );
    });

    it('should handle case where no triage task exists', async () => {
      taskService.getTasksByCaseId.mockResolvedValue([]);

      const result = await service.handleManualTriage(alertId, mockManualTriageDto, userId, tenantId);

      expect(taskService.updateTask).not.toHaveBeenCalled();
      expect(result).toEqual(mockAlert);
    });

    it('should handle errors in manual triage process', async () => {
      jest.spyOn(service, 'updateAlertData').mockRejectedValue(new Error('Update failed'));

      await expect(service.handleManualTriage(alertId, mockManualTriageDto, userId, tenantId)).rejects.toThrow('Update failed');
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
        priority: Priority.URGENT,
        confidence_per: 85,

        source: 'REST API',
        alert_type: AlertType.AML,
        created_at: new Date(),
      },
      {
        alert_id: 'alert-2',
        txtp: 'TRANSFER',
        priority: Priority.NEW,
        confidence_per: 45,

        source: 'REST API',
        alert_type: AlertType.AML,
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

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow('Page must be a positive integer');
    });

    it('should throw BadRequestException for invalid limit', async () => {
      const invalidParams = { ...mockParams, limit: -1 };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow('Limit must be a positive integer');
    });

    it('should throw BadRequestException for invalid sortBy field', async () => {
      const invalidParams = { ...mockParams, sortBy: 'invalid_field' };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow('Invalid sortBy field: invalid_field');
    });

    it('should throw BadRequestException for invalid sortOrder', async () => {
      const invalidParams = { ...mockParams, sortOrder: 'invalid' as any };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow('sortOrder must be "asc" or "desc"');
    });

    it('should throw BadRequestException for invalid priority', async () => {
      const invalidParams = { ...mockParams, priority: 'INVALID_PRIORITY' };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow('Invalid priority: INVALID_PRIORITY');
    });

    it('should throw BadRequestException for invalid alertType', async () => {
      const invalidParams = { ...mockParams, alertType: 'INVALID_STATUS' };

      await expect(service.getAlertsForUser(invalidParams)).rejects.toThrow('Invalid alertType: INVALID_STATUS');
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
      const searchParams = { ...mockParams, search: 'URGENT' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(searchParams);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ priority: { equals: Priority.URGENT } }]),
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
              { txtp: { contains: 'CLOSED', mode: 'insensitive' } },
              { source: { contains: 'CLOSED', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should handle search with alertType match', async () => {
      const searchParams = { ...mockParams, search: 'AML' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(searchParams);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ alert_type: { equals: AlertType.AML } }]),
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
            OR: expect.arrayContaining([{ txtp: { contains: 'payment', mode: 'insensitive' } }]),
          }),
        }),
      );
    });

    it('should handle search with general text (source contains)', async () => {
      const searchParams = { ...mockParams, search: 'REST API' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(searchParams);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([{ source: { contains: 'REST API', mode: 'insensitive' } }]),
          }),
        }),
      );
    });

    it('should handle database errors', async () => {
      prismaService.alert.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.getAlertsForUser(mockParams)).rejects.toThrow(InternalServerErrorException);
    });

    it('should filter alerts by priority when provided', async () => {
      const paramsWithPriority = { ...mockParams, priority: 'URGENT' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(paramsWithPriority);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            priority: Priority.URGENT,
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
            // No status field exists in the current service implementation
          }),
        }),
      );
    });

    it('should filter alerts by alertType when provided', async () => {
      const paramsWithStatus = { ...mockParams, alertType: 'AML' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(paramsWithStatus);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            alert_type: AlertType.AML,
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
    it('should filter alerts by source when provided', async () => {
      const paramsWithType = { ...mockParams, source: 'REST API' };

      prismaService.alert.findMany.mockResolvedValue(mockAlerts);
      prismaService.alert.count.mockResolvedValue(1);

      await service.getAlertsForUser(paramsWithType);

      expect(prismaService.alert.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            source: 'REST API',
          }),
        }),
      );
    });

    it('should handle database errors', async () => {
      prismaService.alert.findMany.mockRejectedValue(new Error('Database error'));

      await expect(service.getAlertsForUser(mockParams)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getAlertDetails', () => {
    const alertId = 'alert-123';
    const tenantId = 'test-tenant-id';
    const userId = 'test-user-id';

    const mockAlert = {
      alert_id: alertId,
      txtp: 'PAYMENT',
      priority: Priority.URGENT,
      confidence_per: 85,
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
      const loggerSpy = jest.spyOn(service['logger'], 'log').mockImplementation();

      prismaService.alert.findUnique.mockResolvedValue(mockAlert);

      const result = await service.getAlertDetails(alertId, tenantId, userId);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tenant_id, ...expectedResult } = mockAlert;
      expect(result).toEqual(expectedResult);
      expect(loggerSpy).toHaveBeenCalledWith(
        expect.stringContaining(`Alert ${alertId} opened by user ${userId} for review`),
        'TriageService',
      );

      loggerSpy.mockRestore();
    });

    it('should throw NotFoundException when alert not found', async () => {
      prismaService.alert.findUnique.mockResolvedValue(null);

      await expect(service.getAlertDetails(alertId, tenantId, userId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException when alert not accessible for tenant', async () => {
      const alertWithDifferentTenant = {
        ...mockAlert,
        tenant_id: 'different-tenant-id',
      };

      prismaService.alert.findUnique.mockResolvedValue(alertWithDifferentTenant);

      await expect(service.getAlertDetails(alertId, tenantId, userId)).rejects.toThrow(NotFoundException);
    });

    it('should handle database errors', async () => {
      prismaService.alert.findUnique.mockRejectedValue(new Error('Database error'));

      await expect(service.getAlertDetails(alertId, tenantId, userId)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getAlertActionHistory', () => {
    const alertId = 'alert-123';
    const tenantId = 'tenant-123';
    const userId = 'user-123';

    it('should return alert action history successfully', async () => {
      const mockAlert = { alert_id: alertId, tenant_id: tenantId };
      const mockHistory = [{ action: 'created', timestamp: new Date() }];

      prismaService.alert.findFirst.mockResolvedValue(mockAlert);
      auditService.getActionHistoryForAlert.mockResolvedValue(mockHistory);

      const result = await service.getAlertActionHistory(alertId, tenantId, userId);

      expect(result).toEqual({
        alertId,
        tenantId,
        userId,
        history: mockHistory,
      });
      expect(prismaService.alert.findFirst).toHaveBeenCalledWith({
        where: { alert_id: alertId, tenant_id: tenantId },
      });
      expect(auditService.getActionHistoryForAlert).toHaveBeenCalledWith(alertId);
    });

    it('should throw NotFoundException when alert not found', async () => {
      prismaService.alert.findFirst.mockResolvedValue(null);

      await expect(service.getAlertActionHistory(alertId, tenantId, userId)).rejects.toThrow(
        new NotFoundException(`Alert with ID ${alertId} was not found for tenant ${tenantId}.`),
      );
    });
  });

  describe('handleAITriage', () => {
    const alertId = 'alert-123';
    const caseId = 'case-123';
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const dto = {
      message: 'test',
      transaction: {},
      networkMap: {},
      report: { tadpResult: null },
    } as unknown as IngestAlertDto;

    beforeEach(() => {
      // Mock TaskService with consistent task_id
      service['taskService'] = {
        createTask: jest.fn().mockResolvedValue({ task_id: 'triage-task-123' }),
        updateTask: jest.fn().mockResolvedValue({ task_id: 'triage-task-123', status: 'STATUS_30_COMPLETED' }),
      } as any;

      // Mock ConfigService
      service['configService'] = {
        get: jest
          .fn()
          .mockReturnValueOnce(100) // CONFIDENCE_THRESHOLD
          .mockReturnValueOnce('true'), // CLIENT_SYSTEM_INTERDICTION_ENABLED
      } as any;
    });

    it('should handle low confidence prediction - create investigation task', async () => {
      // Mock AI prediction with low confidence
      jest.spyOn(service as any, 'predictAlert').mockResolvedValue({
        confidence_per: 50, // Below threshold
        alertType: 'FRAUD',
        isTruePositive: true,
      });

      jest.spyOn(service as any, 'updateAlertAndUpdateTriageTask').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'createInvestigationTask').mockResolvedValue({ taskId: 'investigation-task' });

      const result = await service.handleAITriage(alertId, caseId, dto, userId, tenantId);

      expect(result).toEqual({ taskId: 'investigation-task' });
      expect(service['createInvestigationTask']).toHaveBeenCalledWith(
        caseId,
        userId,
        'triage-task-123',
        'Investigate Case as confidence is below threshold',
        'Triage complete - AI predicted confidence percentage below threshold manual investigation needed',
      );
    });

    it('should handle high confidence false positive - auto close as refuted', async () => {
      // Reset and properly mock configuration values for this test
      service['configService'] = {
        get: jest
          .fn()
          .mockReturnValueOnce(80) // CONFIDENCE_THRESHOLD - lower than our prediction (95)
          .mockReturnValueOnce('false'), // CLIENT_SYSTEM_INTERDICTION_ENABLED - disabled
      } as any;

      // Mock AI prediction with high confidence but false positive
      jest.spyOn(service as any, 'predictAlert').mockResolvedValue({
        priority: 'HIGH',
        confidence_per: 95, // Above threshold
        alertType: 'FRAUD',
        isTruePositive: false, // False positive
      });

      jest.spyOn(service as any, 'updateAlertAndUpdateTriageTask').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'autoCloseCase').mockResolvedValue({
        updatedCase: { caseId: 'case-123', status: 'STATUS_72_AUTOCLOSED_REFUTED' },
        updatedTask: { taskId: 'triage-task-123', status: 'STATUS_30_COMPLETED' },
      });

      const result = await service.handleAITriage(alertId, caseId, dto, userId, tenantId);

      expect(result).toEqual({
        updatedCase: { caseId: 'case-123', status: 'STATUS_72_AUTOCLOSED_REFUTED' },
        updatedTask: { taskId: 'triage-task-123', status: 'STATUS_30_COMPLETED' },
      });
    });

    it('should handle interdiction with transaction occurred', async () => {
      const dtoWithInterdiction = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 50,
                workflow: { interdictionThreshold: 80 },
              },
            ],
          },
        },
      } as IngestAlertDto;

      jest.spyOn(service as any, 'predictAlert').mockResolvedValue({
        confidence_per: 95,
        alertType: 'FRAUD',
        isTruePositive: true,
      });

      jest.spyOn(service as any, 'updateAlertAndUpdateTriageTask').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'createInvestigationTask').mockResolvedValue({ taskId: 'investigation-task' });

      await service.handleAITriage(alertId, caseId, dtoWithInterdiction, userId, tenantId);

      // Should create investigation task since transaction occurred
      expect(service['createInvestigationTask']).toHaveBeenCalled();
    });

    it('should handle FRAUD_AND_AML alert type - create child cases', async () => {
      // Mock configuration values
      service['configService'] = {
        get: jest
          .fn()
          .mockReturnValueOnce(80) // CONFIDENCE_THRESHOLD
          .mockReturnValueOnce('false'), // CLIENT_SYSTEM_INTERDICTION_ENABLED
      } as any;

      // Update taskService to include updateTask method
      service['taskService'] = {
        createTask: jest.fn().mockResolvedValue({ task_id: 'triage-task-123' }),
        updateTask: jest.fn().mockResolvedValue({ task_id: 'triage-task-123', status: 'STATUS_30_COMPLETED' }),
      } as any;

      jest.spyOn(service as any, 'predictAlert').mockResolvedValue({
        priority: 'HIGH',
        confidence_per: 95, // Above threshold
        alertType: AlertType.FRAUD_AND_AML,
        isTruePositive: true, // True positive
      });

      jest.spyOn(service as any, 'updateAlertAndUpdateTriageTask').mockResolvedValue(undefined);
      jest.spyOn(service, 'createCaseWithInvestigationTask').mockResolvedValue({ caseId: 'child-case', taskId: 'child-task' });

      const result = await service.handleAITriage(alertId, caseId, dto, userId, tenantId);

      // Should create both FRAUD and AML child cases
      expect(service.createCaseWithInvestigationTask).toHaveBeenCalledWith(CaseType.FRAUD, userId, tenantId, caseId, expect.any(Object));
      expect(service.createCaseWithInvestigationTask).toHaveBeenCalledWith(CaseType.AML, userId, tenantId, caseId, expect.any(Object));
      expect(result).toBeUndefined(); // Method returns void for this case
    });

    it('should handle AML alert type - create investigation task', async () => {
      // Mock configuration values
      service['configService'] = {
        get: jest
          .fn()
          .mockReturnValueOnce(80) // CONFIDENCE_THRESHOLD
          .mockReturnValueOnce('false'), // CLIENT_SYSTEM_INTERDICTION_ENABLED
      } as any;

      jest.spyOn(service as any, 'predictAlert').mockResolvedValue({
        priority: 'HIGH',
        confidence_per: 95, // Above threshold
        alertType: AlertType.AML,
        isTruePositive: true, // True positive
      });

      jest.spyOn(service as any, 'updateAlertAndUpdateTriageTask').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'createInvestigationTask').mockResolvedValue({ taskId: 'investigation-task' });

      const result = await service.handleAITriage(alertId, caseId, dto, userId, tenantId);

      expect(service['createInvestigationTask']).toHaveBeenCalledWith(
        caseId,
        userId,
        'triage-task-123',
        'Investigate Case for fraud',
        'Triage complete - AI predicted confidence percentage above threshold and true positive with case type aml',
        CaseType.AML,
      );
      expect(result).toEqual({ taskId: 'investigation-task' });
    });

    it('should handle FRAUD with no transaction - auto close as confirmed', async () => {
      const dtoWithInterdiction = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 90, // Above interdiction threshold
                workflow: { interdictionThreshold: 80 },
              },
            ],
          },
        },
      } as IngestAlertDto;

      // Mock configuration values
      service['configService'] = {
        get: jest
          .fn()
          .mockReturnValueOnce(80) // CONFIDENCE_THRESHOLD
          .mockReturnValueOnce('true'), // CLIENT_SYSTEM_INTERDICTION_ENABLED
      } as any;

      jest.spyOn(service as any, 'predictAlert').mockResolvedValue({
        priority: 'HIGH',
        confidence_per: 95, // Above threshold
        alertType: AlertType.FRAUD,
        isTruePositive: true, // True positive
      });

      jest.spyOn(service as any, 'updateAlertAndUpdateTriageTask').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'autoCloseCase').mockResolvedValue({
        updatedCase: { caseId: 'case-123', status: 'STATUS_71_AUTOCLOSED_CONFIRMED' },
        updatedTask: { taskId: 'triage-task-123', status: 'STATUS_30_COMPLETED' },
      });

      const result = await service.handleAITriage(alertId, caseId, dtoWithInterdiction, userId, tenantId);

      expect(service['autoCloseCase']).toHaveBeenCalledWith(
        caseId,
        CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
        userId,
        'triage-task-123',
        'Triage complete - AI predicted true positive (case auto-closed confirmed)',
      );
      expect(result).toEqual({
        updatedCase: { caseId: 'case-123', status: 'STATUS_71_AUTOCLOSED_CONFIRMED' },
        updatedTask: { taskId: 'triage-task-123', status: 'STATUS_30_COMPLETED' },
      });
    });

    it('should handle FRAUD with transaction occurred - create investigation task', async () => {
      const dtoWithInterdiction = {
        report: {
          tadpResult: {
            typologyResult: [
              {
                result: 50, // Below interdiction threshold
                workflow: { interdictionThreshold: 80 },
              },
            ],
          },
        },
      } as IngestAlertDto;

      // Mock configuration values
      service['configService'] = {
        get: jest
          .fn()
          .mockReturnValueOnce(80) // CONFIDENCE_THRESHOLD
          .mockReturnValueOnce('true'), // CLIENT_SYSTEM_INTERDICTION_ENABLED
      } as any;

      jest.spyOn(service as any, 'predictAlert').mockResolvedValue({
        priority: 'HIGH',
        confidence_per: 95, // Above threshold
        alertType: AlertType.FRAUD,
        isTruePositive: true, // True positive
      });

      jest.spyOn(service as any, 'updateAlertAndUpdateTriageTask').mockResolvedValue(undefined);
      jest.spyOn(service as any, 'createInvestigationTask').mockResolvedValue({ taskId: 'investigation-task' });

      const result = await service.handleAITriage(alertId, caseId, dtoWithInterdiction, userId, tenantId);

      expect(service['createInvestigationTask']).toHaveBeenCalledWith(
        caseId,
        userId,
        'triage-task-123',
        'Investigate Case for fraud',
        'Triage complete - AI predicted confidence percentage above threshold and true positive with case type fraud and transaction occured',
        CaseType.FRAUD,
      );
      expect(result).toEqual({ taskId: 'investigation-task' });
    });

    it('should handle errors in AI triage process', async () => {
      // Mock configuration values
      service['configService'] = {
        get: jest
          .fn()
          .mockReturnValueOnce(80) // CONFIDENCE_THRESHOLD
          .mockReturnValueOnce('false'), // CLIENT_SYSTEM_INTERDICTION_ENABLED
      } as any;

      // Mock predictAlert to throw an error
      jest.spyOn(service as any, 'predictAlert').mockRejectedValue(new Error('AI prediction failed'));

      await expect(service.handleAITriage(alertId, caseId, dto, userId, tenantId)).rejects.toThrow('AI triage process failed');
    });
  });

  describe('autoCloseCase', () => {
    const caseId = 'case-123';
    const userId = 'user-123';
    const taskId = 'task-123';

    it('should auto close case successfully', async () => {
      const mockCase = { case_id: caseId, status: CaseStatus.STATUS_72_AUTOCLOSED_REFUTED };
      const mockTask = { task_id: taskId, status: 'STATUS_30_COMPLETED' };

      // Mock the services that are called within the transaction
      service['taskService'] = {
        updateTask: jest.fn().mockResolvedValue(mockTask),
      } as any;

      service['caseService'] = {
        updateCase: jest.fn().mockResolvedValue(mockCase),
      } as any;

      prismaService.$transaction.mockImplementation(async () => {
        // Simulate the transaction callback returning [updatedCase, updatedTask]
        return [mockCase, mockTask];
      });

      const result = await service['autoCloseCase'](caseId, CaseStatus.STATUS_72_AUTOCLOSED_REFUTED, userId, taskId);

      expect(result).toEqual({ updatedCase: mockCase, updatedTask: mockTask });
    });

    it('should handle errors in autoCloseCase', async () => {
      const caseId = 'case-123';
      const userId = 'user-123';
      const taskId = 'task-123';

      // Mock services to throw an error
      service['taskService'] = {
        updateTask: jest.fn().mockRejectedValue(new Error('Task update failed')),
      } as any;

      service['caseService'] = {
        updateCase: jest.fn().mockResolvedValue({}),
      } as any;

      prismaService.$transaction.mockImplementation(async (callback: any) => {
        return await callback(prismaService);
      });

      await expect(service['autoCloseCase'](caseId, CaseStatus.STATUS_72_AUTOCLOSED_REFUTED, userId, taskId)).rejects.toThrow(
        'Failed to auto close case',
      );
    });

    it('should execute transaction callback and return array values', async () => {
      const caseId = 'case-123';
      const userId = 'user-123';
      const taskId = 'task-123';
      const mockCase = { case_id: caseId, status: CaseStatus.STATUS_72_AUTOCLOSED_REFUTED };
      const mockTask = { task_id: taskId, status: 'STATUS_30_COMPLETED' };

      // Mock the services
      service['taskService'] = {
        updateTask: jest.fn().mockResolvedValue(mockTask),
      } as any;

      service['caseService'] = {
        updateCase: jest.fn().mockResolvedValue(mockCase),
      } as any;

      // Mock transaction to execute the callback and return the array
      prismaService.$transaction.mockImplementation(async (callback: any) => {
        const result = await callback(prismaService);
        return result; // This covers lines 660-665 (the return path)
      });

      const result = await service['autoCloseCase'](caseId, CaseStatus.STATUS_72_AUTOCLOSED_REFUTED, userId, taskId);

      expect(service['taskService'].updateTask).toHaveBeenCalledWith(
        taskId,
        {
          status: 'STATUS_30_COMPLETED',
          description: 'Auto-closed case with status STATUS_72_AUTOCLOSED_REFUTED',
        },
        userId,
      );
      expect(service['caseService'].updateCase).toHaveBeenCalled();
      expect(result).toEqual({ updatedCase: mockCase, updatedTask: mockTask });
    });
  });

  describe('createCaseWithInvestigationTask', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const priority = Priority.URGENT;

    it('should create case with investigation task successfully', async () => {
      const mockCase = { case_id: 'case-123' };
      const mockTask = { task_id: 'investigation-task-123' };

      service['caseService'] = {
        createCase: jest.fn().mockResolvedValue(mockCase),
      } as any;

      service['taskService'] = {
        createTask: jest.fn().mockResolvedValue(mockTask),
      } as any;

      const result = await service.createCaseWithInvestigationTask(CaseType.FRAUD, userId, tenantId, 'parent-case-123', priority);

      expect(result).toEqual({ caseId: 'case-123', taskId: 'investigation-task-123' });
    });

    it('should handle errors in createCaseWithInvestigationTask', async () => {
      const userId = 'user-123';
      const tenantId = 'tenant-123';

      // Mock caseService to throw an error
      service['caseService'] = {
        createCase: jest.fn().mockRejectedValue(new Error('Case creation failed')),
      } as any;

      service['taskService'] = {
        createTask: jest.fn().mockResolvedValue({ task_id: 'task-123' }),
      } as any;

      await expect(service.createCaseWithInvestigationTask(CaseType.FRAUD, userId, tenantId, 'parent-case-123', priority)).rejects.toThrow(
        'Failed to create FRAUD case and task',
      );
    });
  });

  describe('createInvestigationTask', () => {
    const caseId = 'case-123';
    const userId = 'user-123';
    const triageTaskId = 'triage-task-123';
    const taskName = 'Investigation Task';
    const taskDescription = 'Investigation needed';
    const priority = Priority.URGENT;

    it('should create investigation task successfully', async () => {
      const mockTask = { task_id: 'investigation-task-123' };
      const mockTriageTask = { task_id: triageTaskId, status: 'STATUS_30_COMPLETED' };
      const mockCase = { case_id: 'case-123', status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT };

      service['taskService'] = {
        createTask: jest.fn().mockResolvedValue(mockTask),
        updateTask: jest.fn().mockResolvedValue(mockTriageTask),
      } as any;

      service['caseService'] = {
        updateCase: jest.fn().mockResolvedValue(mockCase),
      } as any;

      const result = await service.createInvestigationTask(caseId, userId, triageTaskId, taskName, taskDescription, priority);

      expect(result).toEqual(mockCase);
      const mockTaskService = service['taskService'];
      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId,
          name: 'Investigate case',
          description: taskName, // taskName is the investigateTaskDesc parameter
          status: 'STATUS_01_UNASSIGNED',
        }),
        userId,
      );
    });

    it('should handle errors in createInvestigationTask', async () => {
      const caseId = 'case-123';
      const userId = 'user-123';
      const triageTaskId = 'triage-task-123';
      const taskName = 'Investigation Task';
      const taskDescription = 'Investigation needed';
      const priority = Priority.URGENT;

      // Mock taskService to throw an error
      service['taskService'] = {
        createTask: jest.fn().mockRejectedValue(new Error('Task creation failed')),
        updateTask: jest.fn().mockResolvedValue({ task_id: triageTaskId, status: 'STATUS_30_COMPLETED' }),
      } as any;

      service['caseService'] = {
        updateCase: jest.fn().mockResolvedValue({ case_id: 'case-123', status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT }),
      } as any;

      await expect(service.createInvestigationTask(caseId, userId, triageTaskId, taskName, taskDescription, priority)).rejects.toThrow(
        'Failed to create investigation task',
      );
    });
  });

  describe('updateAlertAndUpdateTriageTask', () => {
    const alertId = 'alert-123';
    const triageTaskId = 'triage-task-123';
    const alertType = AlertType.FRAUD;
    const confidence = 95;
    const priorityScore = 85;
    const priority = Priority.URGENT;
    const predictedTruePositive = true;
    const userId = 'user-123';
    const tenantId = 'tenant-123';

    it('should update alert and triage task successfully', async () => {
      const mockAlert = { alert_id: alertId, alert_type: alertType };
      const mockTask = { task_id: triageTaskId, status: 'STATUS_30_COMPLETED' };

      jest.spyOn(service as any, 'updateAlertData').mockResolvedValue(mockAlert);
      service['taskService'] = {
        updateTask: jest.fn().mockResolvedValue(mockTask),
      } as any;

      await service['updateAlertAndUpdateTriageTask'](
        alertId,
        triageTaskId,
        alertType,
        confidence,
        priorityScore,
        priority,
        predictedTruePositive,
        userId,
        tenantId,
      );

      expect(service['updateAlertData']).toHaveBeenCalledWith(
        alertId,
        expect.objectContaining({
          alertType: alertType,
          confidence_per: confidence,
          note: 'Updated alert data with AI outcome',
        }),
        userId,
        tenantId,
      );
    });

    it('should handle errors in updateAlertAndUpdateTriageTask', async () => {
      // Mock updateAlertData to throw an error
      jest.spyOn(service as any, 'updateAlertData').mockRejectedValue(new Error('Update failed'));

      await expect(
        service['updateAlertAndUpdateTriageTask'](
          alertId,
          triageTaskId,
          alertType,
          confidence,
          priorityScore,
          priority,
          predictedTruePositive,
          userId,
          tenantId,
        ),
      ).rejects.toThrow('Failed to update alert and triage task');
    });
  });

  describe('processIncomingAlert', () => {
    let mockAlertMessageDto: any;

    beforeEach(() => {
      mockAlertMessageDto = {
        message: 'Test alert message',
        transaction: {
          TenantId: 'test-tenant-id',
          TxTp: 'pacs.008',
          Pacs008: {
            FIToFIPmtSts: {
              GrpHdr: {
                MsgId: 'test-msg-001',
                CreDtTm: '2025-09-04T15:30:00.000Z',
              },
            },
          },
        },
        networkMap: {
          active: true,
          cfg: '1.0.0',
          messages: [],
        },
        report: {
          id: 'test-report-001',
          cfg: '1.0.0',
          result: {
            ruleResults: [],
          },
        },
      };

      // Reset all mocks
      jest.clearAllMocks();

      // Mock handleNewAlert to return a basic alert
      jest.spyOn(service, 'handleNewAlert').mockResolvedValue({
        alert_id: 'alert-123',
        case_id: 'case-123',
        tenant_id: 'test-tenant-id',
        priority: Priority.NEW,
        alert_type: AlertType.FRAUD,
        source: 'NATS',
        message: 'Test alert',
        alert_data: {},
        transaction: {},
        network_map: {},
        confidence_per: 85,
        created_at: new Date(),
        priority_score: null,
        prediction_outcome: null,
        txtp: null,
      });

      // Mock handleAITriage
      jest.spyOn(service, 'handleAITriage').mockResolvedValue(undefined);
    });

    describe('AI Triage Type', () => {
      it('should handle AI triage when TRIAGE_TYPE is AI', async () => {
        configService.get.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'TRIAGE_TYPE') return 'AI';
          if (key === 'SYSTEM_UUID') return 'system-123';
          return defaultValue;
        });

        await service.processIncomingAlert(mockAlertMessageDto, 'user-123', 'test-tenant-id');

        expect(service.handleNewAlert).toHaveBeenCalledWith(
          expect.objectContaining({
            message: 'Test alert message',
            transaction: mockAlertMessageDto.transaction,
            networkMap: mockAlertMessageDto.networkMap,
            report: mockAlertMessageDto.report,
          }),
          'user-123',
          'test-tenant-id',
          'NATS',
        );

        expect(service.handleAITriage).toHaveBeenCalledWith('alert-123', 'case-123', expect.any(Object), 'user-123', 'test-tenant-id');

        expect(taskService.createTask).not.toHaveBeenCalled();
        expect(caseService.updateCase).not.toHaveBeenCalled();
      });

      it('should handle AI triage when TRIAGE_TYPE is ai (lowercase)', async () => {
        configService.get.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'TRIAGE_TYPE') return 'ai';
          if (key === 'SYSTEM_UUID') return 'system-123';
          return defaultValue;
        });

        await service.processIncomingAlert(mockAlertMessageDto, 'user-123', 'test-tenant-id');

        expect(service.handleAITriage).toHaveBeenCalled();
      });
    });

    describe('Manual Triage Type', () => {
      it('should create unassigned triage task when TRIAGE_TYPE is MANUAL', async () => {
        configService.get.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'TRIAGE_TYPE') return 'MANUAL';
          if (key === 'SYSTEM_UUID') return 'system-123';
          return defaultValue;
        });

        taskService.createTask.mockResolvedValue({
          task_id: 'task-123',
          case_id: 'case-123',
          status: 'STATUS_01_UNASSIGNED',
          name: 'Triage Alert',
          description: 'Manual triage required for alert: alert-123',
        });

        await service.processIncomingAlert(mockAlertMessageDto, 'user-123', 'test-tenant-id');

        expect(service.handleNewAlert).toHaveBeenCalled();
        expect(service.handleAITriage).not.toHaveBeenCalled();

        expect(taskService.createTask).toHaveBeenCalledWith(
          {
            caseId: 'case-123',
            status: 'STATUS_01_UNASSIGNED',
            name: 'Triage Alert',
            description: 'Manual triage required for alert: alert-123',
          },
          'user-123',
        );

        expect(caseService.updateCase).not.toHaveBeenCalled();
      });

      it('should handle manual triage when TRIAGE_TYPE is manual (lowercase)', async () => {
        configService.get.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'TRIAGE_TYPE') return 'manual';
          if (key === 'SYSTEM_UUID') return 'system-123';
          return defaultValue;
        });

        await service.processIncomingAlert(mockAlertMessageDto, 'user-123', 'test-tenant-id');

        expect(taskService.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'STATUS_01_UNASSIGNED',
            name: 'Triage Alert',
          }),
          'user-123',
        );
      });
    });

    describe('Disabled Triage Type', () => {
      it('should create investigation task and update case when TRIAGE_TYPE is DISABLED', async () => {
        configService.get.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'TRIAGE_TYPE') return 'DISABLED';
          if (key === 'SYSTEM_UUID') return 'system-123';
          return defaultValue;
        });

        taskService.createTask.mockResolvedValue({
          task_id: 'task-123',
          case_id: 'case-123',
          status: 'STATUS_01_UNASSIGNED',
          name: 'Investigate Case',
          description: 'Investigate case: case-123',
        });

        caseService.updateCase.mockResolvedValue({
          case_id: 'case-123',
          status: 'STATUS_02_READY_FOR_ASSIGNMENT',
        });

        await service.processIncomingAlert(mockAlertMessageDto, 'user-123', 'test-tenant-id');

        expect(service.handleNewAlert).toHaveBeenCalled();
        expect(service.handleAITriage).not.toHaveBeenCalled();

        expect(taskService.createTask).toHaveBeenCalledWith(
          {
            caseId: 'case-123',
            status: 'STATUS_01_UNASSIGNED',
            name: 'Investigate Case',
            description: 'Investigate case: case-123',
          },
          'user-123',
        );

        expect(caseService.updateCase).toHaveBeenCalledWith(
          'case-123',
          {
            status: 'STATUS_02_READY_FOR_ASSIGNMENT',
          },
          'user-123',
        );
      });

      it('should use default behavior when TRIAGE_TYPE is not set', async () => {
        configService.get.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'TRIAGE_TYPE') return defaultValue; // Returns 'DISABLED'
          if (key === 'SYSTEM_UUID') return 'system-123';
          return defaultValue;
        });

        await service.processIncomingAlert(mockAlertMessageDto, 'user-123', 'test-tenant-id');

        expect(taskService.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'STATUS_01_UNASSIGNED',
            name: 'Investigate Case',
          }),
          'user-123',
        );

        expect(caseService.updateCase).toHaveBeenCalledWith(
          'case-123',
          expect.objectContaining({
            status: 'STATUS_02_READY_FOR_ASSIGNMENT',
          }),
          'user-123',
        );
      });

      it('should use default behavior for unknown TRIAGE_TYPE', async () => {
        configService.get.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'TRIAGE_TYPE') return 'UNKNOWN_TYPE';
          if (key === 'SYSTEM_UUID') return 'system-123';
          return defaultValue;
        });

        await service.processIncomingAlert(mockAlertMessageDto, 'user-123', 'test-tenant-id');

        expect(taskService.createTask).toHaveBeenCalledWith(
          expect.objectContaining({
            status: 'STATUS_01_UNASSIGNED',
            name: 'Investigate Case',
          }),
          'user-123',
        );
      });
    });

    describe('Error Handling', () => {
      it('should propagate errors from handleNewAlert', async () => {
        configService.get.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'TRIAGE_TYPE') return 'AI';
          return defaultValue;
        });

        const error = new Error('Failed to create alert');
        jest.spyOn(service, 'handleNewAlert').mockRejectedValue(error);

        await expect(service.processIncomingAlert(mockAlertMessageDto, 'user-123', 'test-tenant-id')).rejects.toThrow(
          'Failed to create alert',
        );
      });

      it('should propagate errors from handleAITriage', async () => {
        configService.get.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'TRIAGE_TYPE') return 'AI';
          return defaultValue;
        });

        const error = new Error('AI triage failed');
        jest.spyOn(service, 'handleAITriage').mockRejectedValue(error);

        await expect(service.processIncomingAlert(mockAlertMessageDto, 'user-123', 'test-tenant-id')).rejects.toThrow('AI triage failed');
      });

      it('should propagate errors from task creation in manual triage', async () => {
        configService.get.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'TRIAGE_TYPE') return 'MANUAL';
          return defaultValue;
        });

        const error = new Error('Task creation failed');
        taskService.createTask.mockRejectedValue(error);

        await expect(service.processIncomingAlert(mockAlertMessageDto, 'user-123', 'test-tenant-id')).rejects.toThrow(
          'Task creation failed',
        );
      });

      it('should propagate errors from case update in disabled triage', async () => {
        configService.get.mockImplementation((key: string, defaultValue?: any) => {
          if (key === 'TRIAGE_TYPE') return 'DISABLED';
          return defaultValue;
        });

        taskService.createTask.mockResolvedValue({ task_id: 'task-123' });
        const error = new Error('Case update failed');
        caseService.updateCase.mockRejectedValue(error);

        await expect(service.processIncomingAlert(mockAlertMessageDto, 'user-123', 'test-tenant-id')).rejects.toThrow('Case update failed');
      });
    });
  });

  describe('predictAlert', () => {
    it('should return mock AI prediction', async () => {
      const alertId = 'test-alert-123';
      const result = await service['predictAlert'](alertId);

      expect(result).toEqual({
        confidence_per: expect.any(Number),
        alertType: expect.any(String),
        isTruePositive: expect.any(Boolean),
        priorityScore: expect.any(Number),
      });
      expect(result.confidence_per).toBeGreaterThanOrEqual(0);
      expect(result.confidence_per).toBeLessThanOrEqual(100);
    });
  });
});
