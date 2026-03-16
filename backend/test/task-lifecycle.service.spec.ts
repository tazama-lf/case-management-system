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
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskStatus, CaseStatus } from '@prisma/client-cms';
import { TASK_NAMES } from '../src/constants/case.constants';

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
      parent_id: null,
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

      const result = await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1', 'Assign note');

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
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.assignTaskToInvestigator(999, 'user1', 'supervisor1', 'tenant1')).rejects.toThrow(NotFoundException);
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

      const result = await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1');
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

      await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1');

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

      await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1', 'Assignment note');

      expect(mockCommentRepository.createComment).toHaveBeenCalled();
    });

    it('should handle task assignment with parent case update', async () => {
      const caseWithParent = { ...existingCase, parent_id: 10 };

      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(caseWithParent);

      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        assigned_user_id: 'user1',
        status: TaskStatus.STATUS_10_ASSIGNED,
      });
      mockPrisma.case.update.mockResolvedValue({
        ...caseWithParent,
        status: CaseStatus.STATUS_10_ASSIGNED,
      });
      mockPrisma.case.findFirst.mockResolvedValue({
        case_id: 11,
        status: CaseStatus.STATUS_10_ASSIGNED,
      });

      await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1');

      expect(mockFlowableService.handleCaseStatusChanged).toHaveBeenCalled();
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
      parent_id: null,
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

      const result = await service.reassignTask(1, 'supervisor1', 'tenant1', 'user2', 'Reassign note');

      expect(result.assigned_user_id).toBe('user2');
      expect(mockCommentRepository.createComment).toHaveBeenCalled();
      expect(mockLoggingService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.reassignTask(999, 'supervisor1', 'tenant1', 'user2', 'note')).rejects.toThrow(NotFoundException);
    });

    it('should handle parent case update during reassignment', async () => {
      const caseWithParent = { ...existingCase, parent_id: 10 };

      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(caseWithParent);

      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        assigned_user_id: 'user2',
      });
      mockPrisma.case.update.mockResolvedValue({
        ...caseWithParent,
        status: CaseStatus.STATUS_10_ASSIGNED,
      });
      mockPrisma.case.findFirst.mockResolvedValue({
        case_id: 11,
        status: CaseStatus.STATUS_10_ASSIGNED,
      });

      await service.reassignTask(1, 'supervisor1', 'tenant1', 'user2', 'Reassign note');

      expect(mockFlowableService.handleCaseStatusChanged).toHaveBeenCalled();
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
      parent_id: null,
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

      const result = await service.unassignTask(1, 'supervisor1', 'tenant1', 'Workload rebalancing');

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
    });

    it('should throw BadRequestException if reason is empty', async () => {
      await expect(service.unassignTask(1, 'supervisor1', 'tenant1', '')).rejects.toThrow(
        new BadRequestException('Reason for unassigning task is required'),
      );
    });

    it('should throw BadRequestException if reason is only whitespace', async () => {
      await expect(service.unassignTask(1, 'supervisor1', 'tenant1', '   ')).rejects.toThrow(
        new BadRequestException('Reason for unassigning task is required'),
      );
    });

    it('should throw BadRequestException if task is completed', async () => {
      const completedTask = { ...existingTask, status: TaskStatus.STATUS_30_COMPLETED };
      mockTaskRepository.findTaskById.mockResolvedValue(completedTask);

      await expect(service.unassignTask(1, 'supervisor1', 'tenant1', 'reason')).rejects.toThrow(
        new BadRequestException('Cannot unassign a completed task (1)'),
      );
    });

    it('should throw BadRequestException if task already unassigned', async () => {
      const unassignedTask = { ...existingTask, assigned_user_id: null };
      mockTaskRepository.findTaskById.mockResolvedValue(unassignedTask);

      await expect(service.unassignTask(1, 'supervisor1', 'tenant1', 'reason')).rejects.toThrow(
        new BadRequestException('Task 1 is already unassigned'),
      );
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.unassignTask(999, 'supervisor1', 'tenant1', 'reason')).rejects.toThrow(NotFoundException);
    });

    it('should handle SAR/STR Filing task without updating case status', async () => {
      const sarTask = { ...existingTask, name: 'SAR/STR Filing' };
      mockTaskRepository.findTaskById.mockResolvedValue(sarTask);
      mockCaseRepository.findCaseById.mockResolvedValue(existingCase);

      mockPrisma.task.update.mockResolvedValue({
        ...sarTask,
        assigned_user_id: null,
      });

      await service.unassignTask(1, 'supervisor1', 'tenant1', 'reason');

      expect(mockPrisma.task.update).toHaveBeenCalled();
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

      const result = await service.unassignTask(1, 'supervisor1', 'tenant1', 'reason');

      expect(result).toBeDefined();
      expect(mockLoggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed notifications for unassign'),
        expect.anything(),
        'TaskLifecycleService',
      );
    });

    it('should handle parent case update during unassignment', async () => {
      const caseWithParent = { ...existingCase, parent_id: 10 };

      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockCaseRepository.findCaseById.mockResolvedValue(caseWithParent);

      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        assigned_user_id: null,
      });
      mockPrisma.case.update.mockResolvedValue({
        ...caseWithParent,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      });
      mockPrisma.case.findFirst.mockResolvedValue({
        case_id: 11,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      });

      await service.unassignTask(1, 'supervisor1', 'tenant1', 'reason');

      expect(mockFlowableService.handleCaseStatusChanged).toHaveBeenCalled();
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

      const result = await service.completeTask(1, 'user1', 'tenant1');

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
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.completeTask(999, 'user1', 'tenant1')).rejects.toThrow(NotFoundException);
    });

    it('should handle errors and rethrow them', async () => {
      const error = new Error('Database error');
      mockTaskRepository.findTaskById.mockRejectedValue(error);

      await expect(service.completeTask(1, 'user1', 'tenant1')).rejects.toThrow(error);
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to complete task 1'),
        error.stack,
        'TaskLifecycleService',
      );
    });

    it('should handle flowable service errors with retry mechanism', async () => {
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

      const result = await service.completeTask(1, 'user1', 'tenant1');

      expect(result.status).toBe(TaskStatus.STATUS_30_COMPLETED);
      expect(mockFlowableService.handleTaskCompleted).toHaveBeenCalledTimes(3);
    });

    it('should handle max retries exceeded for flowable operation', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockTaskRepository.updateTask.mockResolvedValue({
        ...existingTask,
        status: TaskStatus.STATUS_30_COMPLETED,
      });

      // Mock flowable to always fail
      mockFlowableService.handleTaskCompleted.mockRejectedValue(new Error('Persistent failure'));

      const result = await service.completeTask(1, 'user1', 'tenant1');

      expect(result.status).toBe(TaskStatus.STATUS_30_COMPLETED);
      // Should have attempted retries
      expect(mockFlowableService.handleTaskCompleted).toHaveBeenCalled();
      expect(mockLoggerService.error).toHaveBeenCalledWith(
        'Max retries reached for Flowable operation.',
        expect.anything(),
        'TaskLifecycleService',
      );
    }, 30000);
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
        parent_id: null,
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

      const result = await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1');

      expect(mockTaskRepository.findTaskById).toHaveBeenCalledWith(1, 'tenant1');
      expect(mockCaseRepository.findCaseById).toHaveBeenCalledWith(1, 'tenant1');
      expect(result.assigned_user_id).toBe('user1');
    });

    it('should throw NotFoundException when task not found in fetchTaskAndCase', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.assignTaskToInvestigator(999, 'user1', 'supervisor1', 'tenant1')).rejects.toThrow(
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
        parent_id: null,
      };

      mockTaskRepository.findTaskById.mockResolvedValue(task);
      mockCaseRepository.findCaseById.mockResolvedValue(caseObj);
      mockTaskRepository.transaction.mockRejectedValue(new Error('Transaction failed'));

      await expect(service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1')).rejects.toThrow('Transaction failed');
    });
  });
});
