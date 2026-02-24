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
import {
  NotFoundException,
  BadRequestException,
  ConflictException,
  InternalServerErrorException,
} from '@nestjs/common';
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
        }
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
      const caseWithTask = {
        ...mockCase,
        tasks: [{ ...mockTask, status: TaskStatus.STATUS_20_IN_PROGRESS, assigned_user_id: 'supervisor-123' }],
      };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithTask as any);
      caseRepository.updateCaseStatusAndCompleteTask.mockResolvedValue({
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED },
        completedTask: { ...mockTask, status: TaskStatus.STATUS_30_COMPLETED },
      } as any);
      taskService.createTask.mockResolvedValue({ task_id: 2, name: 'SAR_STR_FILING' } as any);

      const result = await service.closeCase(1, mockCloseDto, 'supervisor-123', 'tenant-123', 'CMS_SUPERVISOR');

      expect(result.supervisor_closure).toBe(true);
      expect(result.message).toContain('supervisor');
      expect(caseRepository.updateCaseStatusAndCompleteTask).toHaveBeenCalled();
      expect(flowableService.handleTaskCompleted).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should create SAR filing task when case is closed as confirmed', async () => {
      const caseWithTask = {
        ...mockCase,
        tasks: [{ ...mockTask, status: TaskStatus.STATUS_20_IN_PROGRESS, assigned_user_id: 'supervisor-123' }],
      };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithTask as any);
      caseRepository.updateCaseStatusAndCompleteTask.mockResolvedValue({
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED },
        completedTask: { ...mockTask, status: TaskStatus.STATUS_30_COMPLETED },
      } as any);
      taskService.createTask.mockResolvedValue({ task_id: 2, name: 'SAR_STR_FILING' } as any);

      await service.closeCase(1, mockCloseDto, 'supervisor-123', 'tenant-123', 'CMS_SUPERVISOR');

      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'SAR/STR Filing',
          status: TaskStatus.STATUS_01_UNASSIGNED,
        }),
        'supervisor-123',
        'tenant-123'
      );
    });

    it('should handle SAR task creation failure gracefully', async () => {
      const caseWithTask = {
        ...mockCase,
        tasks: [{ ...mockTask, status: TaskStatus.STATUS_20_IN_PROGRESS, assigned_user_id: 'supervisor-123' }],
      };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithTask as any);
      caseRepository.updateCaseStatusAndCompleteTask.mockResolvedValue({
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED },
        completedTask: { ...mockTask, status: TaskStatus.STATUS_30_COMPLETED },
      } as any);
      taskService.createTask.mockRejectedValue(new Error('Task creation failed'));

      const result = await service.closeCase(1, mockCloseDto, 'supervisor-123', 'tenant-123', 'CMS_SUPERVISOR');

      expect(result.supervisor_closure).toBe(true);
      expect(logger.error).toHaveBeenCalled();
    });

    it('should successfully close case by investigator with approval required', async () => {
      const caseWithTask = {
        ...mockCase,
        tasks: [{ ...mockTask, status: TaskStatus.STATUS_20_IN_PROGRESS }],
      };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithTask as any);
      caseRepository.updateCaseStatusAndCompleteTask.mockResolvedValue({
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL },
        completedTask: { ...mockTask, status: TaskStatus.STATUS_30_COMPLETED },
      } as any);
      taskService.createTask.mockResolvedValue({ task_id: 2, name: 'Approve Case Closure' } as any);

      const result = await service.closeCase(1, mockCloseDto, 'user-123', 'tenant-123', 'investigator');

      expect(result.message).toContain('approval');
      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Approve Case Closure',
          status: TaskStatus.STATUS_01_UNASSIGNED,
        }),
        'user-123',
        'tenant-123'
      );
      expect(flowableService.handleCaseStatusChanged).toHaveBeenCalledWith({
        caseId: 1,
        newStatus: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        reason: expect.any(String),
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
      expect((prismaService.case.findMany as jest.Mock)).toHaveBeenCalledWith({
        where: { parent_id: 1, tenant_id: 'tenant-123' },
      });
    });

    it('should throw ConflictException if FRAUD_AND_AML sub cases are not closable', async () => {
      const fraudAmlCase = {
        ...mockCase,
        case_type: CaseType.FRAUD_AND_AML as any,
        tasks: [],
      };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(fraudAmlCase as any);
      (prismaService.case.findMany as jest.Mock).mockResolvedValue([
        { ...mockCase, case_id: 2, parent_id: 1, status: CaseStatus.STATUS_20_IN_PROGRESS },
      ] as any);

      await expect(
        service.closeCase(1, mockCloseDto, 'supervisor-123', 'tenant-123', 'CMS_SUPERVISOR')
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if FRAUD_AND_AML sub cases do not exist', async () => {
      const fraudAmlCase = {
        ...mockCase,
        case_type: CaseType.FRAUD_AND_AML as any,
        tasks: [],
      };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(fraudAmlCase as any);
      (prismaService.case.findMany as jest.Mock).mockResolvedValue([]);

      await expect(
        service.closeCase(1, mockCloseDto, 'supervisor-123', 'tenant-123', 'CMS_SUPERVISOR')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if non-supervisor tries to close FRAUD_AND_AML case', async () => {
      const fraudAmlCase = {
        ...mockCase,
        case_type: CaseType.FRAUD_AND_AML as any,
        tasks: [],
      };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(fraudAmlCase as any);

      await expect(
        service.closeCase(1, mockCloseDto, 'user-123', 'tenant-123', 'investigator')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if case not found', async () => {
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(null);

      await expect(
        service.closeCase(1, mockCloseDto, 'user-123', 'tenant-123', 'investigator')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if case is not in progress', async () => {
      const closedCase = { ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED, tasks: [] };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(closedCase as any);

      await expect(
        service.closeCase(1, mockCloseDto, 'user-123', 'tenant-123', 'investigator')
      ).rejects.toThrow(ConflictException);
    });

    it('should throw BadRequestException if investigation task not found', async () => {
      const caseWithoutTask = { ...mockCase, tasks: [] };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithoutTask as any);

      await expect(
        service.closeCase(1, mockCloseDto, 'user-123', 'tenant-123', 'investigator')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if investigation task not assigned to user', async () => {
      const caseWithTask = {
        ...mockCase,
        tasks: [{ ...mockTask, assigned_user_id: 'other-user', status: TaskStatus.STATUS_20_IN_PROGRESS }],
      };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithTask as any);

      await expect(
        service.closeCase(1, mockCloseDto, 'user-123', 'tenant-123', 'investigator')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if investigation task not in valid status', async () => {
      const caseWithTask = {
        ...mockCase,
        tasks: [{ ...mockTask, status: TaskStatus.STATUS_01_UNASSIGNED }],
      };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithTask as any);

      await expect(
        service.closeCase(1, mockCloseDto, 'user-123', 'tenant-123', 'investigator')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      caseRepository.findCaseWithPermissionCheck.mockRejectedValue(new Error('Database error'));

      await expect(
        service.closeCase(1, mockCloseDto, 'user-123', 'tenant-123', 'investigator')
      ).rejects.toThrow(InternalServerErrorException);
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
  });

  describe('approveCaseClosure', () => {
    it('should successfully approve case closure', async () => {
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
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED },
        completedTask: { task_id: 2, status: TaskStatus.STATUS_30_COMPLETED },
      } as any);
      commentService.addComment.mockResolvedValue({} as any);

      const result = await service.approveCaseClosure(
        1,
        'STATUS_82_CLOSED_CONFIRMED',
        'Approved',
        'supervisor-123',
        'tenant-123'
      );

      expect(result.message).toBe('Case closure approved');
      expect(flowableService.handleTaskCompleted).toHaveBeenCalled();
      expect(commentService.addComment).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should create SAR filing task when approving confirmed case', async () => {
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
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED },
        completedTask: { task_id: 2, status: TaskStatus.STATUS_30_COMPLETED },
      } as any);
      commentService.addComment.mockResolvedValue({} as any);
      taskService.createTask.mockResolvedValue({ task_id: 3, name: 'SAR_STR_FILING' } as any);

      await service.approveCaseClosure(
        1,
        'STATUS_82_CLOSED_CONFIRMED',
        'Approved',
        'supervisor-123',
        'tenant-123'
      );

      expect(taskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'SAR/STR Filing' }),
        'supervisor-123',
        'tenant-123'
      );
    });

    it('should send notification to investigator on approval', async () => {
      const pendingCase = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [
          { ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 },
          { ...mockTask, name: 'Investigate Case', status: TaskStatus.STATUS_30_COMPLETED, assigned_user_id: 'investigator-123', task_id: 1 },
        ],
        comments: [{ note: 'Recommended Outcome: Confirmed' }],
      };
      caseRepository.findCaseForClosureApproval.mockResolvedValue(pendingCase as any);
      caseRepository.approveClosureTask.mockResolvedValue({
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED },
        completedTask: { task_id: 2, status: TaskStatus.STATUS_30_COMPLETED },
      } as any);
      commentService.addComment.mockResolvedValue({} as any);
      notificationService.sendNotification.mockResolvedValue({} as any);

      await service.approveCaseClosure(
        1,
        'STATUS_82_CLOSED_CONFIRMED',
        'Approved',
        'supervisor-123',
        'tenant-123'
      );

      expect(notificationService.sendNotification).toHaveBeenCalledWith({
        userId: 'investigator-123',
        type: 'CASE_CLOSURE_APPROVED',
        message: expect.any(String),
        metadata: expect.objectContaining({ caseId: 1 }),
      });
    });

    it('should handle notification failure gracefully', async () => {
      const pendingCase = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [
          { ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 },
          { ...mockTask, name: 'Investigate Case', status: TaskStatus.STATUS_30_COMPLETED, assigned_user_id: 'investigator-123', task_id: 1 },
        ],
        comments: [{ note: 'Recommended Outcome: Confirmed' }],
      };
      caseRepository.findCaseForClosureApproval.mockResolvedValue(pendingCase as any);
      caseRepository.approveClosureTask.mockResolvedValue({
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED },
        completedTask: { task_id: 2, status: TaskStatus.STATUS_30_COMPLETED },
      } as any);
      commentService.addComment.mockResolvedValue({} as any);
      notificationService.sendNotification.mockRejectedValue(new Error('Notification failed'));

      const result = await service.approveCaseClosure(
        1,
        'STATUS_82_CLOSED_CONFIRMED',
        'Approved',
        'supervisor-123',
        'tenant-123'
      );

      expect(result.message).toBe('Case closure approved');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should handle SAR filing task creation failure gracefully', async () => {
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
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_82_CLOSED_CONFIRMED },
        completedTask: { task_id: 2, status: TaskStatus.STATUS_30_COMPLETED },
      } as any);
      commentService.addComment.mockResolvedValue({} as any);
      taskService.createTask.mockRejectedValue(new Error('Task creation failed'));

      const result = await service.approveCaseClosure(
        1,
        'STATUS_82_CLOSED_CONFIRMED',
        'Approved',
        'supervisor-123',
        'tenant-123'
      );

      expect(result.message).toBe('Case closure approved');
      expect(logger.error).toHaveBeenCalled();
    });

    it('should throw BadRequestException for invalid final outcome', async () => {
      await expect(
        service.approveCaseClosure(1, 'INVALID_OUTCOME', 'Approved', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if case not found', async () => {
      caseRepository.findCaseForClosureApproval.mockResolvedValue(null);

      await expect(
        service.approveCaseClosure(1, 'STATUS_82_CLOSED_CONFIRMED', 'Approved', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ConflictException if case not pending approval', async () => {
      const wrongStatusCase = { ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS, tasks: [], comments: [] };
      caseRepository.findCaseForClosureApproval.mockResolvedValue(wrongStatusCase as any);

      await expect(
        service.approveCaseClosure(1, 'STATUS_82_CLOSED_CONFIRMED', 'Approved', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if approval task not found', async () => {
      const caseWithoutApprovalTask = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [],
        comments: [],
      };
      caseRepository.findCaseForClosureApproval.mockResolvedValue(caseWithoutApprovalTask as any);

      await expect(
        service.approveCaseClosure(1, 'STATUS_82_CLOSED_CONFIRMED', 'Approved', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if case has incomplete information', async () => {
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

      await expect(
        service.approveCaseClosure(1, 'STATUS_82_CLOSED_CONFIRMED', 'Approved', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw InternalServerErrorException on unexpected error', async () => {
      caseRepository.findCaseForClosureApproval.mockRejectedValue(new Error('Database error'));

      await expect(
        service.approveCaseClosure(1, 'STATUS_82_CLOSED_CONFIRMED', 'Approved', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('rejectCaseClosure', () => {
    it('should successfully reject case closure', async () => {
      const pendingCase = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [
          { ...mockTask, name: 'Investigate Case', status: TaskStatus.STATUS_30_COMPLETED, assigned_user_id: 'investigator-123', task_id: 1 },
        ],
      };
      caseRepository.findCaseForReview.mockResolvedValue({
        ...pendingCase,
        tasks: [
          { ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 },
        ],
      } as any);
      caseRepository.findCaseWithCompletedInvestigation.mockResolvedValue(pendingCase as any);
      caseRepository.rejectClosureTask.mockResolvedValue({
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS },
        completedTask: { task_id: 2, status: TaskStatus.STATUS_30_COMPLETED },
        newInvestigationTask: { task_id: 3, name: 'Investigate Case', status: TaskStatus.STATUS_10_ASSIGNED },
      } as any);
      notificationService.sendNotification.mockResolvedValue({} as any);

      const result = await service.rejectCaseClosure(
        1,
        'Need more evidence for fraud confirmation',
        'supervisor-123',
        'tenant-123'
      );

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
          { ...mockTask, name: 'Investigate Case', status: TaskStatus.STATUS_30_COMPLETED, assigned_user_id: 'investigator-123', task_id: 1 },
        ],
      };
      caseRepository.findCaseForReview.mockResolvedValue({
        ...pendingCase,
        tasks: [
          { ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 },
        ],
      } as any);
      caseRepository.findCaseWithCompletedInvestigation.mockResolvedValue(pendingCase as any);
      caseRepository.rejectClosureTask.mockResolvedValue({
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS },
        completedTask: { task_id: 2, status: TaskStatus.STATUS_30_COMPLETED },
        newInvestigationTask: { task_id: 3, name: 'Investigate Case', status: TaskStatus.STATUS_10_ASSIGNED },
      } as any);
      notificationService.sendNotification.mockRejectedValue(new Error('Notification failed'));

      const result = await service.rejectCaseClosure(
        1,
        'Need more evidence',
        'supervisor-123',
        'tenant-123'
      );

      expect(result.message).toContain('rejected');
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should throw BadRequestException if comments too short', async () => {
      caseRepository.findCaseForReview.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [{ ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 }],
      } as any);

      await expect(
        service.rejectCaseClosure(1, 'No', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw NotFoundException if case not found', async () => {
      caseRepository.findCaseForReview.mockResolvedValue({
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [{ ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 }],
      } as any);
      caseRepository.findCaseWithCompletedInvestigation.mockResolvedValue(null);

      await expect(
        service.rejectCaseClosure(1, 'Need more evidence', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if original investigator cannot be determined', async () => {
      const taskWithoutAssignee = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [
          { ...mockTask, name: 'Investigate Case', status: TaskStatus.STATUS_30_COMPLETED, assigned_user_id: null, task_id: 1 },
        ],
      };
      caseRepository.findCaseForReview.mockResolvedValue({
        ...taskWithoutAssignee,
        tasks: [{ ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, task_id: 2 }],
      } as any);
      caseRepository.findCaseWithCompletedInvestigation.mockResolvedValue(taskWithoutAssignee as any);

      await expect(
        service.rejectCaseClosure(1, 'Need more evidence', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('returnCaseForReview', () => {
    it('should successfully return case for review', async () => {
      const pendingCase = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [
          { ...mockTask, name: 'approve case closure', status: TaskStatus.STATUS_10_ASSIGNED, assigned_user_id: 'supervisor-123', task_id: 2 },
        ],
      };
      caseRepository.findCaseForReview.mockResolvedValue(pendingCase as any);
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          case: { update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS }) },
          task: { findFirst: jest.fn().mockResolvedValue({ task_id: 2, name: 'approve case closure' }), update: jest.fn().mockResolvedValue({ task_id: 2, status: TaskStatus.STATUS_30_COMPLETED }) },
        };
        commentRepository.createComment.mockResolvedValue({} as any);
        return await callback(mockTx as any);
      });

      const result = await service.returnCaseForReview(
        1,
        'Please review additional evidence',
        'supervisor-123',
        'tenant-123'
      );

      expect(result.message).toContain('returned');
      expect(flowableService.handleCaseStatusChanged).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should throw NotFoundException if approval task not found during return', async () => {
      const pendingCase = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [
          { ...mockTask, name: 'approve case closure', status: TaskStatus.STATUS_10_ASSIGNED, assigned_user_id: 'supervisor-123', task_id: 2 },
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

      await expect(
        service.returnCaseForReview(1, 'Review needed', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle auto-claim of approval task', async () => {
      const pendingCase = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [
          { ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, assigned_user_id: null, task_id: 2 },
        ],
      };
      
      // Mock first call to return unassigned task with error
      const unassignedTask = { task_id: 2, name: 'Approve Case Closure', status: TaskStatus.STATUS_01_UNASSIGNED, assigned_user_id: null };
      (taskValidationUtil.validateApprovalTaskForClosure as jest.Mock)
        .mockReturnValueOnce({ 
          isValid: false, 
          errors: ['Approval task must be claimed'],
          approvalTask: unassignedTask
        })
        // After claiming, return valid
        .mockReturnValueOnce({ 
          isValid: true, 
          approvalTask: { ...unassignedTask, assigned_user_id: 'supervisor-123', status: TaskStatus.STATUS_10_ASSIGNED }
        });
        
      caseRepository.findCaseForReview.mockResolvedValueOnce(pendingCase as any);
      taskService.claimTask.mockResolvedValue({} as any);
      
      // After claiming, return same case with updated task status
      caseRepository.findCaseForReview.mockResolvedValueOnce({
        ...pendingCase,
        tasks: [
          { ...mockTask, name: 'Approve Case Closure', status: TaskStatus.STATUS_10_ASSIGNED, assigned_user_id: 'supervisor-123', task_id: 2 },
        ],
      } as any);
      
      prismaService.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          case: { update: jest.fn().mockResolvedValue({ ...mockCase, status: CaseStatus.STATUS_20_IN_PROGRESS }) },
          task: { findFirst: jest.fn().mockResolvedValue({ task_id: 2, name: 'approve case closure' }), update: jest.fn().mockResolvedValue({ task_id: 2, status: TaskStatus.STATUS_30_COMPLETED }) },
        };
        commentRepository.createComment.mockResolvedValue({} as any);
        return await callback(mockTx as any);
      });

      const result = await service.returnCaseForReview(1, 'Review needed', 'supervisor-123', 'tenant-123');

      expect(taskService.claimTask).toHaveBeenCalledWith(2, 'supervisor-123', 'tenant-123');
      expect(result.message).toContain('returned');
    });
  });

  describe('edge cases and error handling', () => {
    it('should log error on failed operation in approveCaseClosure', async () => {
      caseRepository.findCaseForClosureApproval.mockRejectedValue(new Error('Database connection lost'));

      await expect(
        service.approveCaseClosure(1, 'STATUS_82_CLOSED_CONFIRMED', 'Approved', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow(InternalServerErrorException);

      expect(logger.error).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
        })
      );
    });

    it('should log error on failed operation in rejectCaseClosure', async () => {
      caseRepository.findCaseForReview.mockRejectedValue(new Error('Database error'));

      await expect(
        service.rejectCaseClosure(1, 'Need more evidence', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
        })
      );
    });

    it('should log error on failed operation in returnCaseForReview', async () => {
      caseRepository.findCaseForReview.mockRejectedValue(new Error('Database error'));

      await expect(
        service.returnCaseForReview(1, 'Review needed', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow();

      expect(logger.error).toHaveBeenCalled();
      expect(loggingOrchestrationService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
        })
      );
    });

    it('should handle validation error when other tasks are incomplete', async () => {
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
      
      // Mock to return that other tasks are incomplete
      (taskValidationUtil.validateOtherTasksCompleted as jest.Mock)
        .mockReturnValueOnce({ isValid: false, incompleteTasks: [{ task_id: 3, name: 'Some Other Task' }] });

      await expect(
        service.rejectCaseClosure(1, 'Need more evidence', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow(BadRequestException);
    });

    it('should sort investigation tasks and use the latest one', async () => {
      const oldTask = { ...mockTask, task_id: 1, name: 'Investigate Case', status: TaskStatus.STATUS_20_IN_PROGRESS, assigned_user_id: 'user-123', created_at: new Date('2023-01-01') };
      const newTask = { ...mockTask, task_id: 2, name: 'Investigate Case', status: TaskStatus.STATUS_20_IN_PROGRESS, assigned_user_id: 'user-123', created_at: new Date('2023-01-02') };
      const caseWithMultipleTasks = {
        ...mockCase,
        tasks: [oldTask, newTask],
      };
      caseRepository.findCaseWithPermissionCheck.mockResolvedValue(caseWithMultipleTasks as any);
      caseRepository.updateCaseStatusAndCompleteTask.mockResolvedValue({
        updatedCase: { ...mockCase, status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL },
        completedTask: { ...newTask, status: TaskStatus.STATUS_30_COMPLETED },
      } as any);
      taskService.createTask.mockResolvedValue({ task_id: 3 } as any);

      await service.closeCase(1, mockCloseDto, 'user-123', 'tenant-123', 'investigator');

      // Should use the newer task (task_id: 2)
      expect(caseRepository.updateCaseStatusAndCompleteTask).toHaveBeenCalledWith(
        1,
        CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        2,
        expect.any(String),
        expect.anything()
      );
    });

    it('should throw NotFoundException when validation finds no approval task', async () => {
      const pendingCase = {
        ...mockCase,
        status: CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL,
        tasks: [],
      };
      caseRepository.findCaseForReview.mockResolvedValue(pendingCase as any);

      await expect(
        service.returnCaseForReview(1, 'Review needed', 'supervisor-123', 'tenant-123')
      ).rejects.toThrow();
    });
  });
});
