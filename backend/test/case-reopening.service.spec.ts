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
      createCase: jest.fn(),
      updateCase: jest.fn(),
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

    it('should successfully reopen case as supervisor', async () => {
      const role = 'CMS_SUPERVISOR';
      caseQueryService.retrieveCase.mockResolvedValueOnce(mockCase);
      
      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update.mockResolvedValueOnce({ ...mockCase, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT });
        return callback(prismaService);
      });

      taskService.createTask.mockResolvedValueOnce({
        task_id: 2,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      const result = await service.reopenCase(1, reason, userId, tenantId, role);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Case reopened successfully');
      expect(result.investigation_task).toBeDefined();
      expect(prismaService.case.update).toHaveBeenCalled();
      expect(taskService.createTask).toHaveBeenCalled();
      expect(flowableService.handleCaseStatusChanged).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should successfully reopen case with parent case as supervisor', async () => {
      const role = 'CMS_SUPERVISOR';
      const caseWithParent = { ...mockCase, parent_id: 100 };
      const parentCase = { ...mockCase, case_id: 100, status: CaseStatus.STATUS_81_CLOSED_REFUTED };
      
      caseQueryService.retrieveCase
        .mockResolvedValueOnce(caseWithParent)
        .mockResolvedValueOnce(parentCase);
      
      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update
          .mockResolvedValueOnce({ ...caseWithParent, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT })
          .mockResolvedValueOnce({ ...parentCase, status: CaseStatus.STATUS_20_IN_PROGRESS });
        return callback(prismaService);
      });

      taskService.createTask.mockResolvedValueOnce({
        task_id: 2,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      const result = await service.reopenCase(1, reason, userId, tenantId, role);

      expect(result.success).toBe(true);
      expect(prismaService.case.update).toHaveBeenCalledTimes(2);
    });

    it('should create approval task for non-supervisor investigator', async () => {
      const role = 'CMS_ANALYST';
      caseQueryService.retrieveCase.mockResolvedValueOnce(mockCase);
      
      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update.mockResolvedValueOnce({ 
          ...mockCase, 
          status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL 
        });
        return callback(prismaService);
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
      expect(commentRepository.createComment).toHaveBeenCalled();
    });

    it('should throw error if case is not in reopenable state', async () => {
      const role = 'CMS_ANALYST';
      const inProgressCase = { ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS };
      caseQueryService.retrieveCase.mockResolvedValueOnce(inProgressCase);

      await expect(service.reopenCase(1, reason, userId, tenantId, role)).rejects.toThrow(BadRequestException);
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'FAILURE' })
      );
    });

    it('should throw error if parent case is not in reopenable state', async () => {
      const role = 'CMS_ANALYST';
      const caseWithParent = { ...mockCase, parent_id: 100 };
      const parentCase = { ...mockCase, case_id: 100, status: CaseStatus.STATUS_20_IN_PROGRESS };
      
      caseQueryService.retrieveCase
        .mockResolvedValueOnce(caseWithParent)
        .mockResolvedValueOnce(parentCase);

      await expect(service.reopenCase(1, reason, userId, tenantId, role)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if reason is too short', async () => {
      const role = 'CMS_ANALYST';
      const shortReason = 'no'; // 2 characters, less than MIN_REOPENING_REASON (4)
      caseQueryService.retrieveCase.mockResolvedValueOnce(mockCase);

      await expect(service.reopenCase(1, shortReason, userId, tenantId, role)).rejects.toThrow(BadRequestException);
    });

    it('should throw error if reason is empty', async () => {
      const role = 'CMS_ANALYST';
      const emptyReason = '';
      caseQueryService.retrieveCase.mockResolvedValueOnce(mockCase);

      await expect(service.reopenCase(1, emptyReason, userId, tenantId, role)).rejects.toThrow(BadRequestException);
    });

    it('should handle errors during reopening', async () => {
      const role = 'CMS_SUPERVISOR';
      caseQueryService.retrieveCase.mockRejectedValueOnce(new Error('Database error'));

      await expect(service.reopenCase(1, reason, userId, tenantId, role)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'FAILURE' })
      );
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

    it('should approve reopening and assign to original requester (analyst)', async () => {
      // Override the mock to use ANALYST role (recognized by isInvestigatorRole)
      const taskWithAnalystRole = {
        ...mockTask,
        comments: [
          {
            comment_id: 1,
            note: JSON.stringify({
              requestedBy: 'user-123',
              requesterRole: 'ANALYST', // Use uppercase ANALYST which is recognized
              reason: 'New evidence found',
            }),
          },
        ],
      };
      caseRepository.findUnassignedTaskForReopening.mockResolvedValueOnce(taskWithAnalystRole);

      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update.mockResolvedValueOnce({
          ...mockCase,
          status: CaseStatus.STATUS_10_ASSIGNED,
          case_owner_user_id: 'user-123',
        });
        prismaService.task.update.mockResolvedValueOnce({
          ...mockTask,
          status: TaskStatus.STATUS_30_COMPLETED,
        });
        return callback(prismaService);
      });

      taskService.createTask.mockResolvedValueOnce({
        task_id: 3,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_10_ASSIGNED,
        assigned_user_id: 'user-123',
      });

      notificationService.sendNotification.mockResolvedValueOnce({});

      const result = await service.approveCaseReopening(1, supervisorId, tenantId);

      expect(result.success).toBe(true);
      expect(result.investigation_task.assigned_to).toBe('user-123');
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          type: 'CASE_REOPENED_ASSIGNED',
        })
      );
    });

    it('should approve reopening and assign to investigations queue (non-investigator)', async () => {
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

      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update.mockResolvedValueOnce({
          ...mockCase,
          status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          case_owner_user_id: null,
        });
        prismaService.task.update.mockResolvedValueOnce({
          ...mockTask,
          status: TaskStatus.STATUS_30_COMPLETED,
        });
        return callback(prismaService);
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

      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update
          .mockResolvedValueOnce({
            ...caseWithParent,
            status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
          })
          .mockResolvedValueOnce({
            case_id: 100,
            status: CaseStatus.STATUS_20_IN_PROGRESS,
          });
        
        prismaService.case.findFirst.mockResolvedValueOnce({
          case_id: 2,
          parent_id: 100,
          status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
        });

        prismaService.task.update.mockResolvedValueOnce({
          ...mockTask,
          status: TaskStatus.STATUS_30_COMPLETED,
        });
        return callback(prismaService);
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
        comments: [
          {
            comment_id: 1,
            note: 'Invalid JSON',
          },
        ],
      };
      caseRepository.findUnassignedTaskForReopening.mockResolvedValue(taskWithInvalidJson);

      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update.mockResolvedValueOnce({
          ...mockCase,
          status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        });
        prismaService.task.update.mockResolvedValueOnce({
          ...mockTask,
          status: TaskStatus.STATUS_30_COMPLETED,
        });
        return callback(prismaService);
      });

      taskService.createTask.mockResolvedValueOnce({
        task_id: 3,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      notificationService.sendGroupNotification.mockResolvedValueOnce({});

      const result = await service.approveCaseReopening(1, supervisorId, tenantId);

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse reopening metadata'),
        expect.any(String),
        'CaseReopeningService'
      );
    });

    it('should handle notification errors gracefully for assigned user', async () => {
      // Override the mock to use ANALYST role (recognized by isInvestigatorRole)
      const taskWithAnalystRole = {
        ...mockTask,
        comments: [
          {
            comment_id: 1,
            note: JSON.stringify({
              requestedBy: 'user-123',
              requesterRole: 'ANALYST', // Use uppercase ANALYST which is recognized
              reason: 'New evidence found',
            }),
          },
        ],
      };
      caseRepository.findUnassignedTaskForReopening.mockResolvedValueOnce(taskWithAnalystRole);

      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update.mockResolvedValueOnce({
          ...mockCase,
          status: CaseStatus.STATUS_10_ASSIGNED,
          case_owner_user_id: 'user-123',
        });
        prismaService.task.update.mockResolvedValueOnce({
          ...mockTask,
          status: TaskStatus.STATUS_30_COMPLETED,
        });
        return callback(prismaService);
      });

      taskService.createTask.mockResolvedValueOnce({
        task_id: 3,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_10_ASSIGNED,
        assigned_user_id: 'user-123',
      });

      notificationService.sendNotification.mockRejectedValueOnce(new Error('Notification failed'));

      const result = await service.approveCaseReopening(1, supervisorId, tenantId);

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send analyst notification'),
        expect.any(String),
        'CaseReopeningService'
      );
    });

    it('should handle notification errors gracefully for group', async () => {
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

      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update.mockResolvedValueOnce({
          ...mockCase,
          status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        });
        prismaService.task.update.mockResolvedValueOnce({
          ...mockTask,
          status: TaskStatus.STATUS_30_COMPLETED,
        });
        return callback(prismaService);
      });

      taskService.createTask.mockResolvedValueOnce({
        task_id: 3,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      notificationService.sendGroupNotification.mockRejectedValueOnce(new Error('Notification failed'));

      const result = await service.approveCaseReopening(1, supervisorId, tenantId);

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send group notification'),
        expect.any(String),
        'CaseReopeningService'
      );
    });

    it('should throw error if case not found', async () => {
      caseRepository.findCaseForReopening.mockResolvedValue(null);

      await expect(service.approveCaseReopening(1, supervisorId, tenantId)).rejects.toThrow(NotFoundException);
    });

    it('should throw error if case not in pending reopening state', async () => {
      caseRepository.findCaseForReopening.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.STATUS_20_IN_PROGRESS,
        tasks: [mockTask],
      });

      await expect(service.approveCaseReopening(1, supervisorId, tenantId)).rejects.toThrow(ConflictException);
    });

    it('should throw error if reopening task not found', async () => {
      caseRepository.findUnassignedTaskForReopening.mockResolvedValue(null);

      await expect(service.approveCaseReopening(1, supervisorId, tenantId)).rejects.toThrow(NotFoundException);
    });

    it('should handle errors during approval', async () => {
      caseRepository.findCaseForReopening.mockRejectedValue(new Error('Database error'));

      await expect(service.approveCaseReopening(1, supervisorId, tenantId)).rejects.toThrow('Database error');
      expect(logger.error).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'FAILURE' })
      );
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
      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update.mockResolvedValueOnce({
          ...mockCase,
          status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
        });
        prismaService.task.update.mockResolvedValueOnce({
          ...mockTask,
          status: TaskStatus.STATUS_30_COMPLETED,
        });
        return callback(prismaService);
      });

      notificationService.sendNotification.mockResolvedValueOnce({});

      const result = await service.rejectCaseReopening(1, rejectionReason, supervisorId, tenantId);

      expect(result.success).toBe(true);
      expect(result.message).toBe('Case reopening rejected');
      expect(result.case.status).toBe(CaseStatus.STATUS_82_CLOSED_CONFIRMED);
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          type: 'CASE_REOPENING_REJECTED',
        })
      );
    });

    it('should throw error if rejection reason is too short', async () => {
      const shortReason = 'no'; // 2 characters, less than MIN_REJECTION_REASON (4)

      await expect(service.rejectCaseReopening(1, shortReason, supervisorId, tenantId)).rejects.toThrow(
        BadRequestException
      );
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'FAILURE' })
      );
    });

    it('should throw error if rejection reason is empty', async () => {
      const emptyReason = '';

      await expect(service.rejectCaseReopening(1, emptyReason, supervisorId, tenantId)).rejects.toThrow(
        BadRequestException
      );
    });

    it('should handle parse errors in reopening metadata', async () => {
      const taskWithInvalidJson = {
        ...mockTask,
        comments: [
          {
            comment_id: 1,
            note: 'Invalid JSON',
          },
        ],
      };
      caseRepository.findReopeningTaskForRejection.mockResolvedValue(taskWithInvalidJson);

      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update.mockResolvedValueOnce({
          ...mockCase,
          status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
        });
        prismaService.task.update.mockResolvedValueOnce({
          ...mockTask,
          status: TaskStatus.STATUS_30_COMPLETED,
        });
        return callback(prismaService);
      });

      const result = await service.rejectCaseReopening(1, rejectionReason, supervisorId, tenantId);

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to parse reopening metadata'),
        expect.any(String),
        'CaseReopeningService'
      );
    });

    it('should restore case to STATUS_81_CLOSED_REFUTED', async () => {
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

      const refutedCase = {
        ...mockCase,
        status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
        originalClosedStatus: CaseStatus.STATUS_81_CLOSED_REFUTED,
        tasks: [reopeningTask], // Include the reopening task
      };
      caseRepository.findCaseForReopening.mockResolvedValue(refutedCase);

      // Mock findReopeningTaskForRejection
      caseRepository.findReopeningTaskForRejection.mockResolvedValueOnce(reopeningTask);

      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update.mockResolvedValueOnce({
          ...mockCase,
          status: CaseStatus.STATUS_81_CLOSED_REFUTED,
        });
        prismaService.task.update.mockResolvedValueOnce({
          ...mockTask,
          status: TaskStatus.STATUS_30_COMPLETED,
        });
        return callback(prismaService);
      });

      notificationService.sendNotification.mockResolvedValueOnce({});

      const result = await service.rejectCaseReopening(1, rejectionReason, supervisorId, tenantId);

      expect(result.success).toBe(true);
    });

    it('should restore case to STATUS_83_CLOSED_INCONCLUSIVE', async () => {
      const reopeningTask = {
        ...mockTask,
        name: 'Approve Case Reopening',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        comments: [
          {
            comment_id: 1,
            note: JSON.stringify({
              requestedBy: 'user-456',
              reason: 'Review needed',
            }),
          },
        ],
      };

      const inconclusiveCase = {
        ...mockCase,
        status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL,
        originalClosedStatus: CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
        tasks: [reopeningTask], // Include the reopening task
      };
      caseRepository.findCaseForReopening.mockResolvedValue(inconclusiveCase);

      // Mock findReopeningTaskForRejection
      caseRepository.findReopeningTaskForRejection.mockResolvedValueOnce(reopeningTask);

      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update.mockResolvedValueOnce({
          ...mockCase,
          status: CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
        });
        prismaService.task.update.mockResolvedValueOnce({
          ...mockTask,
          status: TaskStatus.STATUS_30_COMPLETED,
        });
        return callback(prismaService);
      });

      notificationService.sendNotification.mockResolvedValueOnce({});

      const result = await service.rejectCaseReopening(1, rejectionReason, supervisorId, tenantId);

      expect(result.success).toBe(true);
    });

    it('should handle notification errors gracefully', async () => {
      prismaService.$transaction.mockImplementationOnce(async (callback) => {
        prismaService.case.update.mockResolvedValueOnce({
          ...mockCase,
          status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
        });
        prismaService.task.update.mockResolvedValueOnce({
          ...mockTask,
          status: TaskStatus.STATUS_30_COMPLETED,
        });
        return callback(prismaService);
      });

      notificationService.sendNotification.mockRejectedValueOnce(new Error('Notification failed'));

      const result = await service.rejectCaseReopening(1, rejectionReason, supervisorId, tenantId);

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to send rejection notification'),
        expect.any(String),
        'CaseReopeningService'
      );
    });

    it('should throw error if case not found', async () => {
      caseRepository.findCaseForReopening.mockResolvedValue(null);

      await expect(service.rejectCaseReopening(1, rejectionReason, supervisorId, tenantId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should throw error if reopening task not found', async () => {
      caseRepository.findReopeningTaskForRejection.mockResolvedValue(null);

      await expect(service.rejectCaseReopening(1, rejectionReason, supervisorId, tenantId)).rejects.toThrow(
        NotFoundException
      );
    });

    it('should handle errors during rejection', async () => {
      caseRepository.findCaseForReopening.mockRejectedValue(new Error('Database error'));

      await expect(service.rejectCaseReopening(1, rejectionReason, supervisorId, tenantId)).rejects.toThrow(
        'Database error'
      );
      expect(logger.error).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({ outcome: 'FAILURE' })
      );
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
