import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskController } from '../../src/modules/task/task.controller';
import { TaskService } from '../../src/modules/task/task.service';
import { CreateTaskDto } from '../../src/modules/task/dto/create-task.dto';
import { UpdateTaskDto } from '../../src/modules/task/dto/update-task.dto';
import { TaskStatus } from '@prisma/client-cms';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { LogCallback } from '@tazama-lf/frms-coe-lib/lib/helpers/logUtilities';
import { LumberjackGRPCService } from '@tazama-lf/frms-coe-lib/lib/services/lumberjackGRPCService';
import { Logger } from 'pino';
import { AuthenticatedRequest } from 'src/utils/types/auth.types';

describe('TaskController', () => {
  let controller: TaskController;

  const mockTaskService = {
    createTask: jest.fn(),
    reassignTask: jest.fn(),
    updateTask: jest.fn(),
    assignTaskToInvestigator: jest.fn(),
    getTasks: jest.fn(),
    getTasksByCaseId: jest.fn(),
    getTaskById: jest.fn(), // <-- Add this line
  };

  const mockUser = {
    token: {
      clientId: 'user-123',
      sub: 'user-123',
      iat: 1234567890,
      exp: 1234567890,
      claims: [],
      realmRoles: [],
    },
    validated: {
      isValid: true,
      errors: [],
    },
    validClaims: ['CMS_TEST_ROLE'],
  };

  const mockRequest = {
    user: mockUser,
  } as unknown as AuthenticatedRequest;

  const mockTask = {
    id: 'task-123',
    caseId: 'case-123',
    assignedUserId: 'user-123',
    status: TaskStatus.STATUS_10_ASSIGNED,
    name: 'Test Task',
    description: 'Test task description',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  class MockLoggerService implements LoggerService {
    trace: (message: string, serviceOperation?: string, id?: string, callback?: LogCallback) => void;
    logger: Console | Logger;
    lumberjackService: LumberjackGRPCService | undefined;
    fatal(message: string | Error, innerError?: unknown, serviceOperation?: string, id?: string, callback?: LogCallback): void {
      throw new Error('Method not implemented.');
    }
    log = jest.fn();
    error = jest.fn();
    warn = jest.fn();
    debug = jest.fn();
    verbose = jest.fn();
  }

  const mockLoggerService = new MockLoggerService();

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        {
          provide: TaskService,
          useValue: mockTaskService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
      ],
    }).compile();

    controller = module.get<TaskController>(TaskController);

    // Reset all mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('createTask', () => {
    const createTaskDto: CreateTaskDto = {
      caseId: 'case-123',
      assignedUserId: 'user-456',
      status: TaskStatus.STATUS_01_UNASSIGNED,
      name: 'New Task',
      description: 'New task description',
    };

    it('should create a task successfully', async () => {
      mockTaskService.createTask.mockResolvedValue(mockTask);

      const result = await controller.createTask(createTaskDto, mockRequest);

      expect(result).toEqual(mockTask);
      expect(mockTaskService.createTask).toHaveBeenCalledWith(createTaskDto, mockUser.token.clientId);
      expect(mockTaskService.createTask).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors during task creation', async () => {
      const error = new BadRequestException('Invalid case ID');
      mockTaskService.createTask.mockRejectedValue(error);

      await expect(controller.createTask(createTaskDto, mockRequest)).rejects.toThrow(BadRequestException);

      expect(mockTaskService.createTask).toHaveBeenCalledWith(createTaskDto, mockUser.token.clientId);
    });

    it('should pass the correct parameters to service', async () => {
      mockTaskService.createTask.mockResolvedValue(mockTask);

      await controller.createTask(createTaskDto, mockRequest);

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        expect.objectContaining({
          caseId: createTaskDto.caseId,
          assignedUserId: createTaskDto.assignedUserId,
          status: createTaskDto.status,
          name: createTaskDto.name,
          description: createTaskDto.description,
        }),
        mockUser.token.clientId,
      );
    });
  });

  describe('reassignTask', () => {
    const taskId = 'task-123';
    const newAssigneeId = 'user-789';

    it('should reassign a task successfully', async () => {
      const reassignedTask = { ...mockTask, assignedUserId: newAssigneeId };
      mockTaskService.reassignTask.mockResolvedValue(reassignedTask);

      const result = await controller.reassignTask(taskId, newAssigneeId, mockRequest);

      expect(result).toEqual(reassignedTask);
      expect(mockTaskService.reassignTask).toHaveBeenCalledWith(taskId, mockUser.token.clientId, newAssigneeId);
      expect(mockTaskService.reassignTask).toHaveBeenCalledTimes(1);
    });

    it('should handle task not found error', async () => {
      const error = new NotFoundException('Task not found');
      mockTaskService.reassignTask.mockRejectedValue(error);

      await expect(controller.reassignTask(taskId, newAssigneeId, mockRequest)).rejects.toThrow(NotFoundException);

      expect(mockTaskService.reassignTask).toHaveBeenCalledWith(taskId, mockUser.token.clientId, newAssigneeId);
    });

    it('should handle invalid assignee error', async () => {
      const error = new BadRequestException('Invalid assignee ID');
      mockTaskService.reassignTask.mockRejectedValue(error);

      await expect(controller.reassignTask(taskId, 'invalid-id', mockRequest)).rejects.toThrow(BadRequestException);

      expect(mockTaskService.reassignTask).toHaveBeenCalledWith(taskId, mockUser.token.clientId, 'invalid-id');
    });

    it('should pass correct parameters to service', async () => {
      const reassignedTask = { ...mockTask, assignedUserId: newAssigneeId };
      mockTaskService.reassignTask.mockResolvedValue(reassignedTask);

      await controller.reassignTask(taskId, newAssigneeId, mockRequest);

      expect(mockTaskService.reassignTask).toHaveBeenCalledWith(taskId, mockUser.token.clientId, newAssigneeId);
    });
  });

  describe('updateTask', () => {
    const taskId = 'task-123';
    const updateTaskDto: UpdateTaskDto = {
      status: TaskStatus.STATUS_20_IN_PROGRESS,
      name: 'Updated Task Name',
      description: 'Updated task description',
    };

    it('should update a task successfully', async () => {
      const updatedTask = { ...mockTask, ...updateTaskDto };
      mockTaskService.updateTask.mockResolvedValue(updatedTask);

      const result = await controller.updateTask(taskId, updateTaskDto, mockRequest);

      expect(result).toEqual(updatedTask);
      expect(mockTaskService.updateTask).toHaveBeenCalledWith(taskId, updateTaskDto, mockUser.token.clientId);
      expect(mockTaskService.updateTask).toHaveBeenCalledTimes(1);
    });

    it('should handle task not found error during update', async () => {
      const error = new NotFoundException('Task not found');
      mockTaskService.updateTask.mockRejectedValue(error);

      await expect(controller.updateTask(taskId, updateTaskDto, mockRequest)).rejects.toThrow(NotFoundException);

      expect(mockTaskService.updateTask).toHaveBeenCalledWith(taskId, updateTaskDto, mockUser.token.clientId);
    });

    it('should handle validation errors during update', async () => {
      const error = new BadRequestException('Invalid task status');
      mockTaskService.updateTask.mockRejectedValue(error);

      await expect(controller.updateTask(taskId, updateTaskDto, mockRequest)).rejects.toThrow(BadRequestException);

      expect(mockTaskService.updateTask).toHaveBeenCalledWith(taskId, updateTaskDto, mockUser.token.clientId);
    });

    it('should update with partial data', async () => {
      const partialUpdate: UpdateTaskDto = {
        status: TaskStatus.STATUS_30_COMPLETED,
      };
      const updatedTask = { ...mockTask, status: TaskStatus.STATUS_30_COMPLETED };
      mockTaskService.updateTask.mockResolvedValue(updatedTask);

      const result = await controller.updateTask(taskId, partialUpdate, mockRequest);

      expect(result).toEqual(updatedTask);
      expect(mockTaskService.updateTask).toHaveBeenCalledWith(taskId, partialUpdate, mockUser.token.clientId);
    });

    it('should handle empty update object', async () => {
      const emptyUpdate: UpdateTaskDto = {};
      mockTaskService.updateTask.mockResolvedValue(mockTask);

      const result = await controller.updateTask(taskId, emptyUpdate, mockRequest);

      expect(result).toEqual(mockTask);
      expect(mockTaskService.updateTask).toHaveBeenCalledWith(taskId, emptyUpdate, mockUser.token.clientId);
    });

    it('should pass correct parameters to service', async () => {
      const updatedTask = { ...mockTask, ...updateTaskDto };
      mockTaskService.updateTask.mockResolvedValue(updatedTask);

      await controller.updateTask(taskId, updateTaskDto, mockRequest);

      expect(mockTaskService.updateTask).toHaveBeenCalledWith(
        taskId,
        expect.objectContaining({
          status: updateTaskDto.status,
          name: updateTaskDto.name,
          description: updateTaskDto.description,
        }),
        mockUser.token.clientId,
      );
    });
  });

  describe('assignTaskToInvestigator', () => {
    const taskId = 'task-123';
    const investigatorId = 'user-456';

    it('should assign a task to investigator successfully', async () => {
      mockTaskService.assignTaskToInvestigator = jest.fn().mockResolvedValue(mockTask);

      const result = await controller.assignTaskToInvestigator(taskId, investigatorId, mockRequest);

      expect(result).toEqual(mockTask);
      expect(mockTaskService.assignTaskToInvestigator).toHaveBeenCalledWith(taskId, investigatorId, mockUser.token.clientId);
    });

    it('should handle error during assignment', async () => {
      const error = new BadRequestException('User is not investigator');
      mockTaskService.assignTaskToInvestigator = jest.fn().mockRejectedValue(error);

      await expect(controller.assignTaskToInvestigator(taskId, investigatorId, mockRequest)).rejects.toThrow(BadRequestException);
    });
  });

  describe('getTasks', () => {
    it('should get all tasks', async () => {
      mockTaskService.getTasks = jest.fn().mockResolvedValue([mockTask]);
      const result = await controller.getTasks();
      expect(result).toEqual([mockTask]);
      expect(mockTaskService.getTasks).toHaveBeenCalled();
    });

    it('should get tasks filtered by status', async () => {
      mockTaskService.getTasks = jest.fn().mockResolvedValue([mockTask]);
      const result = await controller.getTasks(TaskStatus.STATUS_10_ASSIGNED);
      expect(result).toEqual([mockTask]);
      expect(mockTaskService.getTasks).toHaveBeenCalledWith(TaskStatus.STATUS_10_ASSIGNED);
    });
  });

  describe('getTasksByCaseId', () => {
    const caseId = 'case-123';

    it('should get tasks by case ID', async () => {
      mockTaskService.getTasksByCaseId = jest.fn().mockResolvedValue([mockTask]);
      const result = await controller.getTasksByCaseId(caseId, mockRequest);
      expect(result).toEqual([mockTask]);
      expect(mockTaskService.getTasksByCaseId).toHaveBeenCalledWith(caseId, mockUser.token.clientId);
    });
  });

  describe('getTaskById', () => {
    const taskId = 'task-123';

    it('should get task by ID', async () => {
      mockTaskService.getTaskById = jest.fn().mockResolvedValue(mockTask);
      const result = await controller.getTaskById(taskId);
      expect(result).toEqual(mockTask);
      expect(mockTaskService.getTaskById).toHaveBeenCalledWith(taskId);
    });
  });
});
