import { Test, TestingModule } from '@nestjs/testing';
import { TaskService } from '../src/modules/task/task.service';
import { TaskRepository } from '../src/modules/repository/task.repository';
import { TaskLifecycleService } from '../src/modules/task/services/task-lifecycle.service';
import { FlowableService } from '../src/modules/flowable/flowable.service';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { CaseInvestigatorService } from '../src/modules/case-investigator/case-investigator.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TaskStatus, CaseStatus, Priority } from '@prisma/client-cms';
import * as timersPromises from 'node:timers/promises';

jest.mock('node:timers/promises', () => ({ setTimeout: jest.fn().mockResolvedValue(undefined) }));

describe('TaskService', () => {
  let service: TaskService;
  let taskRepository: jest.Mocked<TaskRepository>;
  let flowableService: jest.Mocked<FlowableService>;
  let loggingService: jest.Mocked<LoggingOrchestrationService>;
  let loggerService: jest.Mocked<LoggerService>;
  let eventEmitter: jest.Mocked<EventEmitter2>;
  let caseInvestigatorService: jest.Mocked<CaseInvestigatorService>;

  // Shared test fixtures
  const mockCaseRecord = {
    case_id: 1,
    tenant_id: 'tenant1',
    priority: 'MEDIUM' as Priority,
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
        {
          provide: CaseInvestigatorService,
          useValue: {
            isBlacklisted: jest.fn().mockResolvedValue(null),
            syncTaskAssignment: jest.fn().mockResolvedValue(undefined),
            assertReadAccess: jest.fn().mockResolvedValue(undefined),
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
    caseInvestigatorService = module.get(CaseInvestigatorService);
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
        // NOTE: the repository returns Prisma's snake_case shape
        // (assigned_user_id), not the DTO's camelCase (assignedUserId) — an
        // earlier version of this mock spread `updateData` directly on top
        // of existingTask, which left assigned_user_id silently unchanged
        // (still null) since assignedUserId just became a stray extra key.
        // That masked the ACL-sync assertion below actually working; fixed
        // to mirror what the real repository call returns.
        taskRepository.updateTask.mockResolvedValue({
          ...existingTask,
          status: updateData.status,
          assigned_user_id: updateData.assignedUserId,
        } as any);
        return callback(taskRepository as any);
      });

      flowableService.handleTaskAssigned.mockResolvedValue();

      const result = await service.updateTask(1, updateData, 'user1', 'tenant1');

      expect(result).toBeDefined();
      expect(taskRepository.updateTask).toHaveBeenCalledWith(1, expect.objectContaining({ assigned_user_id: 'user2' }), expect.anything());
      expect(caseInvestigatorService.syncTaskAssignment).toHaveBeenCalledWith(1, 'tenant1', 'user1', {
        taskId: 1,
        previousAssigneeId: null,
        newAssigneeId: 'user2',
        newStatus: TaskStatus.STATUS_10_ASSIGNED,
      });
    });

    it('should refuse to reassign to a user blacklisted on this case, without writing anything', async () => {
      const updateData = { assignedUserId: 'user2' };

      taskRepository.transaction.mockImplementation(async (callback) => {
        taskRepository.findTaskWithCase.mockResolvedValue(existingTask);
        return callback(taskRepository as any);
      });
      caseInvestigatorService.isBlacklisted.mockResolvedValue({
        blocked_by: 'supervisor1',
        blocked_at: new Date('2026-01-01T00:00:00Z'),
        block_reason: 'conflict of interest',
      } as any);

      await expect(service.updateTask(1, updateData, 'user1', 'tenant1')).rejects.toThrow(ForbiddenException);
      expect(taskRepository.updateTask).not.toHaveBeenCalled();
      expect(caseInvestigatorService.syncTaskAssignment).not.toHaveBeenCalled();
    });

    it('should not fail the update if ACL sync throws (best-effort, task mutation already committed)', async () => {
      const updateData = { assignedUserId: 'user2' };
      const updatedTask = { ...existingTask, assigned_user_id: updateData.assignedUserId } as any;

      taskRepository.transaction.mockImplementation(async (callback) => {
        taskRepository.findTaskWithCase.mockResolvedValue(existingTask);
        taskRepository.updateTask.mockResolvedValue(updatedTask);
        return callback(taskRepository as any);
      });
      flowableService.handleTaskAssigned.mockResolvedValue();
      caseInvestigatorService.syncTaskAssignment.mockRejectedValue(new Error('no live row to revoke'));

      const result = await service.updateTask(1, updateData, 'user1', 'tenant1');

      expect(result).toMatchObject(updatedTask);
      expect(loggerService.warn).toHaveBeenCalled();
    });

    it('should leave the existing assignment untouched when assignedUserId is omitted (not self-assign the caller)', async () => {
      // Broader manifestation of the same bug, found while fixing it: with the
      // old `updateData.assignedUserId === existingTask.assigned_user_id ? ... :
      // userId` check, omitting assignedUserId entirely compares `undefined ===
      // null` (false) and ALSO fell through to `userId` — meaning a plain
      // status/notes-only update on an unassigned task silently self-assigned it
      // to whoever called the endpoint. existingTask.assigned_user_id is null in
      // this fixture, so this reproduces exactly that case.
      const updateData = { investigationNotes: 'just a note, no assignment change' };

      taskRepository.transaction.mockImplementation(async (callback) => {
        taskRepository.findTaskWithCase.mockResolvedValue(existingTask);
        taskRepository.updateTask.mockResolvedValue({ ...existingTask, ...updateData } as any);
        return callback(taskRepository as any);
      });

      await service.updateTask(1, updateData, 'user1', 'tenant1');

      expect(taskRepository.updateTask).toHaveBeenCalledWith(1, expect.objectContaining({ assigned_user_id: null }), expect.anything());
    });

    it('should persist an explicit null assignedUserId as unassignment, not as the caller', async () => {
      // This DTO documents assignedUserId: null as "unassign". Uses a fixture
      // with a real existing assignee so the write is distinguishable from the
      // "omitted" case above.
      const assignedFixture = { ...existingTask, assigned_user_id: 'user2' };
      const updateData = { assignedUserId: null } as any;

      taskRepository.transaction.mockImplementation(async (callback) => {
        taskRepository.findTaskWithCase.mockResolvedValue(assignedFixture);
        taskRepository.updateTask.mockResolvedValue({ ...assignedFixture, assigned_user_id: null } as any);
        return callback(taskRepository as any);
      });

      await service.updateTask(1, updateData, 'user1', 'tenant1');

      expect(taskRepository.updateTask).toHaveBeenCalledWith(1, expect.objectContaining({ assigned_user_id: null }), expect.anything());
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

    it('should promote only the task case', async () => {
      const updateData = { status: TaskStatus.STATUS_20_IN_PROGRESS };
      const updatedCase = {
        case_id: 1,
        status: CaseStatus.STATUS_20_IN_PROGRESS,
      };
      const txCase = {
        findFirst: jest.fn().mockResolvedValue({
          case_id: 2,
          status: CaseStatus.STATUS_20_IN_PROGRESS,
        }),
        update: jest.fn(),
      };

      taskRepository.transaction.mockImplementation(async (callback) => {
        const tx: any = {
          ...taskRepository,
          case: txCase,
        };

        tx.findTaskWithCase.mockResolvedValue(existingTask);
        tx.updateTask.mockResolvedValue({ ...existingTask, status: TaskStatus.STATUS_20_IN_PROGRESS });
        tx.findCaseStatus.mockResolvedValue(existingTask.case);
        tx.updateCase.mockResolvedValue(updatedCase);

        return callback(tx);
      });

      flowableService.handleTaskAssigned.mockResolvedValue();

      const result = await service.updateTask(1, updateData, 'user1', 'tenant1');

      expect(result).toBeDefined();
      expect(taskRepository.updateCase).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ status: CaseStatus.STATUS_20_IN_PROGRESS }),
        expect.anything(),
      );
      expect(txCase.findFirst).not.toHaveBeenCalled();
      expect(txCase.update).not.toHaveBeenCalled();
    });

    it(
      'should handle flowable operation retry failure',
      async () => {
        const setTimeoutSpy = timersPromises.setTimeout as jest.Mock;
        setTimeoutSpy.mockResolvedValue(undefined);
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
        setTimeoutSpy.mockReset();
      },
      5000,
    );

    it('should not query related cases while promoting the task case', async () => {
      const updateData = { status: TaskStatus.STATUS_20_IN_PROGRESS };

      taskRepository.transaction.mockImplementation(async (callback) => {
        const tx: any = {
          ...taskRepository,
          case: {
            findFirst: jest.fn().mockRejectedValue(new Error('Related case lookup failed')),
            update: jest.fn(),
          },
        };

        tx.findTaskWithCase.mockResolvedValue(existingTask);
        tx.updateTask.mockResolvedValue({ ...existingTask, status: TaskStatus.STATUS_20_IN_PROGRESS });
        tx.findCaseStatus.mockResolvedValue(existingTask.case);
        tx.updateCase.mockResolvedValue({ ...existingTask.case, status: CaseStatus.STATUS_20_IN_PROGRESS });

        return callback(tx);
      });

      await expect(service.updateTask(1, updateData, 'user1', 'tenant1')).resolves.toBeDefined();
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

      const result = await service.getTaskById(1, 'tenant1', 'user1', 'CMS_SUPERVISOR');

      expect(result).toEqual(task);
    });

    it('should handle errors', async () => {
      taskRepository.findTaskWithCase.mockRejectedValue(new Error('Not found'));

      await expect(service.getTaskById(1, 'tenant1', 'user1', 'CMS_SUPERVISOR')).rejects.toThrow();
    });

    it('should gate on the task case membership before returning', async () => {
      const task = { task_id: 1, case_id: 1, tenant_id: 'tenant1' } as any;
      taskRepository.findTaskWithCase.mockResolvedValue(task);

      await service.getTaskById(1, 'tenant1', 'user1', 'CMS_INVESTIGATOR');

      expect(caseInvestigatorService.assertReadAccess).toHaveBeenCalledWith(1, 'user1', 'tenant1', 'CMS_INVESTIGATOR');
    });

    it('should propagate the gate rejection when access is denied', async () => {
      const task = { task_id: 1, case_id: 1, tenant_id: 'tenant1' } as any;
      taskRepository.findTaskWithCase.mockResolvedValue(task);
      caseInvestigatorService.assertReadAccess.mockRejectedValueOnce(new Error('Case not found or access denied'));

      await expect(service.getTaskById(1, 'tenant1', 'user1', 'CMS_INVESTIGATOR')).rejects.toThrow(
        'Case not found or access denied',
      );
    });

    it('should not gate when the task does not exist (nothing to check access on)', async () => {
      taskRepository.findTaskWithCase.mockResolvedValue(null);

      const result = await service.getTaskById(999, 'tenant1', 'user1', 'CMS_INVESTIGATOR');

      expect(result).toBeNull();
      expect(caseInvestigatorService.assertReadAccess).not.toHaveBeenCalled();
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
      expect(caseInvestigatorService.syncTaskAssignment).toHaveBeenCalledWith(1, 'tenant1', 'user1', {
        taskId: 1,
        previousAssigneeId: null,
        newAssigneeId: 'user1',
        newStatus: TaskStatus.STATUS_10_ASSIGNED,
      });
    });

    it('should throw NotFoundException if task not found', async () => {
      taskRepository.findTaskById.mockResolvedValue(null);

      await expect(service.claimTask(999, 'user1', 'tenant1')).rejects.toThrow(new NotFoundException('Task 999 not found'));
    });

    it('should refuse to claim a task on a case the claimant is blacklisted on, without writing anything', async () => {
      const existingTask = {
        task_id: 1,
        case_id: 1,
        assigned_user_id: null,
        status: TaskStatus.STATUS_01_UNASSIGNED,
        tenant_id: 'tenant1',
      } as any;
      taskRepository.findTaskById.mockResolvedValue(existingTask);
      caseInvestigatorService.isBlacklisted.mockResolvedValue({
        blocked_by: 'supervisor1',
        blocked_at: new Date('2026-01-01T00:00:00Z'),
        block_reason: 'conflict of interest',
      } as any);

      await expect(service.claimTask(1, 'user1', 'tenant1')).rejects.toThrow(ForbiddenException);
      expect(taskRepository.updateTask).not.toHaveBeenCalled();
      expect(caseInvestigatorService.syncTaskAssignment).not.toHaveBeenCalled();
    });

    it('should not fail the claim if ACL sync throws (best-effort, task mutation already succeeded)', async () => {
      const existingTask = {
        task_id: 1,
        case_id: 1,
        assigned_user_id: null,
        status: TaskStatus.STATUS_01_UNASSIGNED,
        tenant_id: 'tenant1',
      } as any;
      const updatedTask = { ...existingTask, assigned_user_id: 'user1', status: TaskStatus.STATUS_10_ASSIGNED } as any;
      taskRepository.findTaskById.mockResolvedValue(existingTask);
      taskRepository.updateTask.mockResolvedValue(updatedTask);
      caseInvestigatorService.syncTaskAssignment.mockRejectedValue(new Error('no live row to revoke'));

      const result = await service.claimTask(1, 'user1', 'tenant1');

      expect(result).toEqual(updatedTask);
      expect(loggerService.warn).toHaveBeenCalled();
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
