import { Test, TestingModule } from '@nestjs/testing';
import { CaseService } from '../src/modules/case/case.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { PrismaService } from '../prisma/prisma.service';
import { TaskService } from '../src/modules/task/task.service';
import { CommentService } from '../src/modules/comment/comment.service';
import { NotificationService } from '../src/modules/notification/notification.service';
import { CacheService } from '../src/modules/shared/cache.service';
import { CaseQueryService } from '../src/modules/case/services/case-query.service';
import { CaseReopeningService } from '../src/modules/case/services/case-reopening.service';
import { CaseClosureApprovalService } from '../src/modules/case/services/case-closure-approval.service';
import { CaseCreationApprovalService } from '../src/modules/case/services/case-creation-approval.service';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { AlertRepository } from '../src/modules/repository/alert.repository';
import { CaseRepository } from '../src/modules/repository/case.repository';
import { CaseCreationService } from '../src/modules/case/services/case-creation.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { CaseStatus, TaskStatus, CaseType, Priority, CaseCreationType, PredictionOutcome } from '@prisma/client-cms';

describe('CaseService', () => {
  let service: CaseService;
  let prismaService: jest.Mocked<PrismaService>;
  let caseQueryService: jest.Mocked<CaseQueryService>;
  let taskService: jest.Mocked<TaskService>;
  let commentService: jest.Mocked<CommentService>;
  let notificationService: jest.Mocked<NotificationService>;
  let cacheService: jest.Mocked<CacheService>;
  let caseReopeningService: jest.Mocked<CaseReopeningService>;
  let caseClosureApprovalService: jest.Mocked<CaseClosureApprovalService>;
  let caseCreationApprovalService: jest.Mocked<CaseCreationApprovalService>;
  let flowableService: jest.Mocked<FlowableService>;
  let alertRepository: jest.Mocked<AlertRepository>;
  let caseRepository: jest.Mocked<CaseRepository>;
  let caseCreationService: jest.Mocked<CaseCreationService>;
  let loggingOrchestrationService: jest.Mocked<LoggingOrchestrationService>;
  let logger: jest.Mocked<LoggerService>;

  const mockCase = {
    case_id: 1,
    tenant_id: 'tenant-123',
    case_owner_user_id: 'user-123',
    status: CaseStatus.STATUS_20_IN_PROGRESS,
    case_type: CaseType.FRAUD,
    priority: Priority.CRITICAL,
    parent_id: null,
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockTask = {
    task_id: 1,
    case_id: 1,
    name: 'Investigate Case',
    status: TaskStatus.STATUS_10_ASSIGNED,
    assignee_user_id: 'user-123',
    tenant_id: 'tenant-123',
  };

  beforeEach(async () => {
    const mockPrismaService = {
      $transaction: jest.fn(),
      case: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockCaseQueryService = {
      retrieveCase: jest.fn(),
      updateCase: jest.fn(),
      getAllCases: jest.fn(),
      getUserCases: jest.fn(),
      getUserWorkloadStats: jest.fn(),
      getSubCasesDetails: jest.fn(),
    };

    const mockTaskService = {
      getTasksByCaseId: jest.fn(),
      updateTask: jest.fn(),
      createTask: jest.fn(),
    };

    const mockCommentService = {
      addComment: jest.fn(),
    };

    const mockNotificationService = {
      createNotification: jest.fn(),
      sendNotification: jest.fn().mockResolvedValue({}),
    };

    const mockCacheService = {
      getUserFromCache: jest.fn().mockResolvedValue({ username: 'testuser', fullName: 'Test User' }),
    };

    const mockCaseReopeningService = {
      reopenCase: jest.fn(),
      approveCaseReopening: jest.fn(),
      rejectCaseReopening: jest.fn(),
    };

    const mockCaseClosureApprovalService = {
      closeCase: jest.fn(),
      approveCaseClosure: jest.fn(),
      rejectCaseClosure: jest.fn(),
      returnCaseForReview: jest.fn(),
    };

    const mockCaseCreationApprovalService = {
      manualCaseCreate: jest.fn(),
      approveCaseCreation: jest.fn(),
      rejectCaseCreation: jest.fn(),
      completeCase: jest.fn(),
      saveCaseAsDraft: jest.fn(),
    };

    const mockFlowableService = {
      handleCaseStatusChanged: jest.fn().mockResolvedValue({}),
      handleTaskCompleted: jest.fn().mockResolvedValue({}),
      handleCaseCreated: jest.fn().mockResolvedValue({}),
      handleCaseAbandoned: jest.fn().mockResolvedValue({}),
    };

    const mockAlertRepository = {
      getAlertByCaseId: jest.fn(),
      updateAlert: jest.fn(),
    };

    const mockCaseRepository = {
      findCase: jest.fn(),
      updateCase: jest.fn(),
    };

    const mockCaseCreationService = {
      createCaseWithInvestigationTask: jest.fn(),
    };

    const mockLoggingOrchestrationService = {
      logActionsWithHistory: jest.fn().mockResolvedValue({}),
      logActions: jest.fn().mockResolvedValue({}),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseService,
        { provide: LoggerService, useValue: mockLogger },
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: TaskService, useValue: mockTaskService },
        { provide: CommentService, useValue: mockCommentService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: CacheService, useValue: mockCacheService },
        { provide: CaseQueryService, useValue: mockCaseQueryService },
        { provide: CaseReopeningService, useValue: mockCaseReopeningService },
        { provide: CaseClosureApprovalService, useValue: mockCaseClosureApprovalService },
        { provide: CaseCreationApprovalService, useValue: mockCaseCreationApprovalService },
        { provide: FlowableService, useValue: mockFlowableService },
        { provide: AlertRepository, useValue: mockAlertRepository },
        { provide: CaseRepository, useValue: mockCaseRepository },
        { provide: CaseCreationService, useValue: mockCaseCreationService },
        { provide: LoggingOrchestrationService, useValue: mockLoggingOrchestrationService },
      ],
    }).compile();

    service = module.get<CaseService>(CaseService);
    prismaService = module.get(PrismaService);
    caseQueryService = module.get(CaseQueryService);
    taskService = module.get(TaskService);
    commentService = module.get(CommentService);
    notificationService = module.get(NotificationService);
    cacheService = module.get(CacheService);
    caseReopeningService = module.get(CaseReopeningService);
    caseClosureApprovalService = module.get(CaseClosureApprovalService);
    caseCreationApprovalService = module.get(CaseCreationApprovalService);
    flowableService = module.get(FlowableService);
    alertRepository = module.get(AlertRepository);
    caseRepository = module.get(CaseRepository);
    caseCreationService = module.get(CaseCreationService);
    loggingOrchestrationService = module.get(LoggingOrchestrationService);
    logger = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('suspendCase', () => {
    it('should successfully suspend a case as case owner', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([mockTask] as any);
      
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {
          case: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED }),
          },
        };
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_21_BLOCKED } as any);

      await service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', {}, 'investigator');

      expect(caseQueryService.retrieveCase).toHaveBeenCalledWith(1, 'tenant-123');
      expect(caseQueryService.updateCase).toHaveBeenCalledWith(1, { status: CaseStatus.STATUS_21_SUSPENDED }, 'user-123');
      expect(taskService.updateTask).toHaveBeenCalled();
      expect(commentService.addComment).toHaveBeenCalled();
    });

    it('should allow supervisor to suspend any case', async () => {
      const differentOwnerCase = { ...mockCase, case_owner_user_id: 'other-user' };
      caseQueryService.retrieveCase.mockResolvedValue(differentOwnerCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([mockTask] as any);
      
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {
          case: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({ ...differentOwnerCase, status: CaseStatus.STATUS_21_SUSPENDED }),
          },
        };
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue({ ...differentOwnerCase, status: CaseStatus.STATUS_21_SUSPENDED } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_21_BLOCKED } as any);

      await service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', {}, 'supervisor');

      expect(caseQueryService.updateCase).toHaveBeenCalled();
    });

    it('should throw BadRequestException if case not found', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(null as any);

      await expect(
        service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', {}, 'investigator')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if non-owner tries to suspend', async () => {
      const differentOwnerCase = { ...mockCase, case_owner_user_id: 'other-user' };
      caseQueryService.retrieveCase.mockResolvedValue(differentOwnerCase as any);

      await expect(
        service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', {}, 'investigator')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if case is not in progress', async () => {
      const draftCase = { ...mockCase, status: CaseStatus.STATUS_00_DRAFT };
      caseQueryService.retrieveCase.mockResolvedValue(draftCase as any);

      await expect(
        service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', {}, 'investigator')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if reason is empty', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockCase as any);

      await expect(
        service.suspendCase(1, '', [1], 'user-123', 'tenant-123', {}, 'investigator')
      ).rejects.toThrow(BadRequestException);
    });

    it('should handle empty task list for case', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([]);

      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {
          case: {
            update: jest.fn().mockResolvedValue(mockCase),
            findFirst: jest.fn().mockResolvedValue(null),
          },
        };
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_21_BLOCKED } as any);

      const result = await service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', {}, 'investigator');

      expect(result.case.status).toBe(CaseStatus.STATUS_21_SUSPENDED);
    });

    it('should suspend parent case if both subcases are suspended', async () => {
      const subCase = { ...mockCase, parent_id: 10 };
      caseQueryService.retrieveCase.mockResolvedValue(subCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([mockTask] as any);
      
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {
          case: {
            findFirst: jest.fn().mockResolvedValue({ ...subCase, status: CaseStatus.STATUS_21_SUSPENDED }),
            update: jest.fn().mockResolvedValue({ case_id: 10, status: CaseStatus.STATUS_21_SUSPENDED }),
          },
        };
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue({ ...subCase, status: CaseStatus.STATUS_21_SUSPENDED } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_21_BLOCKED } as any);

      await service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', {}, 'investigator');

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should send notification to assigned users when case is suspended', async () => {
      const taskWithAssignee = { ...mockTask, assigned_user_id: 'assigned-user-123' };
      caseQueryService.retrieveCase.mockResolvedValue(mockCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([taskWithAssignee] as any);
      
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {
          case: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED }),
          },
        };
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED } as any);
      taskService.updateTask.mockResolvedValue({ ...taskWithAssignee, status: TaskStatus.STATUS_21_BLOCKED } as any);
      cacheService.getUserFromCache.mockResolvedValue({ username: 'testuser', fullName: 'Test User' } as any);
      notificationService.sendNotification.mockResolvedValue({} as any);

      await service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', {}, 'investigator');

      expect(cacheService.getUserFromCache).toHaveBeenCalledWith('user-123');
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'assigned-user-123',
          type: 'CASE_SUSPENDED',
        })
      );
    });

    it('should handle notification failure gracefully', async () => {
      const taskWithAssignee = { ...mockTask, assigned_user_id: 'assigned-user-123' };
      caseQueryService.retrieveCase.mockResolvedValue(mockCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([taskWithAssignee] as any);
      
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {
          case: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED }),
          },
        };
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED } as any);
      taskService.updateTask.mockResolvedValue({ ...taskWithAssignee, status: TaskStatus.STATUS_21_BLOCKED } as any);
      cacheService.getUserFromCache.mockResolvedValue({ username: 'testuser', fullName: 'Test User' } as any);
      notificationService.sendNotification.mockRejectedValue(new Error('Notification service error'));

      const result = await service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', {}, 'investigator');

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to send suspension notification'));
    });
  });

  describe('resumeCase', () => {
    it('should successfully resume a suspended case', async () => {
      const suspendedCase = { ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED };
      caseQueryService.retrieveCase.mockResolvedValue(suspendedCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([{ ...mockTask, status: TaskStatus.STATUS_21_BLOCKED }] as any);
      
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {
          case: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({ ...suspendedCase, status: CaseStatus.STATUS_20_IN_PROGRESS }),
          },
        };
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue({ ...suspendedCase, status: CaseStatus.STATUS_20_IN_PROGRESS } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_10_ASSIGNED } as any);

      await service.resumeCase(1, 'Resume reason', 'user-123', 'tenant-123', {});

      expect(caseQueryService.updateCase).toHaveBeenCalledWith(1, { status: CaseStatus.STATUS_20_IN_PROGRESS }, 'user-123');
      expect(taskService.updateTask).toHaveBeenCalled();
    });

    it('should throw BadRequestException if case not found', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(null as any);

      await expect(
        service.resumeCase(1, 'Resume reason', 'user-123', 'tenant-123', {})
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if case is not suspended', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockCase as any);

      await expect(
        service.resumeCase(1, 'Resume reason', 'user-123', 'tenant-123', {})
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if reason is empty', async () => {
      const suspendedCase = { ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED };
      caseQueryService.retrieveCase.mockResolvedValue(suspendedCase as any);

      await expect(
        service.resumeCase(1, '', 'user-123', 'tenant-123', {})
      ).rejects.toThrow(BadRequestException);
    });

    it('should resume parent case if at least one subcase is resumed', async () => {
      const subCase = { ...mockCase, parent_id: 10, status: CaseStatus.STATUS_21_SUSPENDED };
      caseQueryService.retrieveCase.mockResolvedValue(subCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([{ ...mockTask, status: TaskStatus.STATUS_21_BLOCKED }] as any);
      
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {
          case: {
            findFirst: jest.fn().mockResolvedValue({ ...subCase, status: CaseStatus.STATUS_20_IN_PROGRESS }),
            update: jest.fn().mockResolvedValue({ case_id: 10, status: CaseStatus.STATUS_20_IN_PROGRESS }),
          },
        };
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue({ ...subCase, status: CaseStatus.STATUS_20_IN_PROGRESS } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_10_ASSIGNED } as any);

      await service.resumeCase(1, 'Resume reason', 'user-123', 'tenant-123', {});

      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should send notification to assigned users when case is resumed', async () => {
      const suspendedCase = { ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED };
      const taskWithAssignee = { ...mockTask, status: TaskStatus.STATUS_21_BLOCKED, assigned_user_id: 'assigned-user-123' };
      caseQueryService.retrieveCase.mockResolvedValue(suspendedCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([taskWithAssignee] as any);
      
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {
          case: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({ ...suspendedCase, status: CaseStatus.STATUS_20_IN_PROGRESS }),
          },
        };
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue({ ...suspendedCase, status: CaseStatus.STATUS_20_IN_PROGRESS } as any);
      taskService.updateTask.mockResolvedValue({ ...taskWithAssignee, status: TaskStatus.STATUS_20_IN_PROGRESS } as any);
      cacheService.getUserFromCache.mockResolvedValue({ username: 'testuser', email: 'test@example.com' } as any);
      notificationService.sendNotification.mockResolvedValue({} as any);

      await service.resumeCase(1, 'Resume reason', 'user-123', 'tenant-123', {});

      expect(cacheService.getUserFromCache).toHaveBeenCalledWith('user-123');
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'assigned-user-123',
          type: 'CASE_RESUMED',
        })
      );
    });

    it('should handle notification failure gracefully in resumeCase', async () => {
      const suspendedCase = { ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED };
      const taskWithAssignee = { ...mockTask, status: TaskStatus.STATUS_21_BLOCKED, assigned_user_id: 'assigned-user-123' };
      caseQueryService.retrieveCase.mockResolvedValue(suspendedCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([taskWithAssignee] as any);
      
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {
          case: {
            findFirst: jest.fn().mockResolvedValue(null),
            update: jest.fn().mockResolvedValue({ ...suspendedCase, status: CaseStatus.STATUS_20_IN_PROGRESS }),
          },
        };
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue({ ...suspendedCase, status: CaseStatus.STATUS_20_IN_PROGRESS } as any);
      taskService.updateTask.mockResolvedValue({ ...taskWithAssignee, status: TaskStatus.STATUS_20_IN_PROGRESS } as any);
      cacheService.getUserFromCache.mockResolvedValue({ username: 'testuser', email: 'test@example.com' } as any);
      notificationService.sendNotification.mockRejectedValue(new Error('Notification service error'));

      const result = await service.resumeCase(1, 'Resume reason', 'user-123', 'tenant-123', {});

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to send resumption notification'));
    });
  });

  describe('abandonCase', () => {
    it('should successfully abandon a case', async () => {
      const draftCase = { ...mockCase, status: CaseStatus.STATUS_00_DRAFT };
      caseQueryService.retrieveCase.mockResolvedValue(draftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 }
      ] as any);
      
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {};
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue({ ...draftCase, status: CaseStatus.STATUS_99_ABANDONED } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED } as any);

      await service.abandonCase(1, 'Abandon reason', 'user-123', 'tenant-123');

      expect(caseQueryService.updateCase).toHaveBeenCalledWith(1, { status: CaseStatus.STATUS_99_ABANDONED }, 'user-123');
      expect(commentService.addComment).toHaveBeenCalled();
      expect(taskService.updateTask).toHaveBeenCalled();
    });

    it('should throw BadRequestException if case not found', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(null as any);

      await expect(
        service.abandonCase(1, 'Abandon reason', 'user-123', 'tenant-123')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if reason is empty', async () => {
      const draftCase = { ...mockCase, status: CaseStatus.STATUS_00_DRAFT };
      caseQueryService.retrieveCase.mockResolvedValue(draftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 }
      ] as any);

      await expect(
        service.abandonCase(1, '', 'user-123', 'tenant-123')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('delegation methods', () => {
    it('should delegate saveCaseAsDraft to caseCreationApprovalService', async () => {
      const dto = { alertId: 1 } as any;
      caseCreationApprovalService.saveCaseAsDraft.mockResolvedValue({} as any);

      await service.saveCaseAsDraft(dto, 'user-123', 'tenant-123', 'investigator');

      expect(caseCreationApprovalService.saveCaseAsDraft).toHaveBeenCalledWith(dto, 'user-123', 'tenant-123', 'investigator');
    });

    it('should delegate reopenCase to caseReopeningService', async () => {
      caseReopeningService.reopenCase.mockResolvedValue({} as any);

      await service.reopenCase(1, 'reason', 'user-123', 'tenant-123', 'investigator');

      expect(caseReopeningService.reopenCase).toHaveBeenCalledWith(1, 'reason', 'user-123', 'tenant-123', 'investigator');
    });

    it('should delegate approveCaseReopening to caseReopeningService', async () => {
      caseReopeningService.approveCaseReopening.mockResolvedValue({} as any);

      await service.approveCaseReopening(1, 'supervisor-123', 'tenant-123');

      expect(caseReopeningService.approveCaseReopening).toHaveBeenCalledWith(1, 'supervisor-123', 'tenant-123');
    });

    it('should delegate rejectCaseReopening to caseReopeningService', async () => {
      caseReopeningService.rejectCaseReopening.mockResolvedValue({} as any);

      await service.rejectCaseReopening(1, 'reason', 'supervisor-123', 'tenant-123');

      expect(caseReopeningService.rejectCaseReopening).toHaveBeenCalledWith(1, 'reason', 'supervisor-123', 'tenant-123');
    });

    it('should delegate closeCase to caseClosureApprovalService', async () => {
      const dto = {} as any;
      caseClosureApprovalService.closeCase.mockResolvedValue({} as any);

      await service.closeCase(1, dto, 'user-123', 'tenant-123', 'investigator');

      expect(caseClosureApprovalService.closeCase).toHaveBeenCalledWith(1, dto, 'user-123', 'tenant-123', 'investigator');
    });

    it('should delegate approveCaseClosure to caseClosureApprovalService', async () => {
      caseClosureApprovalService.approveCaseClosure.mockResolvedValue({} as any);

      await service.approveCaseClosure(1, 'outcome', 'comments', 'supervisor-123', 'tenant-123');

      expect(caseClosureApprovalService.approveCaseClosure).toHaveBeenCalledWith(1, 'outcome', 'comments', 'supervisor-123', 'tenant-123');
    });

    it('should delegate rejectCaseClosure to caseClosureApprovalService', async () => {
      caseClosureApprovalService.rejectCaseClosure.mockResolvedValue({} as any);

      await service.rejectCaseClosure(1, 'comments', 'supervisor-123', 'tenant-123');

      expect(caseClosureApprovalService.rejectCaseClosure).toHaveBeenCalledWith(1, 'comments', 'supervisor-123', 'tenant-123');
    });

    it('should delegate returnCaseForReview to caseClosureApprovalService', async () => {
      caseClosureApprovalService.returnCaseForReview.mockResolvedValue({} as any);

      await service.returnCaseForReview(1, 'comments', 'supervisor-123', 'tenant-123');

      expect(caseClosureApprovalService.returnCaseForReview).toHaveBeenCalledWith(1, 'comments', 'supervisor-123', 'tenant-123');
    });

    it('should delegate manualCaseCreate to caseCreationApprovalService', async () => {
      const dto = {} as any;
      caseCreationApprovalService.manualCaseCreate.mockResolvedValue({} as any);

      await service.manualCaseCreate(dto, 'user-123', 'tenant-123', 'investigator');

      expect(caseCreationApprovalService.manualCaseCreate).toHaveBeenCalledWith(dto, 'user-123', 'tenant-123', 'investigator');
    });

    it('should delegate approveCaseCreation to caseCreationApprovalService', async () => {
      caseCreationApprovalService.approveCaseCreation.mockResolvedValue({} as any);

      await service.approveCaseCreation(1, 'supervisor-123', 'tenant-123');

      expect(caseCreationApprovalService.approveCaseCreation).toHaveBeenCalledWith(1, 'supervisor-123', 'tenant-123');
    });

    it('should delegate rejectCaseCreation to caseCreationApprovalService', async () => {
      caseCreationApprovalService.rejectCaseCreation.mockResolvedValue({} as any);

      await service.rejectCaseCreation(1, 'supervisor-123', 'tenant-123', 'reason');

      expect(caseCreationApprovalService.rejectCaseCreation).toHaveBeenCalledWith(1, 'supervisor-123', 'tenant-123', 'reason');
    });

    it('should delegate completeCase to caseCreationApprovalService', async () => {
      caseCreationApprovalService.completeCase.mockResolvedValue({} as any);

      await service.completeCase(1, 'user-123', 'tenant-123');

      expect(caseCreationApprovalService.completeCase).toHaveBeenCalledWith(1, 'user-123', 'tenant-123');
    });

    it('should delegate getAllCases to caseQueryService', async () => {
      const query = {} as any;
      caseQueryService.getAllCases.mockResolvedValue({} as any);

      await service.getAllCases(query, 'tenant-123', 'user-123', false);

      expect(caseQueryService.getAllCases).toHaveBeenCalledWith(query, 'tenant-123', 'user-123', false);
    });

    it('should delegate getUserCases to caseQueryService', async () => {
      const query = {} as any;
      caseQueryService.getUserCases.mockResolvedValue({} as any);

      await service.getUserCases('user-123', query, false);

      expect(caseQueryService.getUserCases).toHaveBeenCalledWith('user-123', query, false);
    });

    it('should delegate getUserWorkloadStats to caseQueryService', async () => {
      caseQueryService.getUserWorkloadStats.mockResolvedValue({} as any);

      await service.getUserWorkloadStats('user-123', false);

      expect(caseQueryService.getUserWorkloadStats).toHaveBeenCalledWith('user-123', false);
    });

    it('should delegate updateCase to caseQueryService', async () => {
      const updateData = { priority: Priority.CRITICAL } as any;
      caseQueryService.updateCase.mockResolvedValue({} as any);

      await service.updateCase(1, updateData, 'user-123');

      expect(caseQueryService.updateCase).toHaveBeenCalledWith(1, updateData, 'user-123');
    });

    it('should delegate retrieveCase to caseQueryService', async () => {
      caseQueryService.retrieveCase.mockResolvedValue({} as any);

      await service.retrieveCase(1, 'tenant-123', false);

      expect(caseQueryService.retrieveCase).toHaveBeenCalledWith(1, 'tenant-123', false);
    });

    it('should delegate getSubCasesDetails to caseQueryService', async () => {
      caseQueryService.getSubCasesDetails.mockResolvedValue({} as any);

      await service.getSubCasesDetails(1);

      expect(caseQueryService.getSubCasesDetails).toHaveBeenCalledWith(1);
    });
  });

  describe('completeCaseCreation', () => {
    const updateData = {
      priority: Priority.CRITICAL,
      caseType: CaseType.FRAUD,
      note: 'Test note',
      priorityScore: 85,
      predictionOutcome: PredictionOutcome.TRUE_POSITIVE,
      confidence: 95,
    };

    const mockDraftCase = {
      ...mockCase,
      status: CaseStatus.STATUS_00_DRAFT,
      priority: null,
      case_type: null,
    };

    it('should complete case creation by investigator with approval required', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockDraftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 }
      ] as any);
      const updatedCase = { ...mockDraftCase, ...updateData, status: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL };

      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {};
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue(updatedCase as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED } as any);
      taskService.createTask.mockResolvedValue({ task_id: 2, name: 'Approve Case Creation' } as any);
      alertRepository.getAlertByCaseId.mockResolvedValue(0 as any);

      const result = await service.completeCaseCreation(1, updateData, 'user-123', 'tenant-123', 'investigator');

      expect(result.requiresApproval).toBe(true);
      expect(result.message).toContain('pending supervisor approval');
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Approve Case Creation' }),
        'user-123',
        'tenant-123'
      );
    });

    it('should complete case creation by supervisor without approval', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockDraftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 }
      ] as any);
      const updatedCase = { ...mockDraftCase, ...updateData, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT };

      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {};
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue(updatedCase as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED } as any);
      taskService.createTask.mockResolvedValue({ task_id: 2, name: 'Investigate Case' } as any);
      alertRepository.getAlertByCaseId.mockResolvedValue(undefined as any);

      const result = await service.completeCaseCreation(1, updateData as any, 'user-123', 'tenant-123', 'SUPERVISOR');

      expect(result.requiresApproval).toBe(false);
      expect(result.message).toContain('ready for investigation');
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Investigate Case' }),
        'user-123',
        'tenant-123'
      );
    });

    it('should handle FRAUD_AND_AML case type for supervisor', async () => {
      const fraudAmlData = { ...updateData, caseType: CaseType.FRAUD_AND_AML };
      const fraudAmlCase = { ...mockDraftCase, case_type: CaseType.FRAUD_AND_AML };
      caseQueryService.retrieveCase.mockResolvedValue(fraudAmlCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 }
      ] as any);
      const updatedCase = { ...fraudAmlCase, ...fraudAmlData, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT };

      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {};
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue(updatedCase as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED } as any);
      alertRepository.getAlertByCaseId.mockResolvedValue(undefined as any);

      await service.completeCaseCreation(1, fraudAmlData as any, 'user-123', 'tenant-123', 'SUPERVISOR');

      expect(caseCreationService.createCaseWithInvestigationTask).toHaveBeenCalledTimes(2);
      expect(caseCreationService.createCaseWithInvestigationTask).toHaveBeenCalledWith(
        CaseType.FRAUD,
        'user-123',
        'tenant-123',
        1,
        Priority.CRITICAL
      );
      expect(caseCreationService.createCaseWithInvestigationTask).toHaveBeenCalledWith(
        CaseType.AML,
        'user-123',
        'tenant-123',
        1,
        Priority.CRITICAL
      );
    });

    it('should throw BadRequestException if case not found', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(null as any);

      await expect(
        service.completeCaseCreation(1, updateData as any, 'user-123', 'tenant-123', 'investigator')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if case is not in DRAFT status', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockCase as any);

      await expect(
        service.completeCaseCreation(1, updateData as any, 'user-123', 'tenant-123', 'investigator')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if missing required fields', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockDraftCase as any);

      await expect(
        service.completeCaseCreation(1, { note: 'test' } as any, 'user-123', 'tenant-123', 'investigator')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException if Complete New Case task not found', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockDraftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([]);

      await expect(
        service.completeCaseCreation(1, updateData as any, 'user-123', 'tenant-123', 'investigator')
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should throw InternalServerErrorException if Complete New Case task already completed', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockDraftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_30_COMPLETED, task_id: 1 }
      ] as any);

      await expect(
        service.completeCaseCreation(1, updateData as any, 'user-123', 'tenant-123', 'investigator')
      ).rejects.toThrow(InternalServerErrorException);
    });

    it('should update alert if exists', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockDraftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 }
      ] as any);
      const updatedCase = { ...mockDraftCase, ...updateData, status: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL };

      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {};
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
      caseQueryService.updateCase.mockResolvedValue(updatedCase as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED, task_id: 1 } as any);
      taskService.createTask.mockResolvedValue({ task_id: 2 } as any);
      alertRepository.getAlertByCaseId.mockResolvedValue(100);
      alertRepository.updateAlert.mockResolvedValue({} as any);

      await service.completeCaseCreation(1, updateData as any, 'user-123', 'tenant-123', 'investigator');

      expect(alertRepository.updateAlert).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          priority_score: 85,
          priority: Priority.CRITICAL,
          alertType: CaseType.FRAUD,
        })
      );
    });

    it('should throw InternalServerErrorException on transaction failure', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockDraftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 }
      ] as any);

      const mockTransaction = jest.fn(async () => {
        throw new Error('Transaction failed');
      });
      prismaService.$transaction.mockImplementation(mockTransaction);

      await expect(
        service.completeCaseCreation(1, updateData as any, 'user-123', 'tenant-123', 'investigator')
      ).rejects.toThrow(InternalServerErrorException);
    });
  });
});
