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
import { RbacService, EndpointKey } from '../src/utils/rbac/rbacHelper';
import { AuthenticatedUser } from '../src/utils/types/auth.types';

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

  const mockRbacService = {
    getRoleFromUser: jest.fn().mockReturnValue('CMS_INVESTIGATOR'),
    checkTier2: jest.fn().mockReturnValue({ allowed: true }),
    checkTier3: jest.fn().mockReturnValue({ allowed: true }),
  };

  const mockUser: AuthenticatedUser = {
    token: {} as any,
    validated: {} as any,
    validClaims: [],
    tenantId: 'tenant-123',
    userId: 'user-123',
    actorRole: 'CMS_INVESTIGATOR',
    actorName: 'Test User',
    actorEmail: 'test@example.com',
    tenantName: 'Test Tenant',
  };

  const mockSupervisorUser: AuthenticatedUser = {
    token: {} as any,
    validated: {} as any,
    validClaims: [],
    tenantId: 'tenant-123',
    userId: 'supervisor-123',
    actorRole: 'CMS_SUPERVISOR',
    actorName: 'Supervisor User',
    actorEmail: 'supervisor@example.com',
    tenantName: 'Test Tenant',
  };

  // Production endpoint keys from case.controller.ts
  const suspendEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId/suspend' as EndpointKey;
  const resumeEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId/resume' as EndpointKey;
  const abandonEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId/abandon' as EndpointKey;
  const reopenEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId/reopen' as EndpointKey;
  const closeEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId/close' as EndpointKey;
  const approveClosureEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId/approve' as EndpointKey;
  const rejectClosureEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId/reject' as EndpointKey;
  const returnForReviewEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId/return-for-review' as EndpointKey;
  const approveCreationEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId/approve-creation' as EndpointKey;
  const rejectCreationEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId/reject-creation' as EndpointKey;
  const approveReopeningEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId/approve-reopening' as EndpointKey;
  const rejectReopeningEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId/reject-reopening' as EndpointKey;
  const completeCaseEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId/complete' as EndpointKey;
  const updateCaseEndpoint: EndpointKey = 'PUT /api/v1/cases/:caseId' as EndpointKey;
  const completeCaseCreationEndpoint: EndpointKey = 'POST /api/v1/cases/:caseId/complete-case-creation' as EndpointKey;

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
        { provide: RbacService, useValue: mockRbacService },
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

    // Default: retrieveCase returns a valid case so delegation tests don't hit BadRequestException
    caseQueryService.retrieveCase.mockResolvedValue(mockCase as any);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('suspendCase', () => {
    const setupMockTransaction = (findFirstResult: any = null, updateResult: any = null) => {
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {
          case: {
            findFirst: jest.fn().mockResolvedValue(findFirstResult),
            update: jest.fn().mockResolvedValue(updateResult || { ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED }),
          },
        };
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
    };

    it('should successfully suspend a case as case owner', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([mockTask] as any);
      setupMockTransaction();
      caseQueryService.updateCase.mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_21_BLOCKED } as any);

      await service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', mockUser, suspendEndpoint);

      expect(caseQueryService.retrieveCase).toHaveBeenCalledWith(1, 'tenant-123');
      expect(caseQueryService.updateCase).toHaveBeenCalledWith(1, { status: CaseStatus.STATUS_21_SUSPENDED }, 'user-123');
      expect(taskService.updateTask).toHaveBeenCalled();
      expect(commentService.addComment).toHaveBeenCalled();
    });

    it('should allow supervisor to suspend any case', async () => {
      const differentOwnerCase = { ...mockCase, case_owner_user_id: 'other-user' };
      caseQueryService.retrieveCase.mockResolvedValue(differentOwnerCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([mockTask] as any);
      setupMockTransaction(null, { ...differentOwnerCase, status: CaseStatus.STATUS_21_SUSPENDED });
      caseQueryService.updateCase.mockResolvedValue({ ...differentOwnerCase, status: CaseStatus.STATUS_21_SUSPENDED } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_21_BLOCKED } as any);

      await service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', mockSupervisorUser, suspendEndpoint);

      expect(caseQueryService.updateCase).toHaveBeenCalled();
    });

    it.each([
      { name: 'case not found', retrieveResult: null, message: 'Case not found' },
      { name: 'non-owner tries to suspend', retrieveResult: { ...mockCase, case_owner_user_id: 'other-user' }, message: 'Only Case owner' },
      { name: 'reason is empty', retrieveResult: mockCase, message: 'Reason for suspension is required', reason: '' },
    ])('should throw BadRequestException if $name', async ({ retrieveResult, message, reason = 'Test reason' }) => {
      caseQueryService.retrieveCase.mockResolvedValue(retrieveResult as any);

      await expect(service.suspendCase(1, reason, [1], 'user-123', 'tenant-123', mockUser, suspendEndpoint)).rejects.toThrow(message);
    });

    it('should throw BadRequestException if no matching tasks found', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([]);

      await expect(service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', mockUser, suspendEndpoint)).rejects.toThrow(
        'No "Investigate Case" task found for this case',
      );
    });

    it('should suspend only the subcase when the case has a parent', async () => {
      const subCase = { ...mockCase, parent_id: 10 };
      const txCase = {
        findFirst: jest.fn(),
        update: jest.fn(),
      };
      caseQueryService.retrieveCase.mockResolvedValue(subCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([mockTask] as any);
      prismaService.$transaction.mockImplementationOnce(async (callback) => callback({ case: txCase } as any));
      caseQueryService.updateCase.mockResolvedValue({ ...subCase, status: CaseStatus.STATUS_21_SUSPENDED } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_21_BLOCKED } as any);

      await service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', mockUser, suspendEndpoint);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(caseQueryService.updateCase).toHaveBeenCalledWith(1, { status: CaseStatus.STATUS_21_SUSPENDED }, 'user-123');
      expect(txCase.findFirst).not.toHaveBeenCalled();
      expect(txCase.update).not.toHaveBeenCalled();
    });

    it('should send notification to assigned users when case is suspended', async () => {
      const taskWithAssignee = { ...mockTask, assigned_user_id: 'assigned-user-123' };
      caseQueryService.retrieveCase.mockResolvedValue(mockCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([taskWithAssignee] as any);
      setupMockTransaction();
      caseQueryService.updateCase.mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED } as any);
      taskService.updateTask.mockResolvedValue({ ...taskWithAssignee, status: TaskStatus.STATUS_21_BLOCKED } as any);
      cacheService.getUserFromCache.mockResolvedValue({ username: 'testuser', fullName: 'Test User' } as any);
      notificationService.sendNotification.mockResolvedValue({} as any);

      await service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', mockUser, suspendEndpoint);

      expect(cacheService.getUserFromCache).toHaveBeenCalledWith('user-123');
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'assigned-user-123',
          type: 'CASE_SUSPENDED',
        }),
      );
    });

    it('should handle notification failure gracefully', async () => {
      const taskWithAssignee = { ...mockTask, assigned_user_id: 'assigned-user-123' };
      caseQueryService.retrieveCase.mockResolvedValue(mockCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([taskWithAssignee] as any);
      setupMockTransaction();
      caseQueryService.updateCase.mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED } as any);
      taskService.updateTask.mockResolvedValue({ ...taskWithAssignee, status: TaskStatus.STATUS_21_BLOCKED } as any);
      cacheService.getUserFromCache.mockResolvedValue({ username: 'testuser', fullName: 'Test User' } as any);
      notificationService.sendNotification.mockRejectedValue(new Error('Notification service error'));

      const result = await service.suspendCase(1, 'Test reason', [1], 'user-123', 'tenant-123', mockUser, suspendEndpoint);

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to send suspension notification'));
    });
  });

  describe('resumeCase', () => {
    const setupMockTransaction = (findFirstResult: any = null, updateResult: any = null) => {
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {
          case: {
            findFirst: jest.fn().mockResolvedValue(findFirstResult),
            update: jest.fn().mockResolvedValue(updateResult || { ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS }),
          },
        };
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
    };

    it('should successfully resume a suspended case', async () => {
      const suspendedCase = { ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED };
      caseQueryService.retrieveCase.mockResolvedValue(suspendedCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([{ ...mockTask, status: TaskStatus.STATUS_21_BLOCKED }] as any);
      setupMockTransaction(null, { ...suspendedCase, status: CaseStatus.STATUS_20_IN_PROGRESS });
      caseQueryService.updateCase.mockResolvedValue({ ...suspendedCase, status: CaseStatus.STATUS_20_IN_PROGRESS } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_10_ASSIGNED } as any);

      await service.resumeCase(1, 'Resume reason', 'user-123', 'tenant-123', {}, mockUser, resumeEndpoint);

      expect(caseQueryService.updateCase).toHaveBeenCalledWith(1, { status: CaseStatus.STATUS_20_IN_PROGRESS }, 'user-123');
      expect(taskService.updateTask).toHaveBeenCalled();
    });

    it.each([
      { name: 'case not found', retrieveResult: null, message: 'Case not found' },
      {
        name: 'reason is empty',
        retrieveResult: { ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED },
        message: 'Reason for resumption is required',
        reason: '',
      },
    ])('should throw BadRequestException if $name', async ({ retrieveResult, message, reason = 'Resume reason' }) => {
      caseQueryService.retrieveCase.mockResolvedValue(retrieveResult as any);

      await expect(service.resumeCase(1, reason, 'user-123', 'tenant-123', {}, mockUser, resumeEndpoint)).rejects.toThrow(message);
    });

    it('should resume only the subcase when the case has a parent', async () => {
      const subCase = { ...mockCase, parent_id: 10, status: CaseStatus.STATUS_21_SUSPENDED };
      const txCase = {
        findFirst: jest.fn(),
        update: jest.fn(),
      };
      caseQueryService.retrieveCase.mockResolvedValue(subCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([{ ...mockTask, status: TaskStatus.STATUS_21_BLOCKED }] as any);
      prismaService.$transaction.mockImplementationOnce(async (callback) => callback({ case: txCase } as any));
      caseQueryService.updateCase.mockResolvedValue({ ...subCase, status: CaseStatus.STATUS_20_IN_PROGRESS } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_10_ASSIGNED } as any);

      await service.resumeCase(1, 'Resume reason', 'user-123', 'tenant-123', {}, mockUser, resumeEndpoint);

      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(caseQueryService.updateCase).toHaveBeenCalledWith(1, { status: CaseStatus.STATUS_20_IN_PROGRESS }, 'user-123');
      expect(txCase.findFirst).not.toHaveBeenCalled();
      expect(txCase.update).not.toHaveBeenCalled();
    });

    it('should send notification to assigned users when case is resumed', async () => {
      const suspendedCase = { ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED };
      const taskWithAssignee = { ...mockTask, status: TaskStatus.STATUS_21_BLOCKED, assigned_user_id: 'assigned-user-123' };
      caseQueryService.retrieveCase.mockResolvedValue(suspendedCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([taskWithAssignee] as any);
      setupMockTransaction(null, { ...suspendedCase, status: CaseStatus.STATUS_20_IN_PROGRESS });
      caseQueryService.updateCase.mockResolvedValue({ ...suspendedCase, status: CaseStatus.STATUS_20_IN_PROGRESS } as any);
      taskService.updateTask.mockResolvedValue({ ...taskWithAssignee, status: TaskStatus.STATUS_20_IN_PROGRESS } as any);
      cacheService.getUserFromCache.mockResolvedValue({ username: 'testuser', email: 'test@example.com' } as any);
      notificationService.sendNotification.mockResolvedValue({} as any);

      await service.resumeCase(1, 'Resume reason', 'user-123', 'tenant-123', {}, mockUser, resumeEndpoint);

      expect(cacheService.getUserFromCache).toHaveBeenCalledWith('user-123');
      expect(notificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'assigned-user-123',
          type: 'CASE_RESUMED',
        }),
      );
    });

    it('should handle notification failure gracefully in resumeCase', async () => {
      const suspendedCase = { ...mockCase, status: CaseStatus.STATUS_21_SUSPENDED };
      const taskWithAssignee = { ...mockTask, status: TaskStatus.STATUS_21_BLOCKED, assigned_user_id: 'assigned-user-123' };
      caseQueryService.retrieveCase.mockResolvedValue(suspendedCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([taskWithAssignee] as any);
      setupMockTransaction(null, { ...suspendedCase, status: CaseStatus.STATUS_20_IN_PROGRESS });
      caseQueryService.updateCase.mockResolvedValue({ ...suspendedCase, status: CaseStatus.STATUS_20_IN_PROGRESS } as any);
      taskService.updateTask.mockResolvedValue({ ...taskWithAssignee, status: TaskStatus.STATUS_20_IN_PROGRESS } as any);
      cacheService.getUserFromCache.mockResolvedValue({ username: 'testuser', email: 'test@example.com' } as any);
      notificationService.sendNotification.mockRejectedValue(new Error('Notification service error'));

      const result = await service.resumeCase(1, 'Resume reason', 'user-123', 'tenant-123', {}, mockUser, resumeEndpoint);

      expect(result.success).toBe(true);
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to send resumption notification'));
    });
  });

  describe('abandonCase', () => {
    const setupMockTransaction = () => {
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {};
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
    };

    it('should successfully abandon a case', async () => {
      const draftCase = { ...mockCase, status: CaseStatus.STATUS_00_DRAFT };
      caseQueryService.retrieveCase.mockResolvedValue(draftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 },
      ] as any);
      setupMockTransaction();
      caseQueryService.updateCase.mockResolvedValue({ ...draftCase, status: CaseStatus.STATUS_99_ABANDONED } as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED } as any);

      await service.abandonCase(1, 'Abandon reason', 'user-123', 'tenant-123', mockUser, abandonEndpoint);

      expect(caseQueryService.updateCase).toHaveBeenCalledWith(1, { status: CaseStatus.STATUS_99_ABANDONED }, 'user-123');
      expect(commentService.addComment).toHaveBeenCalled();
      expect(taskService.updateTask).toHaveBeenCalled();
    });

    it.each([
      { name: 'case not found', retrieveResult: null, message: "Case doesn't exist for caseId" },
      {
        name: 'reason is empty',
        retrieveResult: { ...mockCase, status: CaseStatus.STATUS_00_DRAFT },
        message: 'Reason for abandonment is required',
        reason: '',
      },
    ])('should throw BadRequestException if $name', async ({ retrieveResult, message, reason = 'Abandon reason' }) => {
      caseQueryService.retrieveCase.mockResolvedValue(retrieveResult as any);
      if (retrieveResult) {
        taskService.getTasksByCaseId.mockResolvedValue([
          { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 },
        ] as any);
      }

      await expect(service.abandonCase(1, reason, 'user-123', 'tenant-123', mockUser, abandonEndpoint)).rejects.toThrow(message);
    });
  });

  describe('delegation methods', () => {
    const delegationTests = [
      {
        method: 'saveCaseAsDraft',
        service: 'caseCreationApprovalService',
        args: [{ alertId: 1 } as any, 'user-123', 'tenant-123', 'investigator'],
        expectedArgs: [{ alertId: 1 } as any, 'user-123', 'tenant-123', 'investigator'],
        setupCase: null, // No case lookup for this method
      },
      {
        method: 'reopenCase',
        service: 'caseReopeningService',
        args: [1, 'reason', 'user-123', 'tenant-123', 'investigator', mockUser, reopenEndpoint],
        expectedArgs: [1, 'reason', 'user-123', 'tenant-123', 'investigator'],
        setupCase: { ...mockCase, status: CaseStatus.STATUS_81_CLOSED_REFUTED },
      },
      {
        method: 'approveCaseReopening',
        service: 'caseReopeningService',
        args: [1, 'supervisor-123', 'tenant-123', mockSupervisorUser, approveReopeningEndpoint],
        expectedArgs: [1, 'supervisor-123', 'tenant-123'],
        setupCase: { ...mockCase, status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL },
      },
      {
        method: 'rejectCaseReopening',
        service: 'caseReopeningService',
        args: [1, 'reason', 'supervisor-123', 'tenant-123', mockSupervisorUser, rejectReopeningEndpoint],
        expectedArgs: [1, 'reason', 'supervisor-123', 'tenant-123'],
        setupCase: { ...mockCase, status: CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL },
      },
      {
        method: 'closeCase',
        service: 'caseClosureApprovalService',
        args: [1, {} as any, 'user-123', 'tenant-123', 'investigator', mockUser, closeEndpoint],
        expectedArgs: [1, {} as any, 'user-123', 'tenant-123', 'investigator'],
        setupCase: mockCase, // STATUS_20_IN_PROGRESS is correct for close
      },
      {
        method: 'approveCaseClosure',
        service: 'caseClosureApprovalService',
        args: [1, CaseStatus.STATUS_82_CLOSED_CONFIRMED, 'comments', 'supervisor-123', 'tenant-123', mockSupervisorUser, approveClosureEndpoint],
        expectedArgs: [1, CaseStatus.STATUS_82_CLOSED_CONFIRMED, 'comments', 'supervisor-123', 'tenant-123'],
        setupCase: { ...mockCase, status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL },
      },
      {
        method: 'rejectCaseClosure',
        service: 'caseClosureApprovalService',
        args: [1, 'comments', 'supervisor-123', 'tenant-123', mockSupervisorUser, rejectClosureEndpoint],
        expectedArgs: [1, 'comments', 'supervisor-123', 'tenant-123'],
        setupCase: { ...mockCase, status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL },
      },
      {
        method: 'returnCaseForReview',
        service: 'caseClosureApprovalService',
        args: [1, 'comments', 'supervisor-123', 'tenant-123', mockSupervisorUser, returnForReviewEndpoint],
        expectedArgs: [1, 'comments', 'supervisor-123', 'tenant-123'],
        setupCase: { ...mockCase, status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL },
      },
      {
        method: 'approveCaseCreation',
        service: 'caseCreationApprovalService',
        args: [1, 'supervisor-123', 'tenant-123', mockSupervisorUser, approveCreationEndpoint],
        expectedArgs: [1, 'supervisor-123', 'tenant-123'],
        setupCase: { ...mockCase, status: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL },
      },
      {
        method: 'rejectCaseCreation',
        service: 'caseCreationApprovalService',
        args: [1, 'supervisor-123', 'tenant-123', 'reason', mockSupervisorUser, rejectCreationEndpoint],
        expectedArgs: [1, 'supervisor-123', 'tenant-123', 'reason'],
        setupCase: { ...mockCase, status: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL },
      },
      {
        method: 'completeCase',
        service: 'caseCreationApprovalService',
        args: [1, 'supervisor-123', 'tenant-123', mockSupervisorUser, completeCaseEndpoint],
        expectedArgs: [1, 'supervisor-123', 'tenant-123'],
        setupCase: { ...mockCase, status: CaseStatus.STATUS_00_DRAFT },
      },
      {
        method: 'getAllCases',
        service: 'caseQueryService',
        args: [{} as any, 'tenant-123', 'user-123', false],
        expectedArgs: [{} as any, 'tenant-123', 'user-123', false],
        setupCase: null, // No case lookup for this method
      },
      {
        method: 'getUserCases',
        service: 'caseQueryService',
        args: ['user-123', {} as any, false],
        expectedArgs: ['user-123', {} as any, false],
        setupCase: null, // No case lookup for this method
      },
      {
        method: 'getUserWorkloadStats',
        service: 'caseQueryService',
        args: ['user-123', false],
        expectedArgs: ['user-123', false],
        setupCase: null, // No case lookup for this method
      },
      {
        method: 'updateCase',
        service: 'caseQueryService',
        args: [1, { priority: Priority.CRITICAL } as any, 'user-123', mockUser, updateCaseEndpoint, 'tenant-123'],
        expectedArgs: [1, { priority: Priority.CRITICAL } as any, 'user-123'],
        setupCase: mockCase, // updateCase can work with any valid status
      },
      {
        method: 'retrieveCase',
        service: 'caseQueryService',
        args: [1, 'tenant-123', false],
        expectedArgs: [1, 'tenant-123', false],
        setupCase: null, // This IS the case retrieval method
      },
      {
        method: 'getSubCasesDetails',
        service: 'caseQueryService',
        args: [1],
        expectedArgs: [1],
        setupCase: null, // No RBAC check for this method
      },
    ];

    it.each(delegationTests)('should delegate $method to $service', async ({ method, service: serviceName, args, expectedArgs, setupCase }) => {
      const serviceMap = {
        caseCreationApprovalService,
        caseReopeningService,
        caseClosureApprovalService,
        caseQueryService,
      };
      const targetService = serviceMap[serviceName as keyof typeof serviceMap];
      (targetService as any)[method].mockResolvedValue({} as any);

      // Set up the case with appropriate status for RBAC checks
      if (setupCase !== null) {
        caseQueryService.retrieveCase.mockResolvedValue(setupCase as any);
      }

      await (service as any)[method](...args);

      expect((targetService as any)[method]).toHaveBeenCalledWith(...expectedArgs);
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

    const setupMockTransaction = () => {
      const mockTransaction = jest.fn(async (callback) => {
        const mockPrisma = {};
        return await callback(mockPrisma);
      });
      prismaService.$transaction.mockImplementation(mockTransaction);
    };

    it('should complete case creation by investigator with approval required', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockDraftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 },
      ] as any);
      const updatedCase = { ...mockDraftCase, ...updateData, status: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL };
      setupMockTransaction();
      caseQueryService.updateCase.mockResolvedValue(updatedCase as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED } as any);
      taskService.createTask.mockResolvedValue({ task_id: 2, name: 'Approve Case Creation' } as any);
      alertRepository.getAlertByCaseId.mockResolvedValue(0 as any);

      const result = await service.completeCaseCreation(1, updateData, 'user-123', 'tenant-123', 'investigator', mockUser, completeCaseCreationEndpoint);

      expect(result.requiresApproval).toBe(true);
      expect(result.message).toContain('pending supervisor approval');
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Approve Case Creation' }),
        'user-123',
        'tenant-123',
      );
    });

    it('should complete case creation by supervisor without approval', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockDraftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 },
      ] as any);
      const updatedCase = { ...mockDraftCase, ...updateData, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT };
      setupMockTransaction();
      caseQueryService.updateCase.mockResolvedValue(updatedCase as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED } as any);
      taskService.createTask.mockResolvedValue({ task_id: 2, name: 'Investigate Case' } as any);
      alertRepository.getAlertByCaseId.mockResolvedValue(undefined as any);

      const result = await service.completeCaseCreation(1, updateData as any, 'user-123', 'tenant-123', 'SUPERVISOR', mockSupervisorUser, completeCaseCreationEndpoint);

      expect(result.requiresApproval).toBe(false);
      expect(result.message).toContain('ready for investigation');
      expect(taskService.createTask).toHaveBeenCalledWith(expect.objectContaining({ name: 'Investigate Case' }), 'user-123', 'tenant-123');
    });

    it('should handle FRAUD_AND_AML case type for supervisor', async () => {
      const fraudAmlData = { ...updateData, caseType: CaseType.FRAUD_AND_AML };
      const fraudAmlCase = { ...mockDraftCase, case_type: CaseType.FRAUD_AND_AML };
      caseQueryService.retrieveCase.mockResolvedValue(fraudAmlCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 },
      ] as any);
      const updatedCase = { ...fraudAmlCase, ...fraudAmlData, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT };
      setupMockTransaction();
      caseQueryService.updateCase.mockResolvedValue(updatedCase as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED } as any);
      alertRepository.getAlertByCaseId.mockResolvedValue(undefined as any);

      await service.completeCaseCreation(1, fraudAmlData as any, 'user-123', 'tenant-123', 'SUPERVISOR', mockSupervisorUser, completeCaseCreationEndpoint);

      expect(caseCreationService.createCaseWithInvestigationTask).toHaveBeenCalledTimes(2);
      expect(caseCreationService.createCaseWithInvestigationTask).toHaveBeenCalledWith(
        CaseType.FRAUD,
        'user-123',
        'tenant-123',
        1,
        Priority.CRITICAL,
        CaseCreationType.AUTOMATIC_SYSTEM,
        'SUPERVISOR',
      );
      expect(caseCreationService.createCaseWithInvestigationTask).toHaveBeenCalledWith(
        CaseType.AML,
        'user-123',
        'tenant-123',
        1,
        Priority.CRITICAL,
        CaseCreationType.AUTOMATIC_SYSTEM,
        'SUPERVISOR',
      );
    });

    it.each([
      { name: 'case not found', retrieveResult: null, message: 'Case not found' },
      { name: 'case is not in DRAFT status', retrieveResult: mockCase, message: 'Only cases in DRAFT status can be completed' },
      {
        name: 'missing required fields',
        retrieveResult: mockDraftCase,
        updateData: { note: 'test' } as any,
        message: 'Missing required fields',
      },
    ])('should throw BadRequestException if $name', async ({ retrieveResult, message, updateData: testUpdateData }) => {
      caseQueryService.retrieveCase.mockResolvedValue(retrieveResult as any);

      await expect(
        service.completeCaseCreation(1, testUpdateData || (updateData as any), 'user-123', 'tenant-123', 'investigator', mockUser, completeCaseCreationEndpoint),
      ).rejects.toThrow(message);
    });

    it.each([
      { name: 'Complete New Case task not found', tasks: [], expectedError: InternalServerErrorException },
      {
        name: 'Complete New Case task already completed',
        tasks: [{ ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_30_COMPLETED, task_id: 1 }],
        expectedError: InternalServerErrorException,
      },
    ])('should throw InternalServerErrorException if $name', async ({ tasks, expectedError }) => {
      caseQueryService.retrieveCase.mockResolvedValue(mockDraftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue(tasks as any);

      await expect(service.completeCaseCreation(1, updateData as any, 'user-123', 'tenant-123', 'investigator', mockUser, completeCaseCreationEndpoint)).rejects.toThrow(
        expectedError,
      );
    });

    it('should update alert if exists', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockDraftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 },
      ] as any);
      const updatedCase = { ...mockDraftCase, ...updateData, status: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL };
      setupMockTransaction();
      caseQueryService.updateCase.mockResolvedValue(updatedCase as any);
      taskService.updateTask.mockResolvedValue({ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED, task_id: 1 } as any);
      taskService.createTask.mockResolvedValue({ task_id: 2 } as any);
      alertRepository.getAlertByCaseId.mockResolvedValue(100);
      alertRepository.updateAlert.mockResolvedValue({} as any);

      await service.completeCaseCreation(1, updateData as any, 'user-123', 'tenant-123', 'investigator', mockUser, completeCaseCreationEndpoint);

      expect(alertRepository.updateAlert).toHaveBeenCalledWith(
        100,
        expect.objectContaining({
          priority_score: 85,
          priority: Priority.CRITICAL,
          alertType: CaseType.FRAUD,
        }),
      );
    });

    it('should throw InternalServerErrorException on transaction failure', async () => {
      caseQueryService.retrieveCase.mockResolvedValue(mockDraftCase as any);
      taskService.getTasksByCaseId.mockResolvedValue([
        { ...mockTask, name: 'Complete New Case', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 1 },
      ] as any);

      const mockTransaction = jest.fn(async () => {
        throw new Error('Transaction failed');
      });
      prismaService.$transaction.mockImplementation(mockTransaction);

      await expect(service.completeCaseCreation(1, updateData as any, 'user-123', 'tenant-123', 'investigator', mockUser, completeCaseCreationEndpoint)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });
});
