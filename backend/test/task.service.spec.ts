import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from '../src/modules/task/task.service';
import { TaskRepository } from '../src/modules/repository/task.repository';
import { TaskLifecycleService } from '../src/modules/task/services/task-lifecycle.service';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { AuthService } from '../src/modules/auth/auth.service';
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
  let authService: AuthService;
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

  const mockLifecycleService = {
    reassignTask: jest.fn(),
    assignTaskToInvestigator: jest.fn(),
    selfAssignTask: jest.fn(),
    unassignTask: jest.fn(),
    completeTask: jest.fn(),
  };

  const mockFlowableService = {
    handleTaskAssigned: jest.fn(),
    handleCaseStatusChanged: jest.fn(),
  };

  const mockAuthService = {
    getUserDetailsFromAuthService: jest.fn(),
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
          provide: AuthService,
          useValue: mockAuthService,
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
    authService = module.get(AuthService);
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

  describe('getTasksByCandidateGroup', () => {
    it('should return tasks by candidate group', async () => {
      const tasks = [
        { task_id: 1, candidateGroup: 'Investigators', case: { case_id: 1 } },
        { task_id: 2, candidateGroup: 'Investigators', case: { case_id: 2 } },
      ];

      mockTaskRepository.findTasks.mockResolvedValue(tasks);

      const result = await service.getTasksByCandidateGroup('Investigators', 'user1', 'tenant1');

      expect(result).toEqual(tasks);
      expect(mockTaskRepository.findTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateGroup: 'Investigators',
        }),
        'tenant1',
        true,
      );
      expect(mockLoggingService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'SUCCESS',
        }),
      );
    });

    it('should log failure on error', async () => {
      mockTaskRepository.findTasks.mockRejectedValue(new Error('Query error'));

      await expect(service.getTasksByCandidateGroup('Investigators', 'user1', 'tenant1')).rejects.toThrow();

      expect(mockLoggingService.logActions).toHaveBeenCalledWith(
        expect.objectContaining({
          outcome: 'FAILURE',
        }),
      );
    });
  });

  describe('getInvestigationQueue', () => {
    it('should return investigation queue tasks', async () => {
      const tasks = [
        { task_id: 1, candidateGroup: 'investigations', case: { case_id: 1 } },
      ];

      mockTaskRepository.findTasks.mockResolvedValue(tasks);

      const result = await service.getInvestigationQueue('tenant1');

      expect(result).toEqual(tasks);
      expect(mockTaskRepository.findTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          candidateGroup: 'investigations',
        }),
        'tenant1',
        true,
      );
    });

    it('should handle errors', async () => {
      mockTaskRepository.findTasks.mockRejectedValue(new Error('DB error'));

      await expect(service.getInvestigationQueue('tenant1')).rejects.toThrow();
    });
  });

  describe('getTasksByCaseId', () => {
    it('should return enriched tasks with assigned user info', async () => {
      const tasks = [
        { task_id: 1, case_id: 1, assigned_user_id: 'user1' },
        { task_id: 2, case_id: 1, assigned_user_id: null },
      ];

      mockTaskRepository.findTasks.mockResolvedValue(tasks);
      mockAuthService.getUserDetailsFromAuthService.mockResolvedValue({
        user_id: 'user1',
        username: 'testuser',
        email: 'test@example.com',
        roles: ['INVESTIGATOR'],
      });

      const result = await service.getTasksByCaseId(1, 'tenant1', 'user1', ['CMS_INVESTIGATOR']);

      expect(result).toHaveLength(2);
      expect(result[0].assignedUser).toEqual({
        user_id: 'user1',
        username: 'testuser',
        role: 'INVESTIGATOR',
      });
      expect(result[1].assignedUser).toBeNull();
      expect(mockLoggingService.logActions).toHaveBeenCalled();
    });

    it('should handle auth service errors gracefully', async () => {
      const tasks = [{ task_id: 1, case_id: 1, assigned_user_id: 'user1' }];

      mockTaskRepository.findTasks.mockResolvedValue(tasks);
      mockAuthService.getUserDetailsFromAuthService.mockRejectedValue(new Error('Auth error'));

      const result = await service.getTasksByCaseId(1, 'tenant1', 'user1');

      expect(result).toHaveLength(1);
      expect(result[0].assignedUser?.user_id).toBe('user1');
      expect(result[0].assignedUser?.username).toContain('user1');
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

  describe('assignTaskToInvestigator', () => {
    it('should delegate to lifecycle service', async () => {
      const updatedTask = { task_id: 1, assigned_user_id: 'user2' };
      mockLifecycleService.assignTaskToInvestigator.mockResolvedValue(updatedTask);

      const result = await service.assignTaskToInvestigator(1, 'user2', 'supervisor1', 'tenant1', 'note');

      expect(result).toEqual(updatedTask);
      expect(mockLifecycleService.assignTaskToInvestigator).toHaveBeenCalledWith(
        1,
        'user2',
        'supervisor1',
        'tenant1',
        'note',
      );
    });
  });

  describe('selfAssignTask', () => {
    it('should delegate to lifecycle service', async () => {
      const updatedTask = { task_id: 1, assigned_user_id: 'user1' };
      mockLifecycleService.selfAssignTask.mockResolvedValue(updatedTask);

      const result = await service.selfAssignTask(1, 'user1', 'tenant1');

      expect(result).toEqual(updatedTask);
      expect(mockLifecycleService.selfAssignTask).toHaveBeenCalledWith(1, 'user1', 'tenant1');
    });
  });

  describe('reassignTask', () => {
    it('should delegate to lifecycle service', async () => {
      const updatedTask = { task_id: 1, assigned_user_id: 'user2' };
      mockLifecycleService.reassignTask.mockResolvedValue(updatedTask);

      const result = await service.reassignTask(1, 'user1', 'tenant1', 'user2', 'reassign note');

      expect(result).toEqual(updatedTask);
      expect(mockLifecycleService.reassignTask).toHaveBeenCalledWith(1, 'user1', 'tenant1', 'user2', 'reassign note');
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

  describe('getWorkQueue', () => {
    it('should return paginated work queue', async () => {
      const tasks = [
        {
          task_id: 1,
          name: 'Task 1',
          status: TaskStatus.STATUS_01_UNASSIGNED,
          case: { case_id: 1 },
        },
      ];

      mockTaskRepository.countTasks.mockResolvedValue(10);
      mockTaskRepository.findTasks.mockResolvedValue(tasks);

      const result = await service.getWorkQueue('tenant1', {
        candidateGroup: 'Investigators',
        page: 1,
        limit: 20,
      });

      expect(result.tasks).toHaveLength(1);
      expect(result.total).toBe(10);
      expect(result.page).toBe(1);
      expect(result.totalPages).toBe(1);
    });

    it('should filter by unassigned only', async () => {
      mockTaskRepository.countTasks.mockResolvedValue(5);
      mockTaskRepository.findTasks.mockResolvedValue([]);

      const result = await service.getWorkQueue('tenant1', { unassignedOnly: true });

      expect(mockTaskRepository.findTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          assigned_user_id: null,
        }),
        'tenant1',
        true,
        0,
        20,
      );
    });

    it('should filter by assigned to me', async () => {
      mockTaskRepository.countTasks.mockResolvedValue(3);
      mockTaskRepository.findTasks.mockResolvedValue([]);

      const result = await service.getWorkQueue('tenant1', { assignedToMe: 'user1' });

      expect(mockTaskRepository.findTasks).toHaveBeenCalledWith(
        expect.objectContaining({
          assigned_user_id: 'user1',
        }),
        'tenant1',
        true,
        0,
        20,
      );
    });

    it('should handle pagination correctly', async () => {
      mockTaskRepository.countTasks.mockResolvedValue(100);
      mockTaskRepository.findTasks.mockResolvedValue([]);

      const result = await service.getWorkQueue('tenant1', { page: 3, limit: 10 });

      expect(mockTaskRepository.findTasks).toHaveBeenCalledWith(
        expect.anything(),
        'tenant1',
        true,
        20,
        10,
      );
      expect(result.totalPages).toBe(10);
    });

    it('should handle errors', async () => {
      mockTaskRepository.countTasks.mockRejectedValue(new Error('DB error'));

      await expect(service.getWorkQueue('tenant1', {})).rejects.toThrow();
    });
  });

  describe('getWorkQueueStatistics', () => {
    it('should return statistics for all candidate groups', async () => {
      mockTaskRepository.findTasks
        .mockResolvedValueOnce([
          { task_id: 1, assigned_user_id: null },
          { task_id: 2, assigned_user_id: 'user1' },
        ])
        .mockResolvedValueOnce([{ task_id: 3, assigned_user_id: 'user2' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          { task_id: 4, status: TaskStatus.STATUS_10_ASSIGNED },
        ]);

      const result = await service.getWorkQueueStatistics('user1', 'tenant1');

      expect(result.queues.Supervisors.total).toBe(2);
      expect(result.queues.Supervisors.unassigned).toBe(1);
      expect(result.queues.Supervisors.assigned).toBe(1);
      expect(result.userStats.totalAssigned).toBe(1);
      expect(result.userStats.byStatus[TaskStatus.STATUS_10_ASSIGNED]).toBe(1);
    });

    it('should handle errors', async () => {
      mockTaskRepository.findTasks.mockRejectedValue(new Error('DB error'));

      await expect(service.getWorkQueueStatistics('user1', 'tenant1')).rejects.toThrow();
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

  describe('unassignTask', () => {
    it('should delegate to lifecycle service', async () => {
      const updatedTask = { task_id: 1, assigned_user_id: null };
      mockLifecycleService.unassignTask.mockResolvedValue(updatedTask);

      const result = await service.unassignTask(1, 'user1', 'tenant1', 'reason');

      expect(result).toEqual(updatedTask);
      expect(mockLifecycleService.unassignTask).toHaveBeenCalledWith(1, 'user1', 'tenant1', 'reason');
    });

    it('should use empty string if reason not provided', async () => {
      mockLifecycleService.unassignTask.mockResolvedValue({});

      await service.unassignTask(1, 'user1', 'tenant1');

      expect(mockLifecycleService.unassignTask).toHaveBeenCalledWith(1, 'user1', 'tenant1', '');
    });
  });

  describe('completeTask', () => {
    it('should delegate to lifecycle service', async () => {
      const completedTask = { task_id: 1, status: TaskStatus.STATUS_30_COMPLETED };
      mockLifecycleService.completeTask.mockResolvedValue(completedTask);

      const result = await service.completeTask(1, 'user1', 'tenant1');

      expect(result).toEqual(completedTask);
      expect(mockLifecycleService.completeTask).toHaveBeenCalledWith(1, 'user1', 'tenant1');
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

  describe('shouldPromoteCaseToInProgress', () => {
    it('should return true for investigation task changing to in-progress', () => {
      const task = {
        task_id: 1,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_10_ASSIGNED,
      } as any;

      const result = (service as any).shouldPromoteCaseToInProgress(task, {
        status: TaskStatus.STATUS_20_IN_PROGRESS,
      });

      expect(result).toBe(true);
    });

    it('should return false for non-investigation task', () => {
      const task = {
        task_id: 1,
        name: 'Review Document',
        status: TaskStatus.STATUS_10_ASSIGNED,
      } as any;

      const result = (service as any).shouldPromoteCaseToInProgress(task, {
        status: TaskStatus.STATUS_20_IN_PROGRESS,
      });

      expect(result).toBe(false);
    });

    it('should return false if task already in-progress', () => {
      const task = {
        task_id: 1,
        name: 'Investigate Case',
        status: TaskStatus.STATUS_20_IN_PROGRESS,
      } as any;

      const result = (service as any).shouldPromoteCaseToInProgress(task, {
        status: TaskStatus.STATUS_20_IN_PROGRESS,
      });

      expect(result).toBe(false);
    });
  });

  describe('isCaseEligibleForInProgress', () => {
    it('should return true for eligible statuses', () => {
      expect((service as any).isCaseEligibleForInProgress(CaseStatus.STATUS_10_ASSIGNED)).toBe(true);
      expect((service as any).isCaseEligibleForInProgress(CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT)).toBe(true);
      expect((service as any).isCaseEligibleForInProgress(CaseStatus.STATUS_03_RETURNED)).toBe(true);
    });

    it('should return false for ineligible statuses', () => {
      expect((service as any).isCaseEligibleForInProgress(CaseStatus.STATUS_20_IN_PROGRESS)).toBe(false);
      expect((service as any).isCaseEligibleForInProgress(CaseStatus.STATUS_81_CLOSED_REFUTED)).toBe(false);
    });
  });
});
