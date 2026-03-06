import { Test, TestingModule } from '@nestjs/testing';
import { CaseReopeningService } from '../src/modules/case/services/case-reopening.service';
import { CaseRepository } from '../src/modules/repository/case.repository';
import { CommentRepository } from '../src/modules/repository/comment.repository';
import { AuditLogService } from '../src/modules/audit/auditLog.service';
import { NotificationService } from '../src/modules/notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TaskService } from '../src/modules/task/task.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseQueryService } from '../src/modules/case/services/case-query.service';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { BadRequestException, NotFoundException, ConflictException } from '@nestjs/common';
import { CaseStatus, TaskStatus, CaseType, Priority } from '@prisma/client-cms';

describe('CaseReopeningService', () => {
  let service: CaseReopeningService;
  let caseRepository: any;
  let commentRepository: any;
  let auditLogService: any;
  let notificationService: any;
  let prismaService: any;
  let taskService: any;
  let logger: any;
  let caseQueryService: any;
  let flowableService: any;
  let loggingOrchestrationService: any;

  const mockCase = {
    case_id: 1,
    tenant_id: 'tenant-123',
    case_owner_user_id: 'user-123',
    status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
    case_type: CaseType.FRAUD,
    priority: Priority.CRITICAL,
    parent_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTask = {
    task_id: 1,
    case_id: 1,
    name: 'Approve Case Reopening',
    status: TaskStatus.STATUS_01_UNASSIGNED,
    assigned_user_id: null,
    tenant_id: 'tenant-123',
    created_at: new Date(),
    updated_at: new Date(),
    comments: [
      {
        comment_id: 1,
        note: JSON.stringify({
          requestedBy: 'user-123',
          requesterRole: 'CMS_ANALYST',
          reason: 'New evidence found',
          previousStatus: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
          requestedAt: '2024-01-01T00:00:00Z',
        }),
      },
    ],
  };

  beforeEach(async () => {
    const mockCaseRepository = {
      findCaseForReopening: jest.fn(),
      findUnassignedTaskForReopening: jest.fn(),
      findReopeningTaskForRejection: jest.fn(),
      findCaseById: jest.fn(),
      createCase: jest.fn(),
      updateCase: jest.fn(),
      transaction: jest.fn((callback) =>
        callback({
          case: { update: jest.fn(), findFirst: jest.fn() },
          task: { update: jest.fn() },
        }),
      ),
    };

    const mockCommentRepository = {
      createComment: jest.fn(),
    };

    const mockAuditLogService = {
      createAuditLog: jest.fn(),
    };

    const mockNotificationService = {
      sendNotification: jest.fn(),
      sendGroupNotification: jest.fn(),
    };

    const mockPrismaService = {
      $transaction: jest.fn((callback) => callback(mockPrismaService)),
      case: {
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      task: {
        update: jest.fn(),
      },
    };

    const mockTaskService = {
      createTask: jest.fn(),
      updateTask: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockCaseQueryService = {
      retrieveCase: jest.fn(),
    };

    const mockFlowableService = {
      handleCaseStatusChanged: jest.fn(),
      handleCaseCreated: jest.fn(),
      handleTaskCompleted: jest.fn(),
    };

    const mockLoggingOrchestrationService = {
      logActions: jest.fn(),
      logActionsWithHistory: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseReopeningService,
        { provide: CaseRepository, useValue: mockCaseRepository },
        { provide: CommentRepository, useValue: mockCommentRepository },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TaskService, useValue: mockTaskService },
        { provide: LoggerService, useValue: mockLogger },
        { provide: CaseQueryService, useValue: mockCaseQueryService },
        { provide: FlowableService, useValue: mockFlowableService },
        { provide: LoggingOrchestrationService, useValue: mockLoggingOrchestrationService },
      ],
    }).compile();

    service = module.get<CaseReopeningService>(CaseReopeningService);
    caseRepository = module.get(CaseRepository);
    commentRepository = module.get(CommentRepository);
    auditLogService = module.get(AuditLogService);
    notificationService = module.get(NotificationService);
    prismaService = module.get(PrismaService);
    taskService = module.get(TaskService);
    logger = module.get(LoggerService);
    caseQueryService = module.get(CaseQueryService);
    flowableService = module.get(FlowableService);
    loggingOrchestrationService = module.get(LoggingOrchestrationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('reopenCase', () => {
    const userId = 'user-123';
    const tenantId = 'tenant-123';
    const reason = 'New evidence found that requires further investigation';

    const setupMockTransaction = () => {
      caseRepository.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          case: {
            update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT }),
          },
        };
        return callback(tx);
      });
    };

    it('should successfully reopen case as supervisor', async () => {
      const role = 'CMS_SUPERVISOR';
      caseRepository.findCaseById.mockResolvedValueOnce(mockCase);
      setupMockTransaction();

      taskService.createTask.mockResolvedValueOnce({
        task_id: 2,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      const result = await service.reopenCase(1, reason, userId, tenantId, role);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Case reopened successfully');
      expect(result.investigation_task).toBeDefined();
      expect(taskService.createTask).toHaveBeenCalled();
      expect(flowableService.handleCaseCreated).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should successfully reopen case with parent case as supervisor', async () => {
      const role = 'CMS_SUPERVISOR';
      const caseWithParent = { ...mockCase, parent_id: 100 };

      caseRepository.findCaseById.mockResolvedValueOnce(caseWithParent);
      caseRepository.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          case: {
            update: jest
              .fn()
              .mockResolvedValueOnce({ ...caseWithParent, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT })
              .mockResolvedValueOnce({ case_id: 100, status: CaseStatus.STATUS_20_IN_PROGRESS }),
          },
        };
        return callback(tx);
      });

      taskService.createTask.mockResolvedValueOnce({
        task_id: 2,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      const result = await service.reopenCase(1, reason, userId, tenantId, role);

      expect(result.success).toBe(true);
    });

    it('should create approval task for non-supervisor investigator', async () => {
      const role = 'CMS_ANALYST';
      caseRepository.findCaseById.mockResolvedValueOnce(mockCase);

      caseRepository.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          case: {
            update: jest.fn().mockResolvedValue({
              ...mockCase,
              status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
            }),
          },
        };
        const result = await callback(tx);
        return { ...result, approvalTask: { task_id: 2, name: 'Approve Case Reopening' } };
      });

      taskService.createTask.mockResolvedValueOnce({
        task_id: 2,
        name: 'Approve Case Reopening',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      commentRepository.createComment.mockResolvedValueOnce({});

      const result = await service.reopenCase(1, reason, userId, tenantId, role);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Case reopened and pending supervisor approval');
      expect(result.approvalTask).toBeDefined();
    });

    it.each([
      {
        name: 'case is not in reopenable state',
        caseOverride: { ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS },
        reason: 'Test reason',
        error: 'not in a valid closed state for reopening',
      },
      {
        name: 'reason is too short',
        caseOverride: mockCase,
        reason: 'no',
        error: 'must be at least 4 characters',
      },
      {
        name: 'reason is empty',
        caseOverride: mockCase,
        reason: '',
        error: 'must be at least 4 characters',
      },
    ])('should throw error if $name', async ({ caseOverride, reason: testReason, error }) => {
      const role = 'CMS_ANALYST';
      caseRepository.findCaseById.mockResolvedValueOnce(caseOverride);

      await expect(service.reopenCase(1, testReason, userId, tenantId, role)).rejects.toThrow(error);
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'FAILURE' }));
    });

    it('should handle errors during reopening', async () => {
      const role = 'CMS_SUPERVISOR';
      caseRepository.findCaseById.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.reopenCase(1, reason, userId, tenantId, role)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'FAILURE' }));
    });
  });

  describe('approveCaseReopening', () => {
    const supervisorId = 'supervisor-123';
    const tenantId = 'tenant-123';

    beforeEach(() => {
      caseRepository.findCaseForReopening.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
        tasks: [mockTask],
      });
      caseRepository.findUnassignedTaskForReopening.mockResolvedValue(mockTask);
    });

    it('should approve reopening and assign to investigations queue', async () => {
      const taskWithSupervisorRole = {
        ...mockTask,
        comments: [
          {
            comment_id: 1,
            note: JSON.stringify({
              requestedBy: 'supervisor-456',
              requesterRole: 'CMS_SUPERVISOR',
              reason: 'Additional review needed',
            }),
          },
        ],
      };
      caseRepository.findUnassignedTaskForReopening.mockResolvedValue(taskWithSupervisorRole);

      caseRepository.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          case: { update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT }) },
          task: { update: jest.fn().mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED }) },
        };
        return callback(tx);
      });

      taskService.createTask.mockResolvedValueOnce({
        task_id: 3,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      notificationService.sendGroupNotification.mockResolvedValueOnce({});

      const result = await service.approveCaseReopening(1, supervisorId, tenantId);

      expect(result.success).toBe(true);
      expect(result.case.status).toBe(CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT);
      expect(notificationService.sendGroupNotification).toHaveBeenCalled();
    });

    it('should approve reopening for case with parent and update parent status', async () => {
      const caseWithParent = {
        ...mockCase,
        parent_id: 100,
        status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
        tasks: [mockTask],
      };
      caseRepository.findCaseForReopening.mockResolvedValue(caseWithParent);

      caseRepository.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          case: {
            update: jest
              .fn()
              .mockResolvedValueOnce({ ...caseWithParent, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT })
              .mockResolvedValueOnce({ case_id: 100, status: CaseStatus.STATUS_20_IN_PROGRESS }),
          },
          task: { update: jest.fn().mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED }) },
        };
        return callback(tx);
      });

      taskService.createTask.mockResolvedValueOnce({
        task_id: 3,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      notificationService.sendGroupNotification.mockResolvedValueOnce({});

      const result = await service.approveCaseReopening(1, supervisorId, tenantId);

      expect(result.success).toBe(true);
    });

    it('should handle parse errors in reopening metadata', async () => {
      const taskWithInvalidJson = {
        ...mockTask,
        comments: [{ comment_id: 1, note: 'Invalid JSON' }],
      };
      caseRepository.findUnassignedTaskForReopening.mockResolvedValue(taskWithInvalidJson);

      caseRepository.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          case: { update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT }) },
          task: { update: jest.fn().mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED }) },
        };
        return callback(tx);
      });

      taskService.createTask.mockResolvedValueOnce({
        task_id: 3,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      notificationService.sendGroupNotification.mockResolvedValueOnce({});

      const result = await service.approveCaseReopening(1, supervisorId, tenantId);

      expect(result.success).toBe(true);
    });

    it.each([
      {
        name: 'notification errors for group',
        notificationType: 'sendGroupNotification',
        logMessage: 'Failed to send group notification',
      },
    ])('should handle $name gracefully', async ({ notificationType, logMessage }) => {
      const taskWithSupervisorRole = {
        ...mockTask,
        comments: [
          {
            comment_id: 1,
            note: JSON.stringify({
              requestedBy: 'supervisor-456',
              requesterRole: 'CMS_SUPERVISOR',
            }),
          },
        ],
      };
      caseRepository.findUnassignedTaskForReopening.mockResolvedValue(taskWithSupervisorRole);

      caseRepository.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          case: { update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT }) },
          task: { update: jest.fn().mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED }) },
        };
        return callback(tx);
      });

      taskService.createTask.mockResolvedValueOnce({
        task_id: 3,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      notificationService[notificationType].mockRejectedValueOnce(new Error('Notification failed'));

      const result = await service.approveCaseReopening(1, supervisorId, tenantId);

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining(logMessage), expect.any(String), 'CaseReopeningService');
    });

    it.each([
      { name: 'case not found', mockFn: 'findCaseForReopening', resolveValue: null, error: NotFoundException },
      {
        name: 'case not in pending reopening state',
        mockFn: 'findCaseForReopening',
        resolveValue: { ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS, tasks: [mockTask] },
        error: ConflictException,
      },
      { name: 'reopening task not found', mockFn: 'findUnassignedTaskForReopening', resolveValue: null, error: NotFoundException },
    ])('should throw error if $name', async ({ mockFn, resolveValue, error }) => {
      caseRepository[mockFn].mockResolvedValue(resolveValue);

      await expect(service.approveCaseReopening(1, supervisorId, tenantId)).rejects.toThrow(error);
    });

    it('should handle errors during approval', async () => {
      caseRepository.findCaseForReopening.mockRejectedValue(new Error('Database error'));

      await expect(service.approveCaseReopening(1, supervisorId, tenantId)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'FAILURE' }));
    });
  });

  describe('rejectCaseReopening', () => {
    const supervisorId = 'supervisor-123';
    const tenantId = 'tenant-123';
    const rejectionReason = 'Insufficient evidence to reopen the case';

    beforeEach(() => {
      caseRepository.findCaseForReopening.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
        tasks: [mockTask],
      });
      caseRepository.findReopeningTaskForRejection.mockResolvedValue(mockTask);
    });

    it('should successfully reject case reopening', async () => {
      caseRepository.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          case: { update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED }) },
          task: { update: jest.fn().mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED }) },
        };
        return callback(tx);
      });

      const result = await service.rejectCaseReopening(1, rejectionReason, supervisorId, tenantId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Case reopening rejected');
      expect(result.case.status).toBe(CaseStatus.STATUS_82_CLOSED_CONFIRMED);
    });

    it.each([
      { name: 'rejection reason is too short', reason: 'no', error: 'must be at least 4 characters' },
      { name: 'rejection reason is empty', reason: '', error: 'must be at least 4 characters' },
    ])('should throw error if $name', async ({ reason, error }) => {
      await expect(service.rejectCaseReopening(1, reason, supervisorId, tenantId)).rejects.toThrow(error);
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'FAILURE' }));
    });

    it('should handle parse errors in reopening metadata', async () => {
      const taskWithInvalidJson = {
        ...mockTask,
        comments: [{ comment_id: 1, note: 'Invalid JSON' }],
      };
      caseRepository.findReopeningTaskForRejection.mockResolvedValue(taskWithInvalidJson);

      caseRepository.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          case: { update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED }) },
          task: { update: jest.fn().mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED }) },
        };
        return callback(tx);
      });

      const result = await service.rejectCaseReopening(1, rejectionReason, supervisorId, tenantId);

      expect(result.success).toBe(true);
    });

    it.each([
      { status: CaseStatus.STATUS_81_CLOSED_REFUTED, name: 'REFUTED' },
      { status: CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE, name: 'INCONCLUSIVE' },
    ])('should restore case to STATUS_$status', async ({ status }) => {
      const reopeningTask = {
        ...mockTask,
        name: 'Approve Case Reopening',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        comments: [
          {
            comment_id: 1,
            note: JSON.stringify({
              requestedBy: 'user-123',
              reason: 'Need investigation',
            }),
          },
        ],
      };

      const closedCase = {
        ...mockCase,
        status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
        final_outcome: status,
        tasks: [reopeningTask],
      };
      caseRepository.findCaseForReopening.mockResolvedValue(closedCase);
      caseRepository.findReopeningTaskForRejection.mockResolvedValueOnce(reopeningTask);

      caseRepository.transaction.mockImplementationOnce(async (callback) => {
        const tx = {
          case: { update: jest.fn().mockResolvedValue({ ...mockCase, status }) },
          task: { update: jest.fn().mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED }) },
        };
        return callback(tx);
      });

      const result = await service.rejectCaseReopening(1, rejectionReason, supervisorId, tenantId);

      expect(result.success).toBe(true);
    });

    it.each([
      { name: 'case not found', mockFn: 'findCaseForReopening', resolveValue: null },
      { name: 'reopening task not found', mockFn: 'findReopeningTaskForRejection', resolveValue: null },
    ])('should throw error if $name', async ({ mockFn, resolveValue }) => {
      caseRepository[mockFn].mockResolvedValue(resolveValue);

      await expect(service.rejectCaseReopening(1, rejectionReason, supervisorId, tenantId)).rejects.toThrow(NotFoundException);
    });

    it('should handle errors during rejection', async () => {
      caseRepository.findCaseForReopening.mockRejectedValue(new Error('Database error'));

      await expect(service.rejectCaseReopening(1, rejectionReason, supervisorId, tenantId)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(expect.objectContaining({ outcome: 'FAILURE' }));
    });
  });

  describe('validateReopeningPreconditions', () => {
    it('should throw NotFoundException if case not found', async () => {
      caseRepository.findCaseForReopening.mockResolvedValue(null);

      await expect((service as any).validateReopeningPreconditions(1, 'tenant-123')).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if case not in pending reopening state', async () => {
      caseRepository.findCaseForReopening.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.STATUS_20_IN_PROGRESS,
        tasks: [mockTask],
      });

      await expect((service as any).validateReopeningPreconditions(1, 'tenant-123')).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if reopening task not found', async () => {
      caseRepository.findCaseForReopening.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
        tasks: [],
      });

      await expect((service as any).validateReopeningPreconditions(1, 'tenant-123')).rejects.toThrow(NotFoundException);
    });

    it('should return case data if all preconditions are met', async () => {
      const validCase = {
        ...mockCase,
        status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
        tasks: [mockTask],
      };
      caseRepository.findCaseForReopening.mockResolvedValue(validCase);

      const result = await (service as any).validateReopeningPreconditions(1, 'tenant-123');

      expect(result).toEqual(validCase);
    });
  });
});
