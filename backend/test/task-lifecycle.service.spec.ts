import { Test, TestingModule } from '@nestjs/testing';
import { TaskLifecycleService } from '../src/modules/task/services/task-lifecycle.service';
import { PrismaService } from '../prisma/prisma.service';
import { CommentRepository } from '../src/modules/repository/comment.repository';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { NotificationService } from '../src/modules/notification/notification.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskStatus, CaseStatus } from '@prisma/client-cms';

describe('TaskLifecycleService', () => {
  let service: TaskLifecycleService;
  let prisma: PrismaService;
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

  const mockFlowableService = {
    handleTaskAssigned: jest.fn(),
    handleCaseStatusChanged: jest.fn(),
    handleTaskUnassigned: jest.fn(),
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
    commentRepository = module.get(CommentRepository);
    flowableService = module.get(FlowableService);
    notificationService = module.get(NotificationService);
    loggingService = module.get(LoggingOrchestrationService);
    loggerService = module.get(LoggerService);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
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
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.case.findUnique.mockResolvedValue(existingCase);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: jest.fn().mockResolvedValue({
              ...existingTask,
              assigned_user_id: 'user1',
              status: TaskStatus.STATUS_10_ASSIGNED,
            }),
          },
          case: {
            update: jest.fn().mockResolvedValue({
              ...existingCase,
              status: CaseStatus.STATUS_10_ASSIGNED,
              case_owner_user_id: 'user1',
            }),
          },
        };
        return callback(mockTx);
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
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(
        service.assignTaskToInvestigator(999, 'user1', 'supervisor1', 'tenant1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if case not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.case.findUnique.mockResolvedValue(null);

      await expect(
        service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle non-investigation task without updating case status', async () => {
      const nonInvestigationTask = {
        ...existingTask,
        name: 'Review Document',
      };

      mockPrisma.task.findUnique.mockResolvedValue(nonInvestigationTask);
      mockPrisma.case.findUnique.mockResolvedValue(existingCase);

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
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.case.findUnique.mockResolvedValue(existingCase);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: jest.fn().mockResolvedValue({
              ...existingTask,
              assigned_user_id: 'user1',
            }),
          },
          case: {
            update: jest.fn().mockResolvedValue(existingCase),
          },
        };
        return callback(mockTx);
      });

      await service.assignTaskToInvestigator(1, 'user1', 'supervisor1', 'tenant1', 'Assignment note');

      expect(mockCommentRepository.createComment).toHaveBeenCalled();
    });

    it('should handle task assignment with parent case update', async () => {
      const caseWithParent = { ...existingCase, parent_id: 10 };

      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.case.findUnique.mockResolvedValue(caseWithParent);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: jest.fn().mockResolvedValue({
              ...existingTask,
              assigned_user_id: 'user1',
              status: TaskStatus.STATUS_10_ASSIGNED,
            }),
          },
          case: {
            update: jest.fn().mockResolvedValue({
              ...caseWithParent,
              status: CaseStatus.STATUS_10_ASSIGNED,
            }),
            findFirst: jest.fn().mockResolvedValue({
              case_id: 11,
              status: CaseStatus.STATUS_10_ASSIGNED,
            }),
          },
        };
        return callback(mockTx);
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
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.case.findUnique.mockResolvedValue(existingCase);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: jest.fn().mockResolvedValue({
              ...existingTask,
              assigned_user_id: 'user2',
            }),
          },
          case: {
            update: jest.fn().mockResolvedValue({
              ...existingCase,
              status: CaseStatus.STATUS_10_ASSIGNED,
              case_owner_user_id: 'user2',
            }),
          },
        };
        return callback(mockTx);
      });

      const result = await service.reassignTask(1, 'supervisor1', 'tenant1', 'user2', 'Reassign note');

      expect(result.assigned_user_id).toBe('user2');
      expect(mockCommentRepository.createComment).toHaveBeenCalled();
      expect(mockLoggingService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(
        service.reassignTask(999, 'supervisor1', 'tenant1', 'user2', 'note'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should handle parent case update during reassignment', async () => {
      const caseWithParent = { ...existingCase, parent_id: 10 };

      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.case.findUnique.mockResolvedValue(caseWithParent);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: jest.fn().mockResolvedValue({
              ...existingTask,
              assigned_user_id: 'user2',
            }),
          },
          case: {
            update: jest.fn().mockResolvedValue({
              ...caseWithParent,
              status: CaseStatus.STATUS_10_ASSIGNED,
            }),
            findFirst: jest.fn().mockResolvedValue({
              case_id: 11,
              status: CaseStatus.STATUS_10_ASSIGNED,
            }),
          },
        };
        return callback(mockTx);
      });

      await service.reassignTask(1, 'supervisor1', 'tenant1', 'user2', 'Reassign note');

      expect(mockFlowableService.handleCaseStatusChanged).toHaveBeenCalled();
    });
  });

  describe('selfAssignTask', () => {
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

    it('should self-assign task successfully', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.case.findUnique.mockResolvedValue(existingCase);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: jest.fn().mockResolvedValue({
              ...existingTask,
              assigned_user_id: 'user1',
              status: TaskStatus.STATUS_10_ASSIGNED,
            }),
          },
          case: {
            update: jest.fn().mockResolvedValue({
              ...existingCase,
              status: CaseStatus.STATUS_10_ASSIGNED,
              case_owner_user_id: 'user1',
            }),
          },
        };
        return callback(mockTx);
      });

      const result = await service.selfAssignTask(1, 'user1', 'tenant1');

      expect(result.assigned_user_id).toBe('user1');
      expect(mockFlowableService.handleTaskAssigned).toHaveBeenCalled();
      expect(mockLoggingService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should throw BadRequestException if task already assigned', async () => {
      const assignedTask = { ...existingTask, assigned_user_id: 'user2' };
      mockPrisma.task.findUnique.mockResolvedValue(assignedTask);

      await expect(service.selfAssignTask(1, 'user1', 'tenant1')).rejects.toThrow(
        new BadRequestException('Task 1 is already assigned.'),
      );
    });

    it('should throw BadRequestException if task status is not unassigned', async () => {
      const incompletedTask = { ...existingTask, status: TaskStatus.STATUS_10_ASSIGNED };
      mockPrisma.task.findUnique.mockResolvedValue(incompletedTask);

      await expect(service.selfAssignTask(1, 'user1', 'tenant1')).rejects.toThrow(
        new BadRequestException('Task 1 must be unassigned to self-assign.'),
      );
    });

    it('should throw NotFoundException if task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(service.selfAssignTask(999, 'user1', 'tenant1')).rejects.toThrow(NotFoundException);
    });

    it('should handle self-assign with parent case', async () => {
      const caseWithParent = { ...existingCase, parent_id: 10 };

      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.case.findUnique.mockResolvedValue(caseWithParent);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: jest.fn().mockResolvedValue({
              ...existingTask,
              assigned_user_id: 'user1',
              status: TaskStatus.STATUS_10_ASSIGNED,
            }),
          },
          case: {
            update: jest.fn().mockResolvedValue({
              ...caseWithParent,
              status: CaseStatus.STATUS_10_ASSIGNED,
            }),
            findFirst: jest.fn().mockResolvedValue({
              case_id: 11,
              status: CaseStatus.STATUS_10_ASSIGNED,
            }),
          },
        };
        return callback(mockTx);
      });

      await service.selfAssignTask(1, 'user1', 'tenant1');

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
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.case.findUnique.mockResolvedValue(existingCase);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: jest.fn().mockResolvedValue({
              ...existingTask,
              assigned_user_id: null,
              status: TaskStatus.STATUS_01_UNASSIGNED,
            }),
          },
          case: {
            update: jest.fn().mockResolvedValue({
              ...existingCase,
              status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
              case_owner_user_id: null,
            }),
          },
        };
        return callback(mockTx);
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
      mockPrisma.task.findUnique.mockResolvedValue(completedTask);

      await expect(service.unassignTask(1, 'supervisor1', 'tenant1', 'reason')).rejects.toThrow(
        new BadRequestException('Cannot unassign a completed task (1)'),
      );
    });

    it('should throw BadRequestException if task already unassigned', async () => {
      const unassignedTask = { ...existingTask, assigned_user_id: null };
      mockPrisma.task.findUnique.mockResolvedValue(unassignedTask);

      await expect(service.unassignTask(1, 'supervisor1', 'tenant1', 'reason')).rejects.toThrow(
        new BadRequestException('Task 1 is already unassigned'),
      );
    });

    it('should throw NotFoundException if task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(service.unassignTask(999, 'supervisor1', 'tenant1', 'reason')).rejects.toThrow(NotFoundException);
    });

    it('should handle SAR/STR Filing task without updating case status', async () => {
      const sarTask = { ...existingTask, name: 'SAR/STR Filing' };
      mockPrisma.task.findUnique.mockResolvedValue(sarTask);
      mockPrisma.case.findUnique.mockResolvedValue(existingCase);

      let taskUpdateCalled = false;
      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: jest.fn().mockImplementation(() => {
              taskUpdateCalled = true;
              return {
                ...sarTask,
                assigned_user_id: null,
              };
            }),
          },
          case: {
            update: jest.fn(),
          },
        };
        return callback(mockTx);
      });

      await service.unassignTask(1, 'supervisor1', 'tenant1', 'reason');

      expect(taskUpdateCalled).toBe(true);
    });

    it('should handle notification errors gracefully', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.case.findUnique.mockResolvedValue(existingCase);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: jest.fn().mockResolvedValue({
              ...existingTask,
              assigned_user_id: null,
            }),
          },
          case: {
            update: jest.fn().mockResolvedValue(existingCase),
          },
        };
        return callback(mockTx);
      });

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

      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.case.findUnique.mockResolvedValue(caseWithParent);

      mockPrisma.$transaction.mockImplementation(async (callback) => {
        const mockTx = {
          task: {
            update: jest.fn().mockResolvedValue({
              ...existingTask,
              assigned_user_id: null,
            }),
          },
          case: {
            update: jest.fn().mockResolvedValue({
              ...caseWithParent,
              status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
            }),
            findFirst: jest.fn().mockResolvedValue({
              case_id: 11,
              status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
            }),
          },
        };
        return callback(mockTx);
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
      mockPrisma.task.findUnique.mockResolvedValue(existingTask);
      mockPrisma.task.update.mockResolvedValue({
        ...existingTask,
        status: TaskStatus.STATUS_30_COMPLETED,
        case: {
          case_id: 1,
          status: CaseStatus.STATUS_20_IN_PROGRESS,
        },
      });

      const result = await service.completeTask(1, 'user1', 'tenant1');

      expect(result.status).toBe(TaskStatus.STATUS_30_COMPLETED);
      expect(mockPrisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { task_id: 1 },
          data: { status: TaskStatus.STATUS_30_COMPLETED },
        }),
      );
      expect(mockLoggingService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect(service.completeTask(999, 'user1', 'tenant1')).rejects.toThrow(NotFoundException);
    });
  });

  describe('emitAssignment', () => {
    it('should emit task.assigned event', () => {
      (service as any).emitAssignment(1, 1, 'user1', 'user2');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('task.assigned', expect.anything());
    });

    it('should emit task.assigned event without previous user', () => {
      (service as any).emitAssignment(1, 1, 'user1');

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('task.assigned', expect.anything());
    });
  });

  describe('emitCaseStatusChange', () => {
    it('should emit case.status.changed event', () => {
      (service as any).emitCaseStatusChange(
        1,
        CaseStatus.STATUS_10_ASSIGNED,
        CaseStatus.STATUS_20_IN_PROGRESS,
        'Task started',
      );

      expect(mockEventEmitter.emit).toHaveBeenCalledWith('case.status.changed', expect.anything());
    });
  });

  describe('getTaskOrThrow', () => {
    it('should return task if found', async () => {
      const task = { task_id: 1, tenant_id: 'tenant1' };
      mockPrisma.task.findUnique.mockResolvedValue(task);

      const result = await (service as any).getTaskOrThrow(1, 'tenant1');

      expect(result).toEqual(task);
    });

    it('should throw NotFoundException if task not found', async () => {
      mockPrisma.task.findUnique.mockResolvedValue(null);

      await expect((service as any).getTaskOrThrow(999, 'tenant1')).rejects.toThrow(
        new NotFoundException('Task 999 not found'),
      );
    });
  });

  describe('getCaseOrThrow', () => {
    it('should return case if found', async () => {
      const caseData = { case_id: 1, tenant_id: 'tenant1' };
      mockPrisma.case.findUnique.mockResolvedValue(caseData);

      const result = await (service as any).getCaseOrThrow(1, 'tenant1');

      expect(result).toEqual(caseData);
    });

    it('should throw NotFoundException if case not found', async () => {
      mockPrisma.case.findUnique.mockResolvedValue(null);

      await expect((service as any).getCaseOrThrow(999, 'tenant1')).rejects.toThrow(
        new NotFoundException('Case 999 not found'),
      );
    });
  });
});
