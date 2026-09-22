import { Test, TestingModule } from '@nestjs/testing';
import { TaskLifecycleService } from '../src/modules/task/services/task-lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommentRepository } from '../src/modules/repository/comment.repository';
import { TaskRepository } from '../src/modules/repository/task.repository';
import { CaseRepository } from '../src/modules/repository/case.repository';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { NotificationService } from '../src/modules/notification/notification.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { TaskStatus, CaseStatus } from '@prisma/client-cms';
import { TASK_NAMES } from '../src/constants/case.constants';
import { RbacService, EndpointKey } from '../src/utils/rbac/rbacHelper';
import { AuthenticatedUser } from '../src/utils/types/auth.types';
import { UserService } from '../src/modules/user/user.service';
import { CaseInvestigatorService } from '../src/modules/case-investigator/case-investigator.service';
import * as timersPromises from 'node:timers/promises';

jest.mock('node:timers/promises', () => ({ setTimeout: jest.fn().mockResolvedValue(undefined) }));

describe('TaskLifecycleService', () => {
  let service: TaskLifecycleService;
  let prisma: PrismaService;
  let taskRepository: TaskRepository;
  let caseRepository: CaseRepository;
  let commentRepository: CommentRepository;
  let flowableService: FlowableService;
  let notificationService: NotificationService;
  let loggingService: LoggingOrchestrationService;
  let loggerService: LoggerService;
  let eventEmitter: EventEmitter2;
  let caseInvestigatorService: CaseInvestigatorService;

  const mockPrisma = {
    task: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(),
  };

  const mockCommentRepository = {
    createComment: jest.fn(),
  };

  const mockTaskRepository = {
    transaction: jest.fn().mockImplementation(async (callback) => {
      const tx = {
        task: mockPrisma.task,
        case: mockPrisma.case,
      };
      return await callback(tx);
    }),
    findTaskById: jest.fn(),
    updateTask: jest.fn(),
    findTasks: jest.fn(),
  };

  const mockCaseRepository = {
    findCaseById: jest.fn(),
  };

  const mockFlowableService = {
    handleTaskAssigned: jest.fn(),
    handleCaseStatusChanged: jest.fn(),
    handleTaskUnassigned: jest.fn(),
    handleTaskCompleted: jest.fn(),
  };

  const mockNotificationService = {
    sendNotification: jest.fn(),
  };

  const mockUserService = {
    getUsersByRole: jest.fn().mockResolvedValue([]),
  };

  const mockLoggingService = {
    logActionsWithHistory: jest.fn().mockResolvedValue(undefined),
  };

  const mockLoggerService = {
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  const mockRbacService = {
    getRoleFromUser: jest.fn().mockReturnValue('CMS_SUPERVISOR'),
    checkTier2: jest.fn().mockReturnValue({ allowed: true }),
    checkTier3: jest.fn().mockReturnValue({ allowed: true }),
  };

  const mockCaseInvestigatorService = {
    isBlacklisted: jest.fn().mockResolvedValue(null),
    syncTaskAssignment: jest.fn().mockResolvedValue(undefined),
  };

  const mockSupervisorUser: AuthenticatedUser = {
    token: {} as any,
    validated: {} as any,
    validClaims: [],
    tenantId: 'tenant1',
    userId: 'supervisor1',
    actorRole: 'CMS_SUPERVISOR',
    actorName: 'Supervisor User',
    actorEmail: 'supervisor@test.com',
    tenantName: 'Test Tenant',
  };

  const mockInvestigatorUser: AuthenticatedUser = {
    token: {} as any,
    validated: {} as any,
    validClaims: [],
    tenantId: 'tenant1',
    userId: 'user1',
    actorRole: 'CMS_INVESTIGATOR',
    actorName: 'Investigator User',
    actorEmail: 'investigator@test.com',
    tenantName: 'Test Tenant',
  };

  const mockComplianceOfficerUser: AuthenticatedUser = {
    token: {} as any,
    validated: {} as any,
    validClaims: [],
    tenantId: 'tenant1',
    userId: 'compliance1',
    actorRole: 'CMS_COMPLIANCE_OFFICER',
    actorName: 'Compliance Officer',
    actorEmail: 'compliance@test.com',
    tenantName: 'Test Tenant',
  };

  const testEndpointKey: EndpointKey = 'PATCH /api/v1/task/:taskId/assign' as EndpointKey;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskLifecycleService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
        {
          provide: TaskRepository,
          useValue: mockTaskRepository,
        },
        {
          provide: CaseRepository,
          useValue: mockCaseRepository,
        },
        {
          provide: CommentRepository,
          useValue: mockCommentRepository,
        },
        {
          provide: FlowableService,
          useValue: mockFlowableService,
        },
        {
          provide: NotificationService,
          useValue: mockNotificationService,
        },
        {
          provide: UserService,
          useValue: mockUserService,
        },
        {
          provide: LoggingOrchestrationService,
          useValue: mockLoggingService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: EventEmitter2,
          useValue: mockEventEmitter,
        },
        {
          provide: RbacService,
          useValue: mockRbacService,
        },
        {
          provide: CaseInvestigatorService,
          useValue: mockCaseInvestigatorService,
        },
      ],
    }).compile();

    service = module.get<TaskLifecycleService>(TaskLifecycleService);
    prisma = module.get(PrismaService);
    taskRepository = module.get(TaskRepository);
    caseRepository = module.get(CaseRepository);
    commentRepository = module.get(CommentRepository);
    flowableService = module.get(FlowableService);
    notificationService = module.get(NotificationService);
    loggingService = module.get(LoggingOrchestrationService);
    loggerService = module.get(LoggerService);
    eventEmitter = module.get(EventEmitter2);
    caseInvestigatorService = module.get(CaseInvestigatorService);

    // jest.clearAllMocks() in afterEach clears call history but NOT
    // mockResolvedValue overrides — a test that overrides isBlacklisted/
    // syncTaskAssignment (e.g. to simulate a blacklist hit or a sync
    // failure) would otherwise leak that override into every later test.
    // Restore the known-good defaults explicitly before each test.
    mockCaseInvestigatorService.isBlacklisted.mockResolvedValue(null);
    mockCaseInvestigatorService.syncTaskAssignment.mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('assignTaskToInvestigator', () => {
    const existingTask = {
      task_id: 1,
      case_id: 1,
      name: 'Investigate Case',
      status: TaskStatus.STATUS_01_UNASSIGNED,
      assigned_user_id: null,
      tenant_id: 'tenant1',
    };

    const existingCase = {
      case_id: 1,
      status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      tenant_id: 'tenant1',
    };

    it('should assign investigation task and update case status', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);

      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        assigned_user_id: 'user1',
        status: TaskStatus.STATUS_10_ASSIGNED,
      });

      mockPrisma.case.update.mockResolvedValue({
        ...existingCase,
        status: CaseStatus.STATUS_10_ASSIGNED,
        case_owner_user_id: 'user1',
      });

      const result = await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1', mockSupervisorUser, testEndpointKey, 'Assign note');

      expect(result.assigned_user_id).toBe('user1');
      expect(mockFlowableService.handleCaseStatusChanged).toHaveBeenCalled();
      expect(mockFlowableService.handleTaskAssigned).toHaveBeenCalled();
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          type: 'TASK_ASSIGNED',
        }),
      );
      expect(mockLoggingService.logActionsWithHistory).toHaveBeenCalled();
      // assignment must sync case_investigators.
      expect(mockCaseInvestigatorService.syncTaskAssignment).toHaveBeenCalledWith(1, 'tenant1', 'supervisor1', {
        taskId: 1,
        previousAssigneeId: null,
        newAssigneeId: 'user1',
        newStatus: TaskStatus.STATUS_10_ASSIGNED,
      });
    });

    it('should refuse to assign to a user blacklisted on this case, without writing anything', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);
      mockCaseInvestigatorService.isBlacklisted.mockResolvedValue({
        blocked_by: 'supervisor1',
        blocked_at: new Date('2026-01-01T00:00:00Z'),
        block_reason: 'conflict of interest',
      });

      await expect(
        service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1', mockSupervisorUser, testEndpointKey),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.task.update).not.toHaveBeenCalled();
      expect(mockCaseInvestigatorService.syncTaskAssignment).not.toHaveBeenCalled();
    });

    it('should not fail the assignment if ACL sync throws (best-effort)', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);
      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        assigned_user_id: 'user1',
        status: TaskStatus.STATUS_10_ASSIGNED,
      });
      mockPrisma.case.update.mockResolvedValue({
        ...existingCase,
        status: CaseStatus.STATUS_10_ASSIGNED,
      });
      mockCaseInvestigatorService.syncTaskAssignment.mockRejectedValue(new Error('no live row to revoke'));

      const result = await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1', mockSupervisorUser, testEndpointKey);

      expect(result.assigned_user_id).toBe('user1');
      expect(mockLoggerService.warn).toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.assignTaskToInvestigator(999, 'user1', 'supervisor1', 'tenant1', mockSupervisorUser, testEndpointKey)).rejects.toThrow(NotFoundException);
    });

    it('should handle case retrieval', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);
      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        assigned_user_id: 'user1',
        status: TaskStatus.STATUS_10_ASSIGNED,
      });
      mockPrisma.case.update.mockResolvedValue({
        ...existingCase,
        status: CaseStatus.STATUS_10_ASSIGNED,
      });

      const result = await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1', mockSupervisorUser, testEndpointKey);
      expect(result.assigned_user_id).toBe('user1');
    });

    it('should handle non-investigation task without updating case status', async () => {
      const nonInvestigationTask = {
        ...existingTask,
        name: 'Review Document',
      };

      mockTaskRepository.findTaskById.mockResolvedValue(nonInvestigationTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: jest.fn().mockResolvedValue({
              ...nonInvestigationTask,
              assigned_user_id: 'user1',
              status: TaskStatus.STATUS_10_ASSIGNED,
            }),
          },
          case: {
            update: jest.fn(),
          },
        };
        return callback(mockTx);
      });

      await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1', mockSupervisorUser, testEndpointKey);

      expect(mockFlowableService.handleCaseStatusChanged).not.toHaveBeenCalled();
    });

    it('should create comment if note provided', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);

      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        assigned_user_id: 'user1',
      });
      mockPrisma.case.update.mockResolvedValue(existingCase);

      await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1', mockSupervisorUser, testEndpointKey, 'Assignment note');

      expect(mockCommentRepository.createComment).toHaveBeenCalled();
    });

    it('should assign task by updating the task case once', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);

      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        assigned_user_id: 'user1',
        status: TaskStatus.STATUS_10_ASSIGNED,
      });
      mockPrisma.case.update.mockResolvedValue({
        ...existingCase,
        status: CaseStatus.STATUS_10_ASSIGNED,
      });
      mockPrisma.case.findFirst.mockResolvedValue({
        case_id: 11,
        status: CaseStatus.STATUS_10_ASSIGNED,
      });

      await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1', mockSupervisorUser, testEndpointKey);

      expect(mockFlowableService.handleCaseStatusChanged).toHaveBeenCalled();
      expect(mockPrisma.case.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.case.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('reassignTask', () => {
    const existingTask = {
      task_id: 1,
      case_id: 1,
      name: 'Investigate Case',
      status: TaskStatus.STATUS_10_ASSIGNED,
      assigned_user_id: 'user1',
      tenant_id: 'tenant1',
    };

    const existingCase = {
      case_id: 1,
      status: CaseStatus.STATUS_20_IN_PROGRESS,
      tenant_id: 'tenant1',
    };

    it('should reassign task successfully', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);

      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        assigned_user_id: 'user2',
      });
      mockPrisma.case.update.mockResolvedValue({
        ...existingCase,
        status: CaseStatus.STATUS_10_ASSIGNED,
        case_owner_user_id: 'user2',
      });

      const result = await service.reassignTask(1, 'supervisor1', 'tenant1', 'user2', 'Reassign note', mockSupervisorUser, testEndpointKey);

      expect(result.assigned_user_id).toBe('user2');
      expect(mockCommentRepository.createComment).toHaveBeenCalled();
      expect(mockLoggingService.logActionsWithHistory).toHaveBeenCalled();
      expect(mockCaseInvestigatorService.syncTaskAssignment).toHaveBeenCalledWith(1, 'tenant1', 'supervisor1', {
        taskId: 1,
        previousAssigneeId: 'user1',
        newAssigneeId: 'user2',
        newStatus: TaskStatus.STATUS_10_ASSIGNED,
      });
    });

    it('should refuse to reassign to a user blacklisted on this case, without writing anything', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);
      mockCaseInvestigatorService.isBlacklisted.mockResolvedValue({
        blocked_by: 'supervisor1',
        blocked_at: new Date('2026-01-01T00:00:00Z'),
        block_reason: 'conflict of interest',
      });

      await expect(
        service.reassignTask(1, 'supervisor1', 'tenant1', 'user2', 'note', mockSupervisorUser, testEndpointKey),
      ).rejects.toThrow(ForbiddenException);
      expect(mockPrisma.task.update).not.toHaveBeenCalled();
      expect(mockCaseInvestigatorService.syncTaskAssignment).not.toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.reassignTask(999, 'supervisor1', 'tenant1', 'user2', 'note', mockSupervisorUser, testEndpointKey)).rejects.toThrow(NotFoundException);
    });

    it('should reassign task by updating the task case once', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);

      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        assigned_user_id: 'user2',
      });
      mockPrisma.case.update.mockResolvedValue({
        ...existingCase,
        status: CaseStatus.STATUS_10_ASSIGNED,
      });
      mockPrisma.case.findFirst.mockResolvedValue({
        case_id: 11,
        status: CaseStatus.STATUS_10_ASSIGNED,
      });

      await service.reassignTask(1, 'supervisor1', 'tenant1', 'user2', 'Reassign note', mockSupervisorUser, testEndpointKey);

      expect(mockFlowableService.handleCaseStatusChanged).toHaveBeenCalled();
      expect(mockPrisma.case.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.case.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('unassignTask', () => {
    const existingTask = {
      task_id: 1,
      case_id: 1,
      name: 'Investigate Case',
      status: TaskStatus.STATUS_10_ASSIGNED,
      assigned_user_id: 'user1',
      tenant_id: 'tenant1',
    };

    const existingCase = {
      case_id: 1,
      status: CaseStatus.STATUS_20_IN_PROGRESS,
      tenant_id: 'tenant1',
    };

    it('should unassign task successfully', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);

      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        assigned_user_id: null,
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });
      mockPrisma.case.update.mockResolvedValue({
        ...existingCase,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        case_owner_user_id: null,
      });

      const result = await service.unassignTask(1, 'supervisor1', 'tenant1', 'Workload rebalancing', mockSupervisorUser, testEndpointKey);

      expect(result.assigned_user_id).toBeNull();
      expect(result.unassignmentReason).toBe('Workload rebalancing');
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          type: 'TASK_UNASSIGNED',
        }),
      );
      expect(mockFlowableService.handleCaseStatusChanged).toHaveBeenCalled();
      expect(mockFlowableService.handleTaskUnassigned).toHaveBeenCalled();
      expect(mockLoggingService.logActionsWithHistory).toHaveBeenCalled();
      // unassignment must sync case_investigators —
      // newAssigneeId is null, matching syncTaskAssignment's
      // reassignment/unassignment branch (revokes unless another live claim).
      expect(mockCaseInvestigatorService.syncTaskAssignment).toHaveBeenCalledWith(1, 'tenant1', 'supervisor1', {
        taskId: 1,
        previousAssigneeId: 'user1',
        newAssigneeId: null,
        newStatus: TaskStatus.STATUS_01_UNASSIGNED,
      });
    });

    it('should throw BadRequestException if reason is empty', async () => {
      await expect(service.unassignTask(1, 'supervisor1', 'tenant1', '', mockSupervisorUser, testEndpointKey)).rejects.toThrow(
        new BadRequestException('Reason for unassigning task is required'),
      );
    });

    it('should throw BadRequestException if reason is only whitespace', async () => {
      await expect(service.unassignTask(1, 'supervisor1', 'tenant1', '   ', mockSupervisorUser, testEndpointKey)).rejects.toThrow(
        new BadRequestException('Reason for unassigning task is required'),
      );
    });

    it('should throw BadRequestException if task is completed', async () => {
      const completedTask = { ...existingTask, status: TaskStatus.STATUS_30_COMPLETED };
      mockTaskRepository.findTaskById.mockResolvedValue(completedTask);

      await expect(service.unassignTask(1, 'supervisor1', 'tenant1', 'reason', mockSupervisorUser, testEndpointKey)).rejects.toThrow(
        new BadRequestException('Cannot unassign a completed task (1)'),
      );
    });

    it('should throw BadRequestException if task already unassigned', async () => {
      const unassignedTask = { ...existingTask, assigned_user_id: null };
      mockTaskRepository.findTaskById.mockResolvedValue(unassignedTask);

      await expect(service.unassignTask(1, 'supervisor1', 'tenant1', 'reason', mockSupervisorUser, testEndpointKey)).rejects.toThrow(
        new BadRequestException('Task 1 is already unassigned'),
      );
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.unassignTask(999, 'supervisor1', 'tenant1', 'reason', mockSupervisorUser, testEndpointKey)).rejects.toThrow(NotFoundException);
    });

    it('should handle SAR/STR Filing task without updating case status', async () => {
      const sarTask = { ...existingTask, name: 'SAR/STR Filing' };
      mockTaskRepository.findTaskById.mockResolvedValue(sarTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);

      mockPrisma.task.update.mockResolvedValue({
        ...sarTask,
        assigned_user_id: null,
      });

      await service.unassignTask(1, 'supervisor1', 'tenant1', 'reason', mockSupervisorUser, testEndpointKey);

      expect(mockPrisma.task.update).toHaveBeenCalled();
    });

    it('unassignTask SAR/STR Filing: does NOT change case status in Postgres OR Flowable', async () => {
      const taskId = 1;
      const actorUserId = 'supervisor1';
      const sarTask = { ...existingTask, task_id: taskId, name: 'SAR/STR Filing' };
      mockTaskRepository.findTaskById.mockResolvedValue(sarTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);
      mockPrisma.task.update.mockResolvedValue({
        ...sarTask,
        assigned_user_id: null,
        status: TaskStatus.STATUS_01_UNASSIGNED,
      });

      await service.unassignTask(taskId, actorUserId, 'tenant1', 'switching filer', mockSupervisorUser, testEndpointKey);

      expect(mockPrisma.case.update).not.toHaveBeenCalled();
      expect(mockFlowableService.handleCaseStatusChanged).not.toHaveBeenCalled();
      expect(mockFlowableService.handleTaskUnassigned).toHaveBeenCalledWith(expect.objectContaining({ taskId }));
    });

    it('should handle notification errors gracefully', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);

      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        assigned_user_id: null,
      });
      mockPrisma.case.update.mockResolvedValue(existingCase);

      mockNotificationService.sendNotification.mockRejectedValue(new Error('Notification failed'));

      const result = await service.unassignTask(1, 'supervisor1', 'tenant1', 'reason', mockSupervisorUser, testEndpointKey);

      expect(result).toBeDefined();
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed notifications for unassign'),
        expect.anything(),
        'TaskLifecycleService',
      );
    });

    it('should unassign task by updating the task case once', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);

      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        assigned_user_id: null,
      });
      mockPrisma.case.update.mockResolvedValue({
        ...existingCase,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      });
      mockPrisma.case.findFirst.mockResolvedValue({
        case_id: 11,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      });

      await service.unassignTask(1, 'supervisor1', 'tenant1', 'reason', mockSupervisorUser, testEndpointKey);

      expect(mockFlowableService.handleCaseStatusChanged).toHaveBeenCalled();
      expect(mockPrisma.case.findFirst).not.toHaveBeenCalled();
      expect(mockPrisma.case.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('unassignTaskDueToAccessChange', () => {
    // Called by CaseInvestigatorService.revoke/blacklist as a cascade -
    // no RBAC/AuthenticatedUser involved, and deliberately does not call
    // syncCaseAcl (that would re-enter the in-progress revoke/blacklist).
    const existingTask = {
      task_id: 1,
      case_id: 1,
      name: 'Investigate Case',
      status: TaskStatus.STATUS_10_ASSIGNED,
      assigned_user_id: 'user1',
      tenant_id: 'tenant1',
    };

    it('unassigns the task and notifies the previous assignee, without an AuthenticatedUser or RBAC check', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockPrisma.task.update.mockResolvedValue({ ...existingTask, assigned_user_id: null, status: TaskStatus.STATUS_01_UNASSIGNED });
      mockPrisma.case.update.mockResolvedValue({ case_id: 1, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT });

      await service.unassignTaskDueToAccessChange(1, 'supervisor1', 'tenant1', 'Investigator access revoked: reassigned');

      expect(mockPrisma.task.update).toHaveBeenCalledWith({
        where: { task_id: 1 },
        data: { assigned_user_id: null, status: TaskStatus.STATUS_01_UNASSIGNED },
      });
      expect(mockFlowableService.handleTaskUnassigned).toHaveBeenCalledWith(
        expect.objectContaining({ taskId: 1, caseId: 1, assignedUser: null }),
      );
      expect(mockNotificationService.sendNotification).toHaveBeenCalledWith(
        expect.objectContaining({ userId: 'user1', type: 'TASK_UNASSIGNED' }),
      );
    });

    it('does not call syncCaseAcl / CaseInvestigatorService - that would re-enter the in-progress revoke/blacklist', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockPrisma.task.update.mockResolvedValue({ ...existingTask, assigned_user_id: null, status: TaskStatus.STATUS_01_UNASSIGNED });
      mockPrisma.case.update.mockResolvedValue({ case_id: 1, status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT });

      await service.unassignTaskDueToAccessChange(1, 'supervisor1', 'tenant1', 'reason');

      expect(mockCaseInvestigatorService.syncTaskAssignment).not.toHaveBeenCalled();
    });

    it('no-ops silently when the task is already unassigned', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue({ ...existingTask, assigned_user_id: null });

      await service.unassignTaskDueToAccessChange(1, 'supervisor1', 'tenant1', 'reason');

      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });

    it('no-ops silently when the task is already completed - does not reopen a finished task', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue({ ...existingTask, status: TaskStatus.STATUS_30_COMPLETED });

      await service.unassignTaskDueToAccessChange(1, 'supervisor1', 'tenant1', 'reason');

      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });

    it('no-ops silently when the task no longer exists', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.unassignTaskDueToAccessChange(999, 'supervisor1', 'tenant1', 'reason')).resolves.toBeUndefined();
      expect(mockPrisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe('handleAccessRemoved', () => {
    // The @OnEvent('case-investigator.access-removed') listener -
    // CaseInvestigatorService.revoke()/blacklist() emit this rather than
    // calling TaskLifecycleService directly (see the module-level comment
    // on case-investigator.module.ts for why). This is the other half of
    // that cascade: find every live task the target held on the case and
    // unassign each one via unassignTaskDueToAccessChange.
    const event = {
      caseId: 1,
      userId: 'user1',
      tenantId: 'tenant1',
      actorUserId: 'supervisor1',
      reason: 'Investigator access revoked: reassigned',
    };

    it('unassigns every live (non-completed) task the user holds on the case', async () => {
      mockTaskRepository.findTasks.mockResolvedValue([{ task_id: 10 }, { task_id: 11 }]);
      const spy = jest.spyOn(service, 'unassignTaskDueToAccessChange').mockResolvedValue(undefined);

      await service.handleAccessRemoved(event);

      expect(mockTaskRepository.findTasks).toHaveBeenCalledWith(
        { case_id: 1, assigned_user_id: 'user1', status: { not: TaskStatus.STATUS_30_COMPLETED } },
        'tenant1',
        false,
      );
      expect(spy).toHaveBeenCalledWith(10, 'supervisor1', 'tenant1', event.reason);
      expect(spy).toHaveBeenCalledWith(11, 'supervisor1', 'tenant1', event.reason);
    });

    it('does nothing when the user holds no live task on the case', async () => {
      mockTaskRepository.findTasks.mockResolvedValue([]);
      const spy = jest.spyOn(service, 'unassignTaskDueToAccessChange').mockResolvedValue(undefined);

      await service.handleAccessRemoved(event);

      expect(spy).not.toHaveBeenCalled();
    });

    it('a failure unassigning one task is logged but does not stop the others or reject', async () => {
      mockTaskRepository.findTasks.mockResolvedValue([{ task_id: 10 }, { task_id: 11 }]);
      const spy = jest
        .spyOn(service, 'unassignTaskDueToAccessChange')
        .mockRejectedValueOnce(new Error('flowable unavailable'))
        .mockResolvedValueOnce(undefined);

      await expect(service.handleAccessRemoved(event)).resolves.toBeUndefined();

      expect(spy).toHaveBeenCalledWith(10, 'supervisor1', 'tenant1', event.reason);
      expect(spy).toHaveBeenCalledWith(11, 'supervisor1', 'tenant1', event.reason);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to unassign task 10'),
        expect.any(Error),
        TaskLifecycleService.name,
      );
    });
  });

  describe('completeTask', () => {
    const existingTask = {
      task_id: 1,
      case_id: 1,
      name: 'Complete Task',
      status: TaskStatus.STATUS_20_IN_PROGRESS,
      assigned_user_id: 'user1',
      tenant_id: 'tenant1',
    };

    it('should complete task successfully', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockTaskRepository.updateTask.mockResolvedValue({
        ...existingTask,
        status: TaskStatus.STATUS_30_COMPLETED,
      });
      mockFlowableService.handleTaskCompleted.mockResolvedValue(undefined);

      const result = await service.completeTask(1, 'user1', 'tenant1', mockInvestigatorUser, testEndpointKey);

      expect(result.status).toBe(TaskStatus.STATUS_30_COMPLETED);
      expect(mockTaskRepository.updateTask).toHaveBeenCalledWith(1, { status: TaskStatus.STATUS_30_COMPLETED }, expect.anything(), true);
      expect(mockFlowableService.handleTaskCompleted).toHaveBeenCalledWith({
        caseId: 1,
        taskName: 'Complete Task',
        newStatus: TaskStatus.STATUS_30_COMPLETED,
        completionVariables: {
          sarStrAction: 'complete',
        },
      });
      expect(mockLoggingService.logActionsWithHistory).toHaveBeenCalled();
      expect(mockCaseInvestigatorService.syncTaskAssignment).toHaveBeenCalledWith(1, 'tenant1', 'user1', {
        taskId: 1,
        previousAssigneeId: 'user1',
        newAssigneeId: 'user1',
        newStatus: TaskStatus.STATUS_30_COMPLETED,
      });
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.completeTask(999, 'user1', 'tenant1', mockInvestigatorUser, testEndpointKey)).rejects.toThrow(NotFoundException);
    });

    it('should not fail completion if ACL sync throws (best-effort, task mutation already committed)', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockTaskRepository.updateTask.mockResolvedValue({
        ...existingTask,
        status: TaskStatus.STATUS_30_COMPLETED,
      });
      mockFlowableService.handleTaskCompleted.mockResolvedValue(undefined);
      mockCaseInvestigatorService.syncTaskAssignment.mockRejectedValue(new Error('no live row to demote'));

      const result = await service.completeTask(1, 'user1', 'tenant1', mockInvestigatorUser, testEndpointKey);

      expect(result.status).toBe(TaskStatus.STATUS_30_COMPLETED);
      expect(mockLoggerService.warn).toHaveBeenCalled();
    });

    it('should handle errors and rethrow them', async () => {
      const error = new Error('Database error');
      mockTaskRepository.findTaskById.mockRejectedValue(error);

      await expect(service.completeTask(1, 'user1', 'tenant1', mockInvestigatorUser, testEndpointKey)).rejects.toThrow(error);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to complete task 1'),
        error.stack,
        'TaskLifecycleService',
      );
    });

    it('should handle flowable service errors with retry mechanism', async () => {
      const setTimeoutSpy = timersPromises.setTimeout as jest.Mock;
      setTimeoutSpy.mockResolvedValue(undefined);
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockTaskRepository.updateTask.mockResolvedValue({
        ...existingTask,
        status: TaskStatus.STATUS_30_COMPLETED,
      });

      // Mock flowable to fail multiple times then succeed
      mockFlowableService.handleTaskCompleted
        .mockRejectedValueOnce(new Error('Temporary failure'))
        .mockRejectedValueOnce(new Error('Another failure'))
        .mockResolvedValueOnce(undefined);

      const result = await service.completeTask(1, 'user1', 'tenant1', mockInvestigatorUser, testEndpointKey);

      expect(result.status).toBe(TaskStatus.STATUS_30_COMPLETED);
      expect(mockFlowableService.handleTaskCompleted).toHaveBeenCalledTimes(3);
      expect(setTimeoutSpy).toHaveBeenCalledTimes(2);
      setTimeoutSpy.mockReset();
    });

    it('should handle max retries exceeded for flowable operation', async () => {
      const setTimeoutSpy = timersPromises.setTimeout as jest.Mock;
      setTimeoutSpy.mockResolvedValue(undefined);
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockTaskRepository.updateTask.mockResolvedValue({
        ...existingTask,
        status: TaskStatus.STATUS_30_COMPLETED,
      });

      // Mock flowable to always fail
      mockFlowableService.handleTaskCompleted.mockRejectedValue(new Error('Persistent failure'));

      const result = await service.completeTask(1, 'user1', 'tenant1', mockInvestigatorUser, testEndpointKey);

      expect(result.status).toBe(TaskStatus.STATUS_30_COMPLETED);
      // Should have attempted retries
      expect(mockFlowableService.handleTaskCompleted).toHaveBeenCalled();
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Max retries reached for Flowable operation.',
        expect.anything(),
        'TaskLifecycleService',
      );
      expect(setTimeoutSpy).toHaveBeenCalledTimes(4);
      setTimeoutSpy.mockReset();
    }, 5000);

    it('should throw ForbiddenException when compliance officer completes a non-SAR/STR task', async () => {
      const nonSarTask = {
        ...existingTask,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_20_IN_PROGRESS,
      };
      const existingCase = {
        case_id: 1,
        status: CaseStatus.STATUS_20_IN_PROGRESS,
        tenant_id: 'tenant1',
      };

      mockTaskRepository.findTaskById.mockResolvedValue(nonSarTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);

      await expect(
        service.completeTask(1, 'compliance1', 'tenant1', mockComplianceOfficerUser, testEndpointKey),
      ).rejects.toThrow(ForbiddenException);

      expect(mockTaskRepository.updateTask).not.toHaveBeenCalled();
    });

    it('should allow compliance officer to complete the SAR/STR Filing task', async () => {
      const sarTask = {
        ...existingTask,
        name: TASK_NAMES.SAR_STR_FILING,
        status: TaskStatus.STATUS_20_IN_PROGRESS,
      };
      const existingCase = {
        case_id: 1,
        status: CaseStatus.STATUS_82_CLOSED_CONFIRMED,
        tenant_id: 'tenant1',
      };

      mockTaskRepository.findTaskById.mockResolvedValue(sarTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);
      mockTaskRepository.updateTask.mockResolvedValue({
        ...sarTask,
        status: TaskStatus.STATUS_30_COMPLETED,
      });
      mockFlowableService.handleTaskCompleted.mockResolvedValue(undefined);

      const result = await service.completeTask(1, 'compliance1', 'tenant1', mockComplianceOfficerUser, testEndpointKey);

      expect(result.status).toBe(TaskStatus.STATUS_30_COMPLETED);
      expect(mockTaskRepository.updateTask).toHaveBeenCalledWith(1, { status: TaskStatus.STATUS_30_COMPLETED }, expect.anything(), true);
    });
  });

  describe('fetchTaskAndCase (private method coverage)', () => {
    it('should fetch task and case with investigation task', async () => {
      const task = {
        task_id: 1,
        case_id: 1,
        name: TASK_NAMES.INVESTIGATE_CASE,
        status: TaskStatus.STATUS_01_UNASSIGNED,
        assigned_user_id: null,
        tenant_id: 'tenant1',
      };
      const caseObj = {
        case_id: 1,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        tenant_id: 'tenant1',
      };

      mockTaskRepository.findTaskById.mockResolvedValue(task);
      mockCaseRepository.findCaseById.mockResolvedValue(caseObj);
      mockPrisma.task.update.mockResolvedValue({
        ...task,
        assigned_user_id: 'user1',
        status: TaskStatus.STATUS_10_ASSIGNED,
      });
      mockPrisma.case.update.mockResolvedValue({
        ...caseObj,
        status: CaseStatus.STATUS_10_ASSIGNED,
      });
      mockFlowableService.handleTaskAssigned.mockResolvedValue(undefined);
      mockFlowableService.handleCaseStatusChanged.mockResolvedValue(undefined);
      mockNotificationService.sendNotification.mockResolvedValue(undefined);

      const result = await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1', mockSupervisorUser, testEndpointKey);

      expect(mockTaskRepository.findTaskById).toHaveBeenCalledWith(1, 'tenant1');
      expect(mockCaseRepository.findCaseById).toHaveBeenCalledWith(1, 'tenant1');
      expect(result.assigned_user_id).toBe('user1');
    });

    it('should throw NotFoundException when task not found in fetchTaskAndCase', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.assignTaskToInvestigator(999, 'user1', 'supervisor1', 'tenant1', mockSupervisorUser, testEndpointKey)).rejects.toThrow(
        new NotFoundException('Task 999 not found'),
      );
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle transaction failures gracefully', async () => {
      const task = {
        task_id: 1,
        case_id: 1,
        name: TASK_NAMES.INVESTIGATE_CASE,
        status: TaskStatus.STATUS_01_UNASSIGNED,
        assigned_user_id: null,
        tenant_id: 'tenant1',
      };
      const caseObj = {
        case_id: 1,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        tenant_id: 'tenant1',
      };

      mockTaskRepository.findTaskById.mockResolvedValue(task);
      mockCaseRepository.findCaseById.mockResolvedValue(caseObj);
      mockTaskRepository.transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1', mockSupervisorUser, testEndpointKey)).rejects.toThrow('Transaction failed');
    });
  });
});
