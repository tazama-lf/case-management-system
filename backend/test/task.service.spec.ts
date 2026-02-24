import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from '../src/modules/task/task.service';
import { TaskRepository } from '../src/modules/repository/task.repository';
import { TaskLifecycleService } from '../src/modules/task/services/task-lifecycle.service';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TaskStatus, CaseStatus } from '@prisma/client-cms';

describe('TaskService', () => {
  let service: TaskService;
  let taskRepository: TaskRepository;
  let lifecycle: TaskLifecycleService;
  let flowableService: FlowableService;
  let loggingService: LoggingOrchestrationService;
  let loggerService: LoggerService;
  let eventEmitter: EventEmitter2;

  const mockTaskRepository = {
    findCaseBasic: jest.fn(),
    createTask: jest.fn(),
    findTaskWithCase: jest.fn(),
    findTaskById: jest.fn(),
    updateTask: jest.fn(),
    findTasks: jest.fn(),
    countTasks: jest.fn(),
    findCaseStatus: jest.fn(),
    updateCase: jest.fn(),
    transaction: jest.fn(),
  };

  const mockLifecycleService = {};

  const mockFlowableService = {
    handleTaskAssigned: jest.fn(),
    handleCaseStatusChanged: jest.fn(),
  };

  const mockLoggingService = {
    logActions: jest.fn().mockResolvedValue(undefined),
    logActionsWithHistory: jest.fn().mockResolvedValue(undefined),
  };

  const mockLoggerService = {
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };

  const mockEventEmitter = {
    emit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: TaskRepository,
          useValue: mockTaskRepository,
        },
        {
          provide: TaskLifecycleService,
          useValue: mockLifecycleService,
        },
        {
          provide: FlowableService,
          useValue: mockFlowableService,
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

    service = module.get<TaskService>(TaskService);
    taskRepository = module.get(TaskRepository);
    lifecycle = module.get(TaskLifecycleService);
    flowableService = module.get(FlowableService);
    loggingService = module.get(LoggingOrchestrationService);
    loggerService = module.get(LoggerService);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('createTask', () => {
    const taskDTO = {
      caseId: 1,
      name: 'Test Task',
      description: 'Test Description',
      candidateGroup: 'Investigators',
      status: TaskStatus.STATUS_01_UNASSIGNED,
      assignedUserId: 'user1',
      investigationNotes: 'Test notes',
    };

    it('should create task successfully', async () => {
      const caseRecord = { case_id: 1, tenant_id: 'tenant1' };
      const createdTask = {
        task_id: 1,
        case_id: 1,
        name: 'Test Task',
        tenant_id: 'tenant1',
        candidateGroup: 'Investigators',
      };

      mockTaskRepository.findCaseBasic.mockResolvedValue(caseRecord);
      mockTaskRepository.createTask.mockResolvedValue(createdTask);

      const result = await service.createTask(taskDTO, 'user1', 'tenant1');

      expect(mockTaskRepository.findCaseBasic).toHaveBeenCalledWith(1, 'tenant1');
      expect(mockTaskRepository.createTask).toHaveBeenCalled();
      expect(mockLoggingService.logActionsWithHistory).toHaveBeenCalled();
      expect(result).toMatchObject(createdTask);
      expect(result.candidateGroup).toBe('Investigators');
    });

    it('should throw NotFoundException if case not found', async () => {
      mockTaskRepository.findCaseBasic.mockResolvedValue(null);

      await expect(service.createTask(taskDTO, 'user1', 'tenant1')).rejects.toThrow(
        new NotFoundException('Case 1 not found'),
      );
    });

    it('should log failure on error', async () => {
      mockTaskRepository.findCaseBasic.mockRejectedValue(new Error('DB error'));

      await expect(service.createTask(taskDTO, 'user1', 'tenant1')).rejects.toThrow();

      expect(mockLoggingService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
        }),
      );
    });
  });

  describe('updateTask', () => {
    const existingTask = {
      task_id: 1,
      case_id: 1,
      name: 'Investigate Case',
      status: TaskStatus.STATUS_01_UNASSIGNED,
      assigned_user_id: null,
      tenant_id: 'tenant1',
      case: {
        case_id: 1,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
      },
    };

    it('should update task without status change', async () => {
      const updateData = { investigationNotes: 'Updated notes' };

      mockTaskRepository.transaction.mockImplementation(async (callback) => {
        mockTaskRepository.findTaskWithCase.mockResolvedValue(existingTask);
        mockTaskRepository.updateTask.mockResolvedValue({ ...existingTask, investigationNotes: 'Updated notes' });
        return callback(mockTaskRepository);
      });

      const result = await service.updateTask(1, updateData, 'user1', 'tenant1');

      expect(result).toBeDefined();
      expect(mockLoggingService.logActions).toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskRepository.transaction.mockImplementation(async (callback) => {
        mockTaskRepository.findTaskWithCase.mockResolvedValue(null);
        return callback(mockTaskRepository);
      });

      await expect(service.updateTask(999, {}, 'user1', 'tenant1')).rejects.toThrow(
        new NotFoundException('Task 999 not found'),
      );
    });

    it('should promote case to in-progress when task status changes', async () => {
      const updateData = { status: TaskStatus.STATUS_20_IN_PROGRESS };
      const updatedTask = { ...existingTask, status: TaskStatus.STATUS_20_IN_PROGRESS };

      mockTaskRepository.transaction.mockImplementation(async (callback) => {
        mockTaskRepository.findTaskWithCase.mockResolvedValue(existingTask);
        mockTaskRepository.updateTask.mockResolvedValue(updatedTask);
        mockTaskRepository.findCaseStatus.mockResolvedValue(existingTask.case);
        mockTaskRepository.updateCase.mockResolvedValue({
          ...existingTask.case,
          status: CaseStatus.STATUS_20_IN_PROGRESS,
        });
        return callback(mockTaskRepository);
      });

      const result = await service.updateTask(1, updateData, 'user1', 'tenant1');

      expect(result).toMatchObject(updatedTask);
      expect(mockFlowableService.handleTaskAssigned).toHaveBeenCalled();
      expect(mockLoggingService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should handle task assignment status change', async () => {
      const updateData = {
        status: TaskStatus.STATUS_10_ASSIGNED,
        assignedUserId: 'user2',
      };

      mockTaskRepository.transaction.mockImplementation(async (callback) => {
        mockTaskRepository.findTaskWithCase.mockResolvedValue(existingTask);
        mockTaskRepository.updateTask.mockResolvedValue({ ...existingTask, ...updateData });
        return callback(mockTaskRepository);
      });

      const result = await service.updateTask(1, updateData, 'user1', 'tenant1');

      expect(result).toBeDefined();
    });

    it('should log error on update failure', async () => {
      mockTaskRepository.transaction.mockImplementation(async (callback) => {
        mockTaskRepository.findTaskWithCase.mockRejectedValue(new Error('Update failed'));
        return callback(mockTaskRepository);
      });

      await expect(service.updateTask(1, {}, 'user1', 'tenant1')).rejects.toThrow();

      expect(mockLoggingService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
        }),
      );
    });

    it('should handle case with parent when promoting to in-progress', async () => {
      const updateData = { status: TaskStatus.STATUS_20_IN_PROGRESS };
      const caseWithParent = {
        case_id: 1,
        status: CaseStatus.STATUS_20_IN_PROGRESS,
        parent_id: 10,
      };

      mockTaskRepository.transaction.mockImplementation(async (callback) => {
        const tx: any = {
          ...mockTaskRepository,
          case: {
            findFirst: jest.fn().mockResolvedValue({
              case_id: 2,
              status: CaseStatus.STATUS_20_IN_PROGRESS,
            }),
            update: jest.fn(),
          },
        };

        tx.findTaskWithCase.mockResolvedValue(existingTask);
        tx.updateTask.mockResolvedValue({ ...existingTask, status: TaskStatus.STATUS_20_IN_PROGRESS });
        tx.findCaseStatus.mockResolvedValue({ ...existingTask.case, parent_id: 10 });
        tx.updateCase.mockResolvedValue(caseWithParent);

        return callback(tx);
      });

      const result = await service.updateTask(1, updateData, 'user1', 'tenant1');

      expect(result).toBeDefined();
    });
  });



  describe('getTasksByCaseId', () => {
    it('should return enriched tasks with assigned user as string', async () => {
      const tasks = [
        { task_id: 1, case_id: 1, assigned_user_id: 'user1' },
        { task_id: 2, case_id: 1, assigned_user_id: null },
      ];

      mockTaskRepository.findTasks.mockResolvedValue(tasks);

      const result = await service.getTasksByCaseId(1, 'tenant1', 'user1');

      expect(result).toHaveLength(2);
      expect((result[0] as any).assignedUser).toBe('user1');
      expect((result[1] as any).assignedUser).toBeNull();
      expect(mockLoggingService.logActions).toHaveBeenCalled();
    });

    it('should work without userId', async () => {
      mockTaskRepository.findTasks.mockResolvedValue([]);

      const result = await service.getTasksByCaseId(1, 'tenant1');

      expect(result).toEqual([]);
      expect(mockLoggingService.logActions).not.toHaveBeenCalled();
    });

    it('should log failure on error', async () => {
      mockTaskRepository.findTasks.mockRejectedValue(new Error('DB error'));

      await expect(service.getTasksByCaseId(1, 'tenant1', 'user1')).rejects.toThrow();

      expect(mockLoggingService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
        }),
      );
    });
  });



  describe('getTasks', () => {
    it('should return tasks filtered by status', async () => {
      const tasks = [{ task_id: 1, status: TaskStatus.STATUS_10_ASSIGNED }];
      mockTaskRepository.findTasks.mockResolvedValue(tasks);

      const result = await service.getTasks('tenant1', TaskStatus.STATUS_10_ASSIGNED);

      expect(result).toEqual(tasks);
      expect(mockTaskRepository.findTasks).toHaveBeenCalledWith(
        { status: TaskStatus.STATUS_10_ASSIGNED },
        'tenant1',
        true,
      );
    });

    it('should return all tasks without status filter', async () => {
      const tasks = [
        { task_id: 1, status: TaskStatus.STATUS_10_ASSIGNED },
        { task_id: 2, status: TaskStatus.STATUS_01_UNASSIGNED },
      ];
      mockTaskRepository.findTasks.mockResolvedValue(tasks);

      const result = await service.getTasks('tenant1');

      expect(result).toEqual(tasks);
      expect(mockTaskRepository.findTasks).toHaveBeenCalledWith({}, 'tenant1', true);
    });

    it('should handle errors', async () => {
      mockTaskRepository.findTasks.mockRejectedValue(new Error('DB error'));

      await expect(service.getTasks('tenant1')).rejects.toThrow();
    });
  });

  describe('getTaskById', () => {
    it('should return task by id', async () => {
      const task = { task_id: 1, name: 'Task 1' };
      mockTaskRepository.findTaskWithCase.mockResolvedValue(task);

      const result = await service.getTaskById(1, 'tenant1');

      expect(result).toEqual(task);
    });

    it('should handle errors', async () => {
      mockTaskRepository.findTaskWithCase.mockRejectedValue(new Error('Not found'));

      await expect(service.getTaskById(1, 'tenant1')).rejects.toThrow();
    });
  });



  describe('claimTask', () => {
    it('should claim task and emit event', async () => {
      const existingTask = {
        task_id: 1,
        case_id: 1,
        assigned_user_id: null,
        tenant_id: 'tenant1',
      };
      const updatedTask = {
        ...existingTask,
        assigned_user_id: 'user1',
        status: TaskStatus.STATUS_10_ASSIGNED,
      };

      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockTaskRepository.updateTask.mockResolvedValue(updatedTask);

      const result = await service.claimTask(1, 'user1', 'tenant1');

      expect(result).toEqual(updatedTask);
      expect(mockEventEmitter.emit).toHaveBeenCalledWith(
        'task.assigned',
        expect.anything(),
      );
      expect(mockLoggingService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      mockTaskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.claimTask(999, 'user1', 'tenant1')).rejects.toThrow(
        new NotFoundException('Task 999 not found'),
      );
    });

    it('should handle previously assigned task', async () => {
      const existingTask = {
        task_id: 1,
        case_id: 1,
        assigned_user_id: 'user2',
        tenant_id: 'tenant1',
      };
      const updatedTask = { ...existingTask, assigned_user_id: 'user1' };

      mockTaskRepository.findTaskById.mockResolvedValue(existingTask);
      mockTaskRepository.updateTask.mockResolvedValue(updatedTask);

      const result = await service.claimTask(1, 'user1', 'tenant1');

      expect(result.assigned_user_id).toBe('user1');
    });

    it('should handle errors', async () => {
      mockTaskRepository.findTaskById.mockRejectedValue(new Error('DB error'));

      await expect(service.claimTask(1, 'user1', 'tenant1')).rejects.toThrow();
    });
  });



  describe('getUserTasks', () => {
    it('should return user tasks excluding completed', async () => {
      const tasks = [
        { task_id: 1, status: TaskStatus.STATUS_10_ASSIGNED },
        { task_id: 2, status: TaskStatus.STATUS_20_IN_PROGRESS },
      ];

      mockTaskRepository.findTasks.mockResolvedValue(tasks);

      const result = await service.getUserTasks('user1', 'tenant1', false);

      expect(result).toEqual(tasks);
      expect(mockTaskRepository.findTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          assigned_user_id: 'user1',
          status: { not: TaskStatus.STATUS_30_COMPLETED },
        }),
        'tenant1',
        true,
      );
    });

    it('should include completed tasks when requested', async () => {
      const tasks = [
        { task_id: 1, status: TaskStatus.STATUS_10_ASSIGNED },
        { task_id: 2, status: TaskStatus.STATUS_30_COMPLETED },
      ];

      mockTaskRepository.findTasks.mockResolvedValue(tasks);

      const result = await service.getUserTasks('user1', 'tenant1', true);

      expect(result).toEqual(tasks);
      expect(mockTaskRepository.findTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          assigned_user_id: 'user1',
        }),
        'tenant1',
        true,
      );
    });

    it('should handle errors', async () => {
      mockTaskRepository.findTasks.mockRejectedValue(new Error('DB error'));

      await expect(service.getUserTasks('user1', 'tenant1')).rejects.toThrow();
    });
  });

});
