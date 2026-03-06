import { Test, TestingModule } from '@nestjs/testing';
import { CaseClosureApprovalService } from '../src/modules/case/services/case-closure-approval.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { CaseRepository } from '../src/modules/repository/case.repository';
import { CommentRepository } from '../src/modules/repository/comment.repository';
import { TaskService } from '../src/modules/task/task.service';
import { NotificationService } from '../src/modules/notification/notification.service';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { CommentService } from '../src/modules/comment/comment.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { TaskValidationUtil } from '../src/modules/shared/utils/task-validation.util';
import { NotFoundException, BadRequestException, ConflictException, InternalServerErrorException } from '@nestjs/common';
import { CaseStatus, TaskStatus, CaseType, Priority } from '@prisma/client-cms';

describe('CaseClosureApprovalService', () => {
  let service: CaseClosureApprovalService;
  let prismaService: jest.Mocked<PrismaService>;
  let caseRepository: jest.Mocked<CaseRepository>;
  let commentRepository: jest.Mocked<CommentRepository>;
  let taskService: jest.Mocked<TaskService>;
  let notificationService: jest.Mocked<NotificationService>;
  let flowableService: jest.Mocked<FlowableService>;
  let commentService: jest.Mocked<CommentService>;
  let loggingOrchestrationService: jest.Mocked<LoggingOrchestrationService>;
  let logger: jest.Mocked<LoggerService>;
  let taskValidationUtil: any;

  const mockCase = {
    case_id: 1,
    tenant_id: 'tenant-123',
    case_owner_user_id: 'user-123',
    status: CaseStatus.STATUS_20_IN_PROGRESS,
    case_type: CaseType.FRAUD,
    priority: Priority.CRITICAL,
    case_creator_user_id: 'creator-123',
    parent_id: null,
    created_at: new Date(),
    updated_at: new Date(),
    tasks: [],
    comments: [],
  };

  const mockTask = {
    task_id: 1,
    case_id: 1,
    name: 'Investigate Case',
    status: TaskStatus.STATUS_20_IN_PROGRESS,
    assigned_user_id: 'user-123',
    tenant_id: 'tenant-123',
    created_at: new Date(),
    updated_at: new Date(),
  };

  const mockCloseDto = {
    recommendedOutcome: 'STATUS_82_CLOSED_CONFIRMED' as any,
    finalNotes: 'Case confirmed fraud after investigation',
  };

  // Helper function to setup successful case closure mocks
  const setupSuccessfulClosure = (role: string, finalStatus: CaseStatus) => {
    const caseWithTask = {
      ...mockCase,
      tasks: [
        {
          ...mockTask,
          status: TaskStatus.STATUS_20_IN_PROGRESS,
          assigned_user_id: role === 'CMS_SUPERVISOR' ? 'supervisor-123' : 'user-123',
        },
      ],
    };
    caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithTask as any);
    caseRepository.updateCaseStatusAndCompleteTask.mockResolvedValue({
      updatedCase: { ...mockCase, status: finalStatus },
      completedTask: { ...mockTask, status: TaskStatus.STATUS_30_COMPLETED },
    } as any);
    if (role !== 'CMS_SUPERVISOR') {
      taskService.createTask.mockResolvedValue({ task_id: 2, name: 'Approve Case Closure' } as any);
    }
  };

  // Helper function to setup approval mocks
  const setupSuccessfulApproval = (finalOutcome: string) => {
    const pendingCase = {
      ...mockCase,
      status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
      tasks: [
        { ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 },
        { ...mockTask, name: 'Investigate Case', status: TaskStatus.STATUS_30_COMPLETED, task_id: 1 },
      ],
      comments: [{ note: 'Recommended Outcome: Confirmed' }],
    };
    caseRepository.findCaseForClosureApproval.mockResolvedValue(pendingCase as any);
    caseRepository.approveClosureTask.mockResolvedValue({
      updatedCase: { ...mockCase, status: finalOutcome as CaseStatus },
      completedTask: { task_id: 2, status: TaskStatus.STATUS_30_COMPLETED },
    } as any);
    commentService.addComment.mockResolvedValue({} as any);
    return pendingCase;
  };

  beforeEach(async () => {
    const mockPrismaService = {
      $transaction: jest.fn(),
      case: {
        findFirst: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
      },
      task: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const mockCaseRepository = {
      findCaseWithPermissionCheck: jest.fn(),
      updateCaseStatusAndCompleteTask: jest.fn(),
      findCaseForClosureApproval: jest.fn(),
      approveClosureTask: jest.fn(),
      findCaseWithCompletedInvestigation: jest.fn(),
      rejectClosureTask: jest.fn(),
      findCaseForReview: jest.fn(),
    };

    const mockCommentRepository = {
      createComment: jest.fn(),
    };

    const mockTaskService = {
      createTask: jest.fn(),
      claimTask: jest.fn(),
      updateTask: jest.fn(),
    };

    const mockNotificationService = {
      sendNotification: jest.fn(),
    };

    const mockFlowableService = {
      handleTaskCompleted: jest.fn(),
      handleCaseStatusChanged: jest.fn(),
      handleCaseAbandoned: jest.fn(),
    };

    const mockCommentService = {
      addComment: jest.fn(),
    };

    const mockLoggingOrchestrationService = {
      logActions: jest.fn(),
      logActionsWithHistory: jest.fn(),
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockTaskValidationUtil = {
      findApprovalTask: jest.fn(),
      filterTasks: jest.fn().mockReturnValue([]),
      getUserAssignedTasks: jest.fn(),
      validateTask: jest.fn(),
      validateApprovalTask: jest.fn(),
      validateApprovalTaskForClosure: jest.fn().mockReturnValue({
        isValid: true,
        approvalTask: {
          task_id: 2,
          name: 'Approve Case Closure',
          assigned_user_id: 'supervisor-123',
          status: TaskStatus.STATUS_10_ASSIGNED,
        },
      }),
      throwIfValidationFails: jest.fn(),
      validateOtherTasksCompleted: jest.fn().mockReturnValue({ isValid: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseClosureApprovalService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: LoggerService, useValue: mockLogger },
        { provide: CaseRepository, useValue: mockCaseRepository },
        { provide: CommentRepository, useValue: mockCommentRepository },
        { provide: TaskService, useValue: mockTaskService },
        { provide: NotificationService, useValue: mockNotificationService },
        { provide: FlowableService, useValue: mockFlowableService },
        { provide: CommentService, useValue: mockCommentService },
        { provide: LoggingOrchestrationService, useValue: mockLoggingOrchestrationService },
        { provide: TaskValidationUtil, useValue: mockTaskValidationUtil },
      ],
    }).compile();

    service = module.get<CaseClosureApprovalService>(CaseClosureApprovalService);
    prismaService = module.get(PrismaService);
    caseRepository = module.get(CaseRepository);
    commentRepository = module.get(CommentRepository);
    taskService = module.get(TaskService);
    notificationService = module.get(NotificationService);
    flowableService = module.get(FlowableService);
    commentService = module.get(CommentService);
    loggingOrchestrationService = module.get(LoggingOrchestrationService);
    logger = module.get(LoggerService);
    taskValidationUtil = module.get(TaskValidationUtil);
  });

  describe('closeCase', () => {
    it('should successfully close case by supervisor directly', async () => {
      setupSuccessfulClosure('CMS_SUPERVISOR', CaseStatus.STATUS_82_CLOSED_CONFIRMED);
      taskService.createTask.mockResolvedValue({ task_id: 2, name: 'SAR_STR_FILING' } as any);

      const result = await service.closeCase(1, mockCloseDto, 'supervisor-123', 'tenant-123', 'CMS_SUPERVISOR');

      expect(result.supervisor_closure).toBe(true);
      expect(result.message).toContain('supervisor');
      expect(caseRepository.updateCaseStatusAndCompleteTask).toHaveBeenCalled();
      expect(flowableService.handleTaskCompleted).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should create SAR filing task when case is closed as confirmed', async () => {
      setupSuccessfulClosure('CMS_SUPERVISOR', CaseStatus.STATUS_82_CLOSED_CONFIRMED);
      taskService.createTask.mockResolvedValue({ task_id: 2, name: 'SAR_STR_FILING' } as any);

      await service.closeCase(1, mockCloseDto, 'supervisor-123', 'tenant-123', 'CMS_SUPERVISOR');

      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'SAR/STR Filing',
          status: TaskStatus.STATUS_01_UNASSIGNED,
        }),
        'supervisor-123',
        'tenant-123',
      );
    });

    it('should handle SAR task creation failure gracefully', async () => {
      setupSuccessfulClosure('CMS_SUPERVISOR', CaseStatus.STATUS_82_CLOSED_CONFIRMED);
      taskService.createTask.mockRejectedValue(new Error('Task creation failed'));

      const result = await service.closeCase(1, mockCloseDto, 'supervisor-123', 'tenant-123', 'CMS_SUPERVISOR');

      expect(result.supervisor_closure).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should successfully close case by investigator with approval required', async () => {
      setupSuccessfulClosure('investigator', CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL);

      const result = await service.closeCase(1, mockCloseDto, 'user-123', 'tenant-123', 'investigator');

      expect(result.message).toContain('approval');
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Approve Case Closure',
          status: TaskStatus.STATUS_01_UNASSIGNED,
        }),
        'user-123',
        'tenant-123',
      );
      expect(flowableService.handleCaseStatusChanged).toHaveBeenCalledWith({
        caseId: 1,
        newStatus: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
      });
    });

    it('should handle FRAUD_AND_AML case closure by supervisor', async () => {
      const fraudAmlCase = {
        ...mockCase,
        case_type: CaseType.FRAUD_AND_AML as any,
        tasks: [{ ...mockTask, status: TaskStatus.STATUS_20_IN_PROGRESS }],
      };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(fraudAmlCase as any);
      (prismaService.case.findMany as jest.Mock).mockResolvedValue([
        { ...mockCase, case_id: 2, parent_id: 1, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED },
        { ...mockCase, case_id: 3, parent_id: 1, status: CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE },
      ] as any);
      caseRepository.updateCaseStatusAndCompleteTask.mockResolvedValue({
        updatedCase: { ...fraudAmlCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED },
        completedTask: null,
      } as any);

      const result = await service.closeCase(1, mockCloseDto, 'supervisor-123', 'tenant-123', 'CMS_SUPERVISOR');

      expect(result.supervisor_closure).toBe(true);
      expect(prismaService.case.findMany as jest.Mock).toHaveBeenCalledWith({
        where: { parent_id: 1, tenant_id: 'tenant-123' },
      });
    });

    it.each([
      {
        description: 'FRAUD_AND_AML sub cases are not closable',
        setupMock: () => {
          const fraudAmlCase = { ...mockCase, case_type: CaseType.FRAUD_AND_AML as any, tasks: [] };
          caseRepository.findCaseWithPermissionCheck.mockResolvedValue(fraudAmlCase as any);
          (prismaService.case.findMany as jest.Mock).mockResolvedValue([
            { ...mockCase, case_id: 2, parent_id: 1, status: CaseStatus.STATUS_20_IN_PROGRESS },
          ] as any);
        },
        role: 'CMS_SUPERVISOR',
        error: ConflictException,
      },
      {
        description: 'FRAUD_AND_AML sub cases do not exist',
        setupMock: () => {
          const fraudAmlCase = { ...mockCase, case_type: CaseType.FRAUD_AND_AML as any, tasks: [] };
          caseRepository.findCaseWithPermissionCheck.mockResolvedValue(fraudAmlCase as any);
          (prismaService.case.findMany as jest.Mock).mockResolvedValue([]);
        },
        error: BadRequestException,
      },
      {
        description: 'non-supervisor tries to close FRAUD_AND_AML case',
        setupMock: () => {
          const fraudAmlCase = { ...mockCase, case_type: CaseType.FRAUD_AND_AML as any, tasks: [] };
          caseRepository.findCaseWithPermissionCheck.mockResolvedValue(fraudAmlCase as any);
        },
        role: 'investigator',
        error: BadRequestException,
      },
      {
        description: 'case not found',
        setupMock: () => caseRepository.findCaseWithPermissionCheck.mockResolvedValue(null),
        error: NotFoundException,
      },
      {
        description: 'case is not in progress',
        setupMock: () => {
          const closedCase = { ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED, tasks: [] };
          caseRepository.findCaseWithPermissionCheck.mockResolvedValue(closedCase as any);
        },
        error: ConflictException,
      },
      {
        description: 'investigation task not found',
        setupMock: () => {
          const caseWithoutTask = { ...mockCase, tasks: [] };
          caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithoutTask as any);
        },
        error: InternalServerErrorException,
      },
      {
        description: 'investigation task not assigned to user',
        setupMock: () => {
          const caseWithTask = {
            ...mockCase,
            tasks: [{ ...mockTask, assigned_user_id: 'other-user', status: TaskStatus.STATUS_20_IN_PROGRESS }],
          };
          caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithTask as any);
        },
        error: BadRequestException,
      },
      {
        description: 'investigation task not in valid status',
        setupMock: () => {
          const caseWithTask = {
            ...mockCase,
            tasks: [{ ...mockTask, status: TaskStatus.STATUS_01_UNASSIGNED }],
          };
          caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithTask as any);
        },
        error: InternalServerErrorException,
      },
      {
        description: 'unexpected error',
        setupMock: () => caseRepository.findCaseWithPermissionCheck.mockRejectedValue(new Error('Database error')),
        error: InternalServerErrorException,
      },
    ])('should throw $error.name when $description', async ({ setupMock, error, role }) => {
      setupMock();

      await expect(service.closeCase(1, mockCloseDto, 'user-123', 'tenant-123', role || 'investigator')).rejects.toThrow(error);
    });

    it('should handle investigation task with STATUS_30_COMPLETED', async () => {
      const caseWithCompletedTask = {
        ...mockCase,
        tasks: [{ ...mockTask, status: TaskStatus.STATUS_30_COMPLETED }],
      };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithCompletedTask as any);
      caseRepository.updateCaseStatusAndCompleteTask.mockResolvedValue({
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL },
        completedTask: { ...mockTask, status: TaskStatus.STATUS_30_COMPLETED },
      } as any);
      taskService.createTask.mockResolvedValue({ task_id: 2 } as any);

      const result = await service.closeCase(1, mockCloseDto, 'user-123', 'tenant-123', 'investigator');

      expect(result.message).toContain('approval');
    });

    it('should sort investigation tasks and use the latest one', async () => {
      const oldTask = { ...mockTask, task_id: 1, created_at: new Date('2023-01-01') };
      const newTask = { ...mockTask, task_id: 2, created_at: new Date('2023-01-02') };
      const caseWithMultipleTasks = { ...mockCase, tasks: [oldTask, newTask] };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithMultipleTasks as any);
      caseRepository.updateCaseStatusAndCompleteTask.mockResolvedValue({
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL },
        completedTask: { ...newTask, status: TaskStatus.STATUS_30_COMPLETED },
      } as any);
      taskService.createTask.mockResolvedValue({ task_id: 3 } as any);

      await service.closeCase(1, mockCloseDto, 'user-123', 'tenant-123', 'investigator');

      expect(caseRepository.updateCaseStatusAndCompleteTask).toHaveBeenCalledWith(
        1,
        CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        2,
        expect.any(String),
        expect.anything(),
        expect.anything(),
      );
    });
  });

  describe('approveCaseClosure', () => {
    it('should successfully approve case closure', async () => {
      setupSuccessfulApproval('STATUS_82_CLOSED_CONFIRMED');

      const result = await service.approveCaseClosure(1, 'STATUS_82_CLOSED_CONFIRMED', 'Approved', 'supervisor-123', 'tenant-123');

      expect(result.message).toBe('Case closure approved');
      expect(flowableService.handleTaskCompleted).toHaveBeenCalled();
      expect(commentService.addComment).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should create SAR filing task when approving confirmed case', async () => {
      setupSuccessfulApproval('STATUS_82_CLOSED_CONFIRMED');
      taskService.createTask.mockResolvedValue({ task_id: 3, name: 'SAR_STR_FILING' } as any);

      await service.approveCaseClosure(1, 'STATUS_82_CLOSED_CONFIRMED', 'Approved', 'supervisor-123', 'tenant-123');

      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'SAR/STR Filing' }),
        'supervisor-123',
        'tenant-123',
      );
    });

    it('should send notification to investigator on approval', async () => {
      const pendingCase = setupSuccessfulApproval('STATUS_82_CLOSED_CONFIRMED');
      pendingCase.tasks[1].assigned_user_id = 'investigator-123';
      notificationService.sendNotification.mockResolvedValue({} as any);

      await service.approveCaseClosure(1, 'STATUS_82_CLOSED_CONFIRMED', 'Approved', 'supervisor-123', 'tenant-123');

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        userId: 'investigator-123',
        type: 'CASE_CLOSURE_APPROVED',
        message: expect.any(String),
        metadata: expect.objectContaining({ caseId: 1 }),
      });
    });

    it.each([
      {
        description: 'notification failure',
        setupFailure: () => notificationService.sendNotification.mockRejectedValue(new Error('Notification failed')),
        checkLogger: () => expect(logger.warn).toHaveBeenCalled(),
      },
      {
        description: 'SAR filing task creation failure',
        setupFailure: () => taskService.createTask.mockRejectedValue(new Error('Task creation failed')),
        checkLogger: () => expect(logger.error).toHaveBeenCalled(),
      },
    ])('should handle $description gracefully', async ({ setupFailure, checkLogger }) => {
      const pendingCase = setupSuccessfulApproval('STATUS_82_CLOSED_CONFIRMED');
      pendingCase.tasks[1].assigned_user_id = 'investigator-123';
      setupFailure();

      const result = await service.approveCaseClosure(1, 'STATUS_82_CLOSED_CONFIRMED', 'Approved', 'supervisor-123', 'tenant-123');

      expect(result.message).toBe('Case closure approved');
      checkLogger();
    });

    it.each([
      {
        description: 'invalid final outcome',
        mockSetup: () => {},
        finalOutcome: 'INVALID_OUTCOME',
        error: BadRequestException,
      },
      {
        description: 'case not found',
        mockSetup: () => caseRepository.findCaseForClosureApproval.mockResolvedValue(null),
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
        error: NotFoundException,
      },
      {
        description: 'case not pending approval',
        mockSetup: () => {
          const wrongStatusCase = { ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS, tasks: [], comments: [] };
          caseRepository.findCaseForClosureApproval.mockResolvedValue(wrongStatusCase as any);
        },
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
        error: ConflictException,
      },
      {
        description: 'approval task not found',
        mockSetup: () => {
          const caseWithoutApprovalTask = {
            ...mockCase,
            status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
            tasks: [],
            comments: [],
          };
          caseRepository.findCaseForClosureApproval.mockResolvedValue(caseWithoutApprovalTask as any);
        },
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
        error: NotFoundException,
      },
      {
        description: 'case has incomplete information',
        mockSetup: () => {
          const incompleteCase = {
            case_id: 1,
            tenant_id: 'tenant-123',
            status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
            priority: null,
            case_type: null,
            case_creator_user_id: null,
            tasks: [{ ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 }],
            comments: [],
          };
          caseRepository.findCaseForClosureApproval.mockResolvedValue(incompleteCase as any);
        },
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
        error: BadRequestException,
      },
      {
        description: 'unexpected error',
        mockSetup: () => caseRepository.findCaseForClosureApproval.mockRejectedValue(new Error('Database error')),
        finalOutcome: 'STATUS_82_CLOSED_CONFIRMED',
        error: InternalServerErrorException,
      },
    ])('should throw $error.name when $description', async ({ mockSetup, finalOutcome, error }) => {
      mockSetup();

      await expect(service.approveCaseClosure(1, finalOutcome, 'Approved', 'supervisor-123', 'tenant-123')).rejects.toThrow(error);
    });
  });

  describe('rejectCaseClosure', () => {
    it('should successfully reject case closure', async () => {
      const pendingCase = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [
          {
            ...mockTask,
            name: 'Investigate Case',
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: 'investigator-123',
            task_id: 1,
          },
        ],
      };
      caseRepository.findCaseForReview.mockResolvedValue({
        ...pendingCase,
        tasks: [{ ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 }],
      } as any);
      caseRepository.findCaseWithCompletedInvestigation.mockResolvedValue(pendingCase as any);
      caseRepository.rejectClosureTask.mockResolvedValue({
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS },
        completedTask: { task_id: 2, status: TaskStatus.STATUS_30_COMPLETED },
        newInvestigationTask: { task_id: 3, name: 'Investigate Case', status: TaskStatus.STATUS_10_ASSIGNED },
      } as any);
      notificationService.sendNotification.mockResolvedValue({} as any);

      const result = await service.rejectCaseClosure(1, 'Need more evidence for fraud confirmation', 'supervisor-123', 'tenant-123');

      expect(result.message).toContain('rejected');
      expect(result.investigation_task.assigned_to).toBe('investigator-123');
      expect(flowableService.handleCaseStatusChanged).toHaveBeenCalled();
      expect(flowableService.handleTaskCompleted).toHaveBeenCalled();
      expect(notificationService.sendNotification).toHaveBeenCalled();
    });

    it('should handle notification failure gracefully on rejection', async () => {
      const pendingCase = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [
          {
            ...mockTask,
            name: 'Investigate Case',
            status: TaskStatus.STATUS_30_COMPLETED,
            assigned_user_id: 'investigator-123',
            task_id: 1,
          },
        ],
      };
      caseRepository.findCaseForReview.mockResolvedValue({
        ...pendingCase,
        tasks: [{ ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 }],
      } as any);
      caseRepository.findCaseWithCompletedInvestigation.mockResolvedValue(pendingCase as any);
      caseRepository.rejectClosureTask.mockResolvedValue({
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS },
        completedTask: { task_id: 2, status: TaskStatus.STATUS_30_COMPLETED },
        newInvestigationTask: { task_id: 3, name: 'Investigate Case', status: TaskStatus.STATUS_10_ASSIGNED },
      } as any);
      notificationService.sendNotification.mockRejectedValue(new Error('Notification failed'));

      const result = await service.rejectCaseClosure(1, 'Need more evidence', 'supervisor-123', 'tenant-123');

      expect(result.message).toContain('rejected');
      expect(logger.warn).toHaveBeenCalled();
    });

    it.each([
      {
        description: 'comments too short',
        setupMock: () => {
          caseRepository.findCaseForReview.mockResolvedValue({
            ...mockCase,
            status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
            tasks: [{ ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 }],
          } as any);
        },
        comments: 'No',
        error: BadRequestException,
      },
      {
        description: 'case not found',
        setupMock: () => {
          caseRepository.findCaseForReview.mockResolvedValue({
            ...mockCase,
            status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
            tasks: [{ ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 }],
          } as any);
          caseRepository.findCaseWithCompletedInvestigation.mockResolvedValue(null);
        },
        comments: 'Need more evidence',
        error: NotFoundException,
      },
      {
        description: 'original investigator cannot be determined',
        setupMock: () => {
          const taskWithoutAssignee = {
            ...mockCase,
            status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
            tasks: [{ ...mockTask, name: 'Investigate Case', status: TaskStatus.STATUS_30_COMPLETED, assigned_user_id: null, task_id: 1 }],
          };
          caseRepository.findCaseForReview.mockResolvedValue({
            ...taskWithoutAssignee,
            tasks: [{ ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 }],
          } as any);
          caseRepository.findCaseWithCompletedInvestigation.mockResolvedValue(taskWithoutAssignee as any);
        },
        comments: 'Need more evidence',
        error: BadRequestException,
      },
      {
        description: 'validation error when other tasks are incomplete',
        setupMock: () => {
          const pendingCase = {
            ...mockCase,
            status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
            tasks: [
              { ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 },
              { ...mockTask, name: 'Some Other Task', status: TaskStatus.STATUS_10_ASSIGNED, task_id: 3 },
            ],
          };
          caseRepository.findCaseForReview.mockResolvedValue(pendingCase as any);
          caseRepository.findCaseWithCompletedInvestigation.mockResolvedValue(pendingCase as any);
          (taskValidationUtil.validateOtherTasksCompleted as jest.Mock).mockReturnValueOnce({
            isValid: false,
            incompleteTasks: [{ task_id: 3, name: 'Some Other Task' }],
          });
        },
        comments: 'Need more evidence',
        error: BadRequestException,
      },
    ])('should throw $error.name when $description', async ({ setupMock, comments, error }) => {
      setupMock();

      await expect(service.rejectCaseClosure(1, comments, 'supervisor-123', 'tenant-123')).rejects.toThrow(error);
    });
  });

  describe('returnCaseForReview', () => {
    it('should successfully return case for review', async () => {
      const pendingCase = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [
          {
            ...mockTask,
            name: 'approve case closure',
            status: TaskStatus.STATUS_10_ASSIGNED,
            assigned_user_id: 'supervisor-123',
            task_id: 2,
          },
        ],
      };
      caseRepository.findCaseForReview.mockResolvedValue(pendingCase as any);
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          case: { update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS }) },
          task: {
            findFirst: jest.fn().mockResolvedValue({ task_id: 2, name: 'approve case closure' }),
            update: jest.fn().mockResolvedValue({ task_id: 2, status: TaskStatus.STATUS_30_COMPLETED }),
          },
        };
        commentRepository.createComment.mockResolvedValue({} as any);
        return await callback(mockTx as any);
      });

      const result = await service.returnCaseForReview(1, 'Please review additional evidence', 'supervisor-123', 'tenant-123');

      expect(result.message).toContain('returned');
      expect(flowableService.handleCaseStatusChanged).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should throw NotFoundException if approval task not found during return', async () => {
      const pendingCase = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [
          {
            ...mockTask,
            name: 'approve case closure',
            status: TaskStatus.STATUS_10_ASSIGNED,
            assigned_user_id: 'supervisor-123',
            task_id: 2,
          },
        ],
      };
      caseRepository.findCaseForReview.mockResolvedValue(pendingCase as any);
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          case: { update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS }) },
          task: { findFirst: jest.fn().mockResolvedValue(null) },
        };
        return await callback(mockTx as any);
      });

      await expect(service.returnCaseForReview(1, 'Review needed', 'supervisor-123', 'tenant-123')).rejects.toThrow(NotFoundException);
    });

    it('should handle auto-claim of approval task', async () => {
      const pendingCase = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [{ ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, assigned_user_id: null, task_id: 2 }],
      };

      const unassignedTask = { task_id: 2, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, assigned_user_id: null };
      (taskValidationUtil.validateApprovalTaskForClosure as jest.Mock)
        .mockReturnValueOnce({
          isValid: false,
          errors: ['Approval task must be claimed'],
          approvalTask: unassignedTask,
        })
        .mockReturnValueOnce({
          isValid: true,
          approvalTask: { ...unassignedTask, assigned_user_id: 'supervisor-123', status: TaskStatus.STATUS_10_ASSIGNED },
        });

      caseRepository.findCaseForReview.mockResolvedValueOnce(pendingCase as any);
      taskService.claimTask.mockResolvedValue({} as any);

      caseRepository.findCaseForReview.mockResolvedValueOnce({
        ...pendingCase,
        tasks: [
          {
            ...mockTask,
            name: 'Approve Case Closure',
            status: TaskStatus.STATUS_10_ASSIGNED,
            assigned_user_id: 'supervisor-123',
            task_id: 2,
          },
        ],
      } as any);

      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          case: { update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS }) },
          task: {
            findFirst: jest.fn().mockResolvedValue({ task_id: 2, name: 'approve case closure' }),
            update: jest.fn().mockResolvedValue({ task_id: 2, status: TaskStatus.STATUS_30_COMPLETED }),
          },
        };
        commentRepository.createComment.mockResolvedValue({} as any);
        return await callback(mockTx as any);
      });

      const result = await service.returnCaseForReview(1, 'Review needed', 'supervisor-123', 'tenant-123');

      expect(taskService.claimTask).toHaveBeenCalledWith(2, 'supervisor-123', 'tenant-123');
      expect(result.message).toContain('returned');
    });

    it('should throw NotFoundException when validation finds no approval task', async () => {
      const pendingCase = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [],
      };
      caseRepository.findCaseForReview.mockResolvedValue(pendingCase as any);

      await expect(service.returnCaseForReview(1, 'Review needed', 'supervisor-123', 'tenant-123')).rejects.toThrow();
    });
  });

  describe('error handling and logging', () => {
    it.each([
      {
        method: 'approveCaseClosure',
        setupError: () => caseRepository.findCaseForClosureApproval.mockRejectedValue(new Error('Database connection lost')),
        invokeMethod: () => service.approveCaseClosure(1, 'STATUS_82_CLOSED_CONFIRMED', 'Approved', 'supervisor-123', 'tenant-123'),
      },
      {
        method: 'rejectCaseClosure',
        setupError: () => caseRepository.findCaseForReview.mockRejectedValue(new Error('Database error')),
        invokeMethod: () => service.rejectCaseClosure(1, 'Need more evidence', 'supervisor-123', 'tenant-123'),
      },
      {
        method: 'returnCaseForReview',
        setupError: () => caseRepository.findCaseForReview.mockRejectedValue(new Error('Database error')),
        invokeMethod: () => service.returnCaseForReview(1, 'Review needed', 'supervisor-123', 'tenant-123'),
      },
    ])('should log error on failed operation in $method', async ({ setupError, invokeMethod }) => {
      setupError();

      await expect(invokeMethod()).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
        }),
      );
    });
  });
});
