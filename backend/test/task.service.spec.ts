import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from '../src/modules/task/task.service';
import { TaskRepository } from '../src/modules/repository/task.repository';
import { TaskLifecycleService } from '../src/modules/task/services/task-lifecycle.service';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { TaskStatus, CaseStatus, Priority } from '@prisma/client-cms';
import * as timersPromises from 'node:timers/promises';

describe('TaskService', () => {
  let service: TaskService;
  let taskRepository: jest.Mocked<TaskRepository>;
  let flowableService: jest.Mocked<FlowableService>;
  let loggingService: jest.Mocked<LoggingOrchestrationService>;
  let loggerService: jest.Mocked<LoggerService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;

  // Shared test fixtures
  const mockCaseRecord = {
    case_id: 1,
    tenant_id: 'tenant1',
    priority: 'URGENT' as Priority,
    status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
  };

  const createTaskDTO = {
    caseId: 1,
    name: 'Test Task',
    description: 'Test Description',
    candidateGroup: 'Investigators',
    status: TaskStatus.STATUS_01_UNASSIGNED,
    assignedUserId: 'user1',
    investigationNotes: 'Test notes',
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: TaskRepository,
          useValue: {
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
          },
        },
        {
          provide: TaskLifecycleService,
          useValue: {},
        },
        {
          provide: FlowableService,
          useValue: {
            handleTaskAssigned: jest.fn(),
            handleCaseStatusChanged: jest.fn(),
          },
        },
        {
          provide: LoggingOrchestrationService,
          useValue: {
            logActions: jest.fn().mockResolvedValue(undefined),
            logActionsWithHistory: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
          },
        },
        {
          provide: EventEmitter2,
          useValue: {
            emit: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);
    taskRepository = module.get(TaskRepository);
    flowableService = module.get(FlowableService);
    loggingService = module.get(LoggingOrchestrationService);
    loggerService = module.get(LoggerService);
    eventEmitter = module.get(EventEmitter2);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create task successfully', async () => {
      const createdTask = {
        task_id: 1,
        case_id: 1,
        name: 'Test Task',
        tenant_id: 'tenant1',
        candidateGroup: 'Investigators',
        description: 'Test Description',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        assigned_user_id: null,
        investigationNotes: null,
        task_type: 'INVESTIGATION',
        created_at: new Date(),
        updated_at: new Date(),
      };

      taskRepository.findCaseBasic.mockResolvedValue(mockCaseRecord as any);
      taskRepository.createTask.mockResolvedValue(createdTask as any);

      const result = await service.createTask(createTaskDTO, 'user1', 'tenant1');

      expect(taskRepository.findCaseBasic).toHaveBeenCalledWith(1, 'tenant1');
      expect(taskRepository.createTask).toHaveBeenCalled();
      expect(loggingService.logActionsWithHistory).toHaveBeenCalled();
      expect(result).toMatchObject(createdTask);
      expect(result.candidateGroup).toBe('Investigators');
    });

    it('should throw NotFoundException if case not found', async () => {
      taskRepository.findCaseBasic.mockResolvedValue(null);

      await expect(service.createTask(createTaskDTO, 'user1', 'tenant1')).rejects.toThrow(new NotFoundException('Case 1 not found'));
    });

    it('should log failure on error', async () => {
      taskRepository.findCaseBasic.mockRejectedValue(new Error('DB error'));

      await expect(service.createTask(createTaskDTO, 'user1', 'tenant1')).rejects.toThrow();

      expect(loggingService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
        }),
      );
    });

    it('should throw error when task creation fails', async () => {
      taskRepository.findCaseBasic.mockResolvedValue(mockCaseRecord as any);
      taskRepository.createTask.mockResolvedValue(null);

      await expect(service.createTask(createTaskDTO, 'user1', 'tenant1')).rejects.toThrow('Failed to create task');
    });
  });

  describe('updateTask', () => {
    const existingTask = {
      task_id: 1,
      case_id: 1,
      name: 'Investigate Case',
      description: 'Investigation task',
      status: TaskStatus.STATUS_01_UNASSIGNED,
      assigned_user_id: null,
      tenant_id: 'tenant1',
      task_type: 'INVESTIGATION',
      candidateGroup: 'Investigators',
      investigationNotes: null,
      created_at: new Date(),
      updated_at: new Date(),
      case: {
        case_id: 1,
        status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
        tenant_id: 'tenant1',
        case_owner_user_id: null,
        parent_id: null,
      },
    } as any;

    it('should update task without status change', async () => {
      const updateData = { investigationNotes: 'Updated notes' };

      taskRepository.transaction.mockImplementation(async (callback) => {
        taskRepository.findTaskWithCase.mockResolvedValue(existingTask);
        taskRepository.updateTask.mockResolvedValue({ ...existingTask, investigationNotes: 'Updated notes' } as any);
        return callback(taskRepository as any);
      });

      const result = await service.updateTask(1, updateData, 'user1', 'tenant1');

      expect(result).toBeDefined();
      expect(loggingService.logActions).toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      taskRepository.transaction.mockImplementation(async (callback) => {
        taskRepository.findTaskWithCase.mockResolvedValue(null);
        return callback(taskRepository as any);
      });

      await expect(service.updateTask(999, {}, 'user1', 'tenant1')).rejects.toThrow(new NotFoundException('Task 999 not found'));
    });

    it('should promote case to in-progress when investigate task status changes', async () => {
      const updateData = { status: TaskStatus.STATUS_20_IN_PROGRESS };
      const updatedTask = { ...existingTask, status: TaskStatus.STATUS_20_IN_PROGRESS } as any;

      taskRepository.transaction.mockImplementation(async (callback) => {
        taskRepository.findTaskWithCase.mockResolvedValue(existingTask);
        taskRepository.updateTask.mockResolvedValue(updatedTask);
        taskRepository.findCaseStatus.mockResolvedValue(existingTask.case);
        taskRepository.updateCase.mockResolvedValue({
          ...existingTask.case,
          status: CaseStatus.STATUS_20_IN_PROGRESS,
        } as any);
        return callback(taskRepository as any);
      });

      flowableService.handleTaskAssigned.mockResolvedValue();

      const result = await service.updateTask(1, updateData, 'user1', 'tenant1');

      expect(result).toMatchObject(updatedTask);
      expect(flowableService.handleTaskAssigned).toHaveBeenCalled();
      expect(loggingService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should handle task assignment status change', async () => {
      const updateData = {
        status: TaskStatus.STATUS_10_ASSIGNED,
        assignedUserId: 'user2',
      };

      taskRepository.transaction.mockImplementation(async (callback) => {
        taskRepository.findTaskWithCase.mockResolvedValue(existingTask);
        taskRepository.updateTask.mockResolvedValue({ ...existingTask, ...updateData } as any);
        return callback(taskRepository as any);
      });

      flowableService.handleTaskAssigned.mockResolvedValue();

      const result = await service.updateTask(1, updateData, 'user1', 'tenant1');

      expect(result).toBeDefined();
    });

    it('should log error on update failure', async () => {
      taskRepository.transaction.mockImplementation(async (callback) => {
        taskRepository.findTaskWithCase.mockRejectedValue(new Error('Update failed'));
        return callback(taskRepository as any);
      });

      await expect(service.updateTask(1, {}, 'user1', 'tenant1')).rejects.toThrow();

      expect(loggingService.logActions).toHaveBeenCalledWith(
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

      taskRepository.transaction.mockImplementation(async (callback) => {
        const tx: any = {
          ...taskRepository,
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

      flowableService.handleTaskAssigned.mockResolvedValue();

      const result = await service.updateTask(1, updateData, 'user1', 'tenant1');

      expect(result).toBeDefined();
    });

    it(
      'should handle flowable operation retry failure',
      async () => {
        const setTimeoutSpy = jest.spyOn(timersPromises, 'setTimeout').mockResolvedValue(undefined as any);
        const updateData = { status: TaskStatus.STATUS_10_ASSIGNED };

        taskRepository.transaction.mockImplementation(async (callback) => {
          taskRepository.findTaskWithCase.mockResolvedValue(existingTask);
          taskRepository.updateTask.mockResolvedValue({ ...existingTask, ...updateData } as any);
          return callback(taskRepository as any);
        });

        flowableService.handleTaskAssigned
          .mockRejectedValueOnce(new Error('Flowable error 1'))
          .mockRejectedValueOnce(new Error('Flowable error 2'))
          .mockRejectedValueOnce(new Error('Flowable error 3'))
          .mockRejectedValueOnce(new Error('Flowable error 4'))
          .mockRejectedValueOnce(new Error('Flowable error 5'));

        await expect(service.updateTask(1, updateData, 'user1', 'tenant1')).rejects.toThrow('Flowable error 5');
        expect(setTimeoutSpy).toHaveBeenCalledTimes(4);
        setTimeoutSpy.mockRestore();
      },
      5000,
    );

    it('should handle parent case promotion error', async () => {
      const updateData = { status: TaskStatus.STATUS_20_IN_PROGRESS };

      taskRepository.transaction.mockImplementation(async (callback) => {
        const tx: any = {
          ...taskRepository,
          case: {
            findFirst: jest.fn().mockRejectedValue(new Error('Parent case lookup failed')),
            update: jest.fn(),
          },
        };

        tx.findTaskWithCase.mockResolvedValue(existingTask);
        tx.updateTask.mockResolvedValue({ ...existingTask, status: TaskStatus.STATUS_20_IN_PROGRESS });
        tx.findCaseStatus.mockResolvedValue({ ...existingTask.case, parent_id: 10 });
        tx.updateCase.mockResolvedValue({ ...existingTask.case, parent_id: 10, status: CaseStatus.STATUS_20_IN_PROGRESS });

        return callback(tx);
      });

      await expect(service.updateTask(1, updateData, 'user1', 'tenant1')).rejects.toThrow();
    });
  });

  describe('getTasksByCaseId', () => {
    it('should return enriched tasks with assigned user as string', async () => {
      const tasks = [
        {
          task_id: 1,
          case_id: 1,
          name: 'Task 1',
          description: 'Description 1',
          assigned_user_id: 'user1',
          status: TaskStatus.STATUS_10_ASSIGNED,
          tenant_id: 'tenant1',
          task_type: 'INVESTIGATION',
          candidateGroup: 'Investigators',
          investigationNotes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          task_id: 2,
          case_id: 1,
          name: 'Task 2',
          description: 'Description 2',
          assigned_user_id: null,
          status: TaskStatus.STATUS_01_UNASSIGNED,
          tenant_id: 'tenant1',
          task_type: 'INVESTIGATION',
          candidateGroup: 'Investigators',
          investigationNotes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ] as any;

      taskRepository.findTasks.mockResolvedValue(tasks);

      const result = await service.getTasksByCaseId(1, 'tenant1', 'user1');

      expect(result).toHaveLength(2);
      expect((result[0] as any).assignedUser).toBe('user1');
      expect((result[1] as any).assignedUser).toBeNull();
      expect(loggingService.logActions).toHaveBeenCalled();
    });

    it('should work without userId', async () => {
      taskRepository.findTasks.mockResolvedValue([]);

      const result = await service.getTasksByCaseId(1, 'tenant1');

      expect(result).toEqual([]);
      expect(loggingService.logActions).not.toHaveBeenCalled();
    });

    it('should log failure on error', async () => {
      taskRepository.findTasks.mockRejectedValue(new Error('DB error'));

      await expect(service.getTasksByCaseId(1, 'tenant1', 'user1')).rejects.toThrow();

      expect(loggingService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
        }),
      );
    });
  });

  describe('getTasks', () => {
    it('should return tasks filtered by status', async () => {
      const tasks = [
        {
          task_id: 1,
          case_id: 1,
          name: 'Task 1',
          description: 'Description 1',
          status: TaskStatus.STATUS_10_ASSIGNED,
          assigned_user_id: 'user1',
          tenant_id: 'tenant1',
          task_type: 'INVESTIGATION',
          candidateGroup: 'Investigators',
          investigationNotes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ] as any;
      taskRepository.findTasks.mockResolvedValue(tasks);

      const result = await service.getTasks('tenant1', TaskStatus.STATUS_10_ASSIGNED);

      expect(result).toEqual(tasks);
      expect(taskRepository.findTasks).toHaveBeenCalledWith({ status: TaskStatus.STATUS_10_ASSIGNED }, 'tenant1', true);
    });

    it('should return all tasks without status filter', async () => {
      const tasks = [
        {
          task_id: 1,
          case_id: 1,
          name: 'Task 1',
          description: 'Description 1',
          status: TaskStatus.STATUS_10_ASSIGNED,
          assigned_user_id: 'user1',
          tenant_id: 'tenant1',
          task_type: 'INVESTIGATION',
          candidateGroup: 'Investigators',
          investigationNotes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          task_id: 2,
          case_id: 1,
          name: 'Task 2',
          description: 'Description 2',
          status: TaskStatus.STATUS_01_UNASSIGNED,
          assigned_user_id: null,
          tenant_id: 'tenant1',
          task_type: 'INVESTIGATION',
          candidateGroup: 'Investigators',
          investigationNotes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ] as any;
      taskRepository.findTasks.mockResolvedValue(tasks);

      const result = await service.getTasks('tenant1');

      expect(result).toEqual(tasks);
      expect(taskRepository.findTasks).toHaveBeenCalledWith({}, 'tenant1', true);
    });

    it('should handle errors', async () => {
      taskRepository.findTasks.mockRejectedValue(new Error('DB error'));

      await expect(service.getTasks('tenant1')).rejects.toThrow();
    });
  });

  describe('getTaskById', () => {
    it('should return task by id', async () => {
      const task = {
        task_id: 1,
        name: 'Task 1',
        case_id: 1,
        description: 'Description 1',
        status: TaskStatus.STATUS_01_UNASSIGNED,
        assigned_user_id: null,
        tenant_id: 'tenant1',
        task_type: 'INVESTIGATION',
        candidateGroup: 'Investigators',
        investigationNotes: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as any;
      taskRepository.findTaskWithCase.mockResolvedValue(task);

      const result = await service.getTaskById(1, 'tenant1');

      expect(result).toEqual(task);
    });

    it('should handle errors', async () => {
      taskRepository.findTaskWithCase.mockRejectedValue(new Error('Not found'));

      await expect(service.getTaskById(1, 'tenant1')).rejects.toThrow();
    });
  });

  describe('claimTask', () => {
    it('should claim task and emit event', async () => {
      const existingTask = {
        task_id: 1,
        case_id: 1,
        name: 'Task 1',
        description: 'Description 1',
        assigned_user_id: null,
        status: TaskStatus.STATUS_01_UNASSIGNED,
        tenant_id: 'tenant1',
        task_type: 'INVESTIGATION',
        candidateGroup: 'Investigators',
        investigationNotes: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as any;

      const updatedTask = {
        ...existingTask,
        assigned_user_id: 'user1',
        status: TaskStatus.STATUS_10_ASSIGNED,
      } as any;

      taskRepository.findTaskById.mockResolvedValue(existingTask);
      taskRepository.updateTask.mockResolvedValue(updatedTask);

      const result = await service.claimTask(1, 'user1', 'tenant1');

      expect(result).toEqual(updatedTask);
      expect(eventEmitter.emit).toHaveBeenCalledWith('task.assigned', expect.anything());
      expect(loggingService.logActionsWithHistory).toHaveBeenCalled();
    });

    it('should throw NotFoundException if task not found', async () => {
      taskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.claimTask(999, 'user1', 'tenant1')).rejects.toThrow(new NotFoundException('Task 999 not found'));
    });

    it('should handle previously assigned task', async () => {
      const existingTask = {
        task_id: 1,
        case_id: 1,
        name: 'Task 1',
        description: 'Description 1',
        assigned_user_id: 'user2',
        status: TaskStatus.STATUS_10_ASSIGNED,
        tenant_id: 'tenant1',
        task_type: 'INVESTIGATION',
        candidateGroup: 'Investigators',
        investigationNotes: null,
        created_at: new Date(),
        updated_at: new Date(),
      } as any;

      const updatedTask = {
        ...existingTask,
        assigned_user_id: 'user1',
      } as any;

      taskRepository.findTaskById.mockResolvedValue(existingTask);
      taskRepository.updateTask.mockResolvedValue(updatedTask);

      const result = await service.claimTask(1, 'user1', 'tenant1');

      expect(result.assigned_user_id).toBe('user1');
    });

    it('should handle errors', async () => {
      taskRepository.findTaskById.mockRejectedValue(new Error('DB error'));

      await expect(service.claimTask(1, 'user1', 'tenant1')).rejects.toThrow();
    });
  });

  describe('getUserTasks', () => {
    it('should return user tasks excluding completed', async () => {
      const tasks = [
        {
          task_id: 1,
          case_id: 1,
          name: 'Task 1',
          description: 'Description 1',
          status: TaskStatus.STATUS_10_ASSIGNED,
          assigned_user_id: 'user1',
          tenant_id: 'tenant1',
          task_type: 'INVESTIGATION',
          candidateGroup: 'Investigators',
          investigationNotes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          task_id: 2,
          case_id: 1,
          name: 'Task 2',
          description: 'Description 2',
          status: TaskStatus.STATUS_20_IN_PROGRESS,
          assigned_user_id: 'user1',
          tenant_id: 'tenant1',
          task_type: 'INVESTIGATION',
          candidateGroup: 'Investigators',
          investigationNotes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ] as any;

      taskRepository.findTasks.mockResolvedValue(tasks);

      const result = await service.getUserTasks('user1', 'tenant1', false);

      expect(result).toEqual(tasks);
      expect(taskRepository.findTasks).toHaveBeenCalledWith(
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
        {
          task_id: 1,
          case_id: 1,
          name: 'Task 1',
          description: 'Description 1',
          status: TaskStatus.STATUS_10_ASSIGNED,
          assigned_user_id: 'user1',
          tenant_id: 'tenant1',
          task_type: 'INVESTIGATION',
          candidateGroup: 'Investigators',
          investigationNotes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
        {
          task_id: 2,
          case_id: 1,
          name: 'Task 2',
          description: 'Description 2',
          status: TaskStatus.STATUS_30_COMPLETED,
          assigned_user_id: 'user1',
          tenant_id: 'tenant1',
          task_type: 'INVESTIGATION',
          candidateGroup: 'Investigators',
          investigationNotes: null,
          created_at: new Date(),
          updated_at: new Date(),
        },
      ] as any;

      taskRepository.findTasks.mockResolvedValue(tasks);

      const result = await service.getUserTasks('user1', 'tenant1', true);

      expect(result).toEqual(tasks);
      expect(taskRepository.findTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          assigned_user_id: 'user1',
        }),
        'tenant1',
        true,
      );
    });

    it('should handle errors', async () => {
      taskRepository.findTasks.mockRejectedValue(new Error('DB error'));

      await expect(service.getUserTasks('user1', 'tenant1')).rejects.toThrow();
    });
  });
});
