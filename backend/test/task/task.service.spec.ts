import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { TaskService } from '../../src/modules/task/task.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditLogService } from '../../src/modules/audit/auditLog.service';
import { CreateTaskDto } from '../../src/modules/task/dto/create-task.dto';
import { UpdateTaskDto } from '../../src/modules/task/dto/update-task.dto';
import { TaskStatus } from '@prisma/client-cms';
import { LoggerService } from '@tazama-lf/frms-coe-lib';

jest.mock('axios');
import axios from 'axios';
import { Outcome } from 'src/utils/types/outcome';

describe('TaskService', () => {
  let service: TaskService;

  const mockPrismaService = {
    task: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
  };

  class MockAuditLogService extends AuditLogService {
    logAction = jest.fn();
    logPermissionDenied = jest.fn();
    getLogs = jest.fn();
    getActionHistoryForAlert = jest.fn();
  }

  const mockAuditLogService = new MockAuditLogService({} as any); // Pass a dummy PrismaService if needed

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const mockLoggerService = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

  const mockTask = {
    task_id: 'task-123',
    case_id: 'case-123',
    assigned_user_id: 'user-123',
    status: TaskStatus.STATUS_10_ASSIGNED,
    name: 'Test Task',
    description: 'Test task description',
    created_at: new Date(),
    updated_at: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: Logger,
          useValue: mockLogger,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    service = module.get<TaskService>(TaskService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createTask', () => {
    const createTaskDto: CreateTaskDto = {
      caseId: 'case-123',
      assignedUserId: 'user-456',
      status: TaskStatus.STATUS_01_UNASSIGNED,
      name: 'New Task',
      description: 'New task description',
    };

    const createdByUserId = 'user-123';

    it('should create a task successfully', async () => {
      mockPrismaService.task.create.mockResolvedValue(mockTask);
      mockAuditLogService.logAction.mockResolvedValue(undefined);

      const result = await service.createTask(createTaskDto, createdByUserId, mockAuditLogService, mockLoggerService);

      expect(result).toEqual(mockTask);
      expect(mockPrismaService.task.create).toHaveBeenCalledWith({
        data: {
          case_id: createTaskDto.caseId,
          status: createTaskDto.status,
          assigned_user_id: createTaskDto.assignedUserId,
          name: createTaskDto.name,
          description: createTaskDto.description,
        },
      });
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith({
        userId: createdByUserId,
        actionPerformed: `Created task ${mockTask.task_id}`,
        entityName: 'TaskService',
        operation: 'createTask',
        outcome: Outcome.SUCCESS,
        performedAt: expect.any(Date),
      });
    });

    it('should handle database errors during task creation', async () => {
      const dbError = new Error('Database connection failed');
      mockPrismaService.task.create.mockRejectedValue(dbError);

      await expect(service.createTask(createTaskDto, createdByUserId, mockAuditLogService, mockLoggerService)).rejects.toThrow(
        'Database connection failed',
      );

      expect(mockLoggerService.error).toHaveBeenCalledWith('Error creating task', dbError, TaskService.name);
    });

    it('should handle database errors properly', async () => {
      const dbError = new Error('Database connection failed');
      mockPrismaService.task.create.mockRejectedValue(dbError);
      mockAuditLogService.logAction.mockResolvedValue(undefined);

      await expect(service.createTask(createTaskDto, createdByUserId, mockAuditLogService, mockLoggerService)).rejects.toThrow(
        'Database connection failed',
      );

      expect(mockPrismaService.task.create).toHaveBeenCalled();
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith({
        userId: createdByUserId,
        actionPerformed: `Error creating task: ${JSON.stringify(createTaskDto)}`,
        entityName: 'TaskService',
        operation: 'createTask',
        outcome: 'FAILURE',
        performedAt: expect.any(Date) as Date,
      });
    });
  });

  describe('reassignTask', () => {
    const taskId = 'task-123';
    const newAssigneeId = 'user-789';
    const reassignedByUserId = 'user-456';

    it('should reassign a task successfully', async () => {
      const reassignedTask = { ...mockTask, assigned_user_id: newAssigneeId };

      mockPrismaService.task.update.mockResolvedValue(reassignedTask);
      mockAuditLogService.logAction.mockResolvedValue(undefined);

      const result = await service.reassignTask(taskId, reassignedByUserId, newAssigneeId, mockAuditLogService);

      expect(result).toEqual(reassignedTask);
      expect(mockPrismaService.task.update).toHaveBeenCalledWith({
        where: { task_id: taskId },
        data: { assigned_user_id: newAssigneeId },
      });
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith({
        userId: reassignedByUserId,
        actionPerformed: `Reassigned task ${taskId} to user ${newAssigneeId}`,
        entityName: 'TaskService',
        operation: 'reassignTask',
        outcome: Outcome.SUCCESS,
        performedAt: expect.any(Date),
      });
    });

    it('should handle database errors during task reassignment', async () => {
      const dbError = new Error('Database update failed');
      mockPrismaService.task.update.mockRejectedValue(dbError);

      await expect(service.reassignTask(taskId, reassignedByUserId, newAssigneeId, mockAuditLogService)).rejects.toThrow(
        'Database update failed',
      );

      expect(mockLoggerService.error).toHaveBeenCalledWith(`Error reassigning task ${taskId}`, dbError, TaskService.name);
    });
  });

  describe('updateTask', () => {
    const taskId = 'task-123';
    const updateTaskDto: UpdateTaskDto = {
      status: TaskStatus.STATUS_20_IN_PROGRESS,
      name: 'Updated Task Name',
      description: 'Updated task description',
    };
    const updatedByUserId = 'user-456';

    it('should update a task successfully', async () => {
      const updatedTask = { ...mockTask, ...updateTaskDto };

      mockPrismaService.task.update.mockResolvedValue(updatedTask);
      mockAuditLogService.logAction.mockResolvedValue(undefined);

      const result = await service.updateTask(taskId, updateTaskDto, updatedByUserId, mockAuditLogService);

      expect(result).toEqual(updatedTask);
      expect(mockPrismaService.task.update).toHaveBeenCalledWith({
        where: { task_id: taskId },
        data: {
          status: updateTaskDto.status,
          assigned_user_id: updateTaskDto.assignedUserId,
          name: updateTaskDto.name,
          description: updateTaskDto.description,
        },
      });
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith({
        userId: updatedByUserId,
        actionPerformed: `Updated task ${taskId}`,
        entityName: 'TaskService',
        operation: 'updateTask',
        outcome: Outcome.SUCCESS,
        performedAt: expect.any(Date),
      });
    });

    it('should update with partial data', async () => {
      const partialUpdate: UpdateTaskDto = { status: TaskStatus.STATUS_30_COMPLETED };
      const partiallyUpdatedTask = { ...mockTask, status: TaskStatus.STATUS_30_COMPLETED };

      mockPrismaService.task.update.mockResolvedValue(partiallyUpdatedTask);
      mockAuditLogService.logAction.mockResolvedValue(undefined);

      const result = await service.updateTask(taskId, partialUpdate, updatedByUserId, mockAuditLogService);

      expect(result).toEqual(partiallyUpdatedTask);
      expect(mockPrismaService.task.update).toHaveBeenCalledWith({
        where: { task_id: taskId },
        data: {
          status: partialUpdate.status,
          assigned_user_id: partialUpdate.assignedUserId,
          name: partialUpdate.name,
          description: partialUpdate.description,
        },
      });
    });

    it('should handle database errors during task update', async () => {
      const dbError = new Error('Database update failed');
      mockPrismaService.task.update.mockRejectedValue(dbError);

      await expect(service.updateTask(taskId, updateTaskDto, updatedByUserId, mockAuditLogService)).rejects.toThrow(
        'Database update failed',
      );

      expect(mockLoggerService.error).toHaveBeenCalledWith(`Error updating task ${taskId}`, dbError, TaskService.name);
    });

    it('should handle empty update object', async () => {
      const emptyUpdate: UpdateTaskDto = {};

      mockPrismaService.task.update.mockResolvedValue(mockTask);
      mockAuditLogService.logAction.mockResolvedValue(undefined);

      const result = await service.updateTask(taskId, emptyUpdate, updatedByUserId, mockAuditLogService);

      expect(result).toEqual(mockTask);
      expect(mockPrismaService.task.update).toHaveBeenCalledWith({
        where: { task_id: taskId },
        data: {
          status: emptyUpdate.status,
          assigned_user_id: emptyUpdate.assignedUserId,
          name: emptyUpdate.name,
          description: emptyUpdate.description,
        },
      });
    });
  });

  describe('getTasksByCaseId', () => {
    const caseId = 'case-123';

    it('should return tasks for a given case ID', async () => {
      const tasks = [mockTask, { ...mockTask, task_id: 'task-456' }];
      mockPrismaService.task.findMany.mockResolvedValue(tasks);

      const result = await service.getTasksByCaseId(caseId);

      expect(result).toEqual(tasks);
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        where: { case_id: caseId },
        orderBy: {
          created_at: 'desc',
        },
      });
    });

    it('should return empty array when no tasks found', async () => {
      mockPrismaService.task.findMany.mockResolvedValue([]);

      const result = await service.getTasksByCaseId(caseId);

      expect(result).toEqual([]);
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        where: { case_id: caseId },
        orderBy: {
          created_at: 'desc',
        },
      });
    });

    it('should handle database errors during task retrieval', async () => {
      const dbError = new Error('Database query failed');
      mockPrismaService.task.findMany.mockRejectedValue(dbError);

      await expect(service.getTasksByCaseId(caseId)).rejects.toThrow('Database query failed');

      expect(mockLoggerService.error).toHaveBeenCalledWith('Error retrieving tasks', dbError, TaskService.name);
    });

    it('should return tasks with audit logging when userId is provided', async () => {
      const tasks = [mockTask];
      const userId = 'user-123';
      mockPrismaService.task.findMany.mockResolvedValue(tasks);
      mockAuditLogService.logAction.mockResolvedValue(undefined);

      const result = await service.getTasksByCaseId(caseId, userId);

      expect(result).toEqual(tasks);
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'getTasksByCaseId',
        entityName: 'TaskService',
        actionPerformed: `Successfully retrieved tasks for case : ${caseId}`,
        outcome: 'SUCCESS',
        performedAt: expect.any(Date) as Date,
      });
    });

    it('should handle database errors with audit logging when userId is provided', async () => {
      const dbError = new Error('Database query failed');
      const userId = 'user-123';
      mockPrismaService.task.findMany.mockRejectedValue(dbError);
      mockAuditLogService.logAction.mockResolvedValue(undefined);

      await expect(service.getTasksByCaseId(caseId, userId)).rejects.toThrow('Database query failed');

      expect(mockAuditLogService.logAction).toHaveBeenCalledWith({
        userId,
        operation: 'getTasksByCaseId',
        entityName: 'TaskService',
        actionPerformed: `Error retrieving tasks for case : ${caseId}`,
        outcome: 'FAILURE',
        performedAt: expect.any(Date) as Date,
      });
    });
  });

  describe('getTaskById', () => {
    const taskId = 'task-123';

    it('should return a task by ID', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(mockTask);

      const result = await service.getTaskById(taskId);

      expect(result).toEqual(mockTask);
      expect(mockPrismaService.task.findUnique).toHaveBeenCalledWith({
        where: { task_id: taskId },
      });
    });

    it('should return null if task not found', async () => {
      mockPrismaService.task.findUnique.mockResolvedValue(null);

      const result = await service.getTaskById(taskId);

      expect(result).toBeNull();
      expect(mockPrismaService.task.findUnique).toHaveBeenCalledWith({
        where: { task_id: taskId },
      });
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockPrismaService.task.findUnique.mockRejectedValue(dbError);

      await expect(service.getTaskById(taskId)).rejects.toThrow('Database error');
      expect(mockLoggerService.error).toHaveBeenCalledWith(`Error retrieving task ${taskId}`, dbError, TaskService.name);
    });
  });

  describe('getTasks', () => {
    it('should return all tasks', async () => {
      const tasks = [mockTask, { ...mockTask, task_id: 'task-456' }];
      mockPrismaService.task.findMany.mockResolvedValue(tasks);

      const result = await service.getTasks();

      expect(result).toEqual(tasks);
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        where: {},
        orderBy: { created_at: 'desc' },
      });
    });

    it('should filter tasks by status', async () => {
      const status = TaskStatus.STATUS_10_ASSIGNED;
      const tasks = [mockTask];
      mockPrismaService.task.findMany.mockResolvedValue(tasks);

      const result = await service.getTasks(status);

      expect(result).toEqual(tasks);
      expect(mockPrismaService.task.findMany).toHaveBeenCalledWith({
        where: { status },
        orderBy: { created_at: 'desc' },
      });
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockPrismaService.task.findMany.mockRejectedValue(dbError);

      await expect(service.getTasks()).rejects.toThrow('Database error');
      expect(mockLoggerService.error).toHaveBeenCalledWith('Error retrieving tasks', dbError, TaskService.name);
    });
  });

  describe('assignTaskToInvestigator', () => {
    const taskId = 'task-123';
    const investigatorId = 'user-456';
    const assignedByUserId = 'user-789';

    it('should assign a task to an investigator', async () => {
      const assignedTask = { ...mockTask, assigned_user_id: investigatorId };
      mockPrismaService.task.update.mockResolvedValue(assignedTask);
      mockAuditLogService.logAction.mockResolvedValue(undefined);

      // Only mock resolved value for this test
      (axios.get as jest.Mock).mockResolvedValue({ data: { roles: ['INVESTIGATOR'] } });

      const result = await service.assignTaskToInvestigator(taskId, investigatorId, assignedByUserId);

      expect(result).toEqual(assignedTask);
      expect(mockPrismaService.task.update).toHaveBeenCalledWith({
        where: { task_id: taskId },
        data: { assigned_user_id: investigatorId, status: TaskStatus.STATUS_10_ASSIGNED },
      });
      expect(mockAuditLogService.logAction).toHaveBeenCalledWith({
        userId: assignedByUserId,
        actionPerformed: `Assigned task ${taskId} to investigator ${investigatorId}`,
        entityName: 'TaskService',
        operation: 'assignTaskToInvestigator',
        outcome: Outcome.SUCCESS,
        performedAt: expect.any(Date),
      });
    });

    it('should handle database errors', async () => {
      const dbError = new Error('Database error');
      mockPrismaService.task.update.mockRejectedValue(dbError);

      // Only mock resolved value for this test
      (axios.get as jest.Mock).mockResolvedValue({ data: { roles: ['INVESTIGATOR'] } });

      await expect(service.assignTaskToInvestigator(taskId, investigatorId, assignedByUserId)).rejects.toThrow('Database error');
      expect(mockLoggerService.error).toHaveBeenCalledWith(`Error assigning task ${taskId}`, dbError, TaskService.name);
    });

    it('should handle errors when fetching user roles', async () => {
      const dbError = new Error('Database error');
      (axios.get as jest.Mock).mockRejectedValue(dbError);

      await expect(service.assignTaskToInvestigator(taskId, investigatorId, assignedByUserId)).rejects.toThrow('Database error');
      expect(mockLoggerService.error).toHaveBeenCalledWith('Error fetching user roles', dbError, TaskService.name);
    });
  });
});
