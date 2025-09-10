import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { TaskController } from '../../src/task/task.controller';
import { TaskService } from '../../src/task/task.service';
import { CreateTaskDto } from '../../src/task/dto/create-task.dto';
import { UpdateTaskDto } from '../../src/task/dto/update-task.dto';
import { TaskStatus } from '@prisma/client';
import { AuthenticatedRequest } from '../../src/auth/auth.types';

describe('TaskController', () => {
  let controller: TaskController;

  const mockTaskService = {
    createTask: jest.fn(),
    reassignTask: jest.fn(),
    updateTask: jest.fn(),
  };

  const mockUser = {
    token: {
      clientId: 'user-123',
      sub: 'user-123',
      iat: 1234567890,
      exp: 1234567890,
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
    status: TaskStatus.ASSIGNED_10,
    name: 'Test Task',
    description: 'Test task description',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [TaskController],
      providers: [
        {
          provide: TaskService,
          useValue: mockTaskService,
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
      status: TaskStatus.UNASSIGNED_01,
      name: 'New Task',
      description: 'New task description',
    };

    it('should create a task successfully', async () => {
      mockTaskService.createTask.mockResolvedValue(mockTask);

      const result = await controller.createTask(createTaskDto, mockRequest);

      expect(result).toEqual(mockTask);
      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        createTaskDto,
        mockUser.token.clientId,
      );
      expect(mockTaskService.createTask).toHaveBeenCalledTimes(1);
    });

    it('should handle service errors during task creation', async () => {
      const error = new BadRequestException('Invalid case ID');
      mockTaskService.createTask.mockRejectedValue(error);

      await expect(
        controller.createTask(createTaskDto, mockRequest),
      ).rejects.toThrow(BadRequestException);

      expect(mockTaskService.createTask).toHaveBeenCalledWith(
        createTaskDto,
        mockUser.token.clientId,
      );
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

      const result = await controller.reassignTask(
        taskId,
        newAssigneeId,
        mockRequest,
      );

      expect(result).toEqual(reassignedTask);
      expect(mockTaskService.reassignTask).toHaveBeenCalledWith(
        taskId,
        mockUser.token.clientId,
        newAssigneeId,
      );
      expect(mockTaskService.reassignTask).toHaveBeenCalledTimes(1);
    });

    it('should handle task not found error', async () => {
      const error = new NotFoundException('Task not found');
      mockTaskService.reassignTask.mockRejectedValue(error);

      await expect(
        controller.reassignTask(taskId, newAssigneeId, mockRequest),
      ).rejects.toThrow(NotFoundException);

      expect(mockTaskService.reassignTask).toHaveBeenCalledWith(
        taskId,
        mockUser.token.clientId,
        newAssigneeId,
      );
    });

    it('should handle invalid assignee error', async () => {
      const error = new BadRequestException('Invalid assignee ID');
      mockTaskService.reassignTask.mockRejectedValue(error);

      await expect(
        controller.reassignTask(taskId, 'invalid-id', mockRequest),
      ).rejects.toThrow(BadRequestException);

      expect(mockTaskService.reassignTask).toHaveBeenCalledWith(
        taskId,
        mockUser.token.clientId,
        'invalid-id',
      );
    });

    it('should pass correct parameters to service', async () => {
      const reassignedTask = { ...mockTask, assignedUserId: newAssigneeId };
      mockTaskService.reassignTask.mockResolvedValue(reassignedTask);

      await controller.reassignTask(taskId, newAssigneeId, mockRequest);

      expect(mockTaskService.reassignTask).toHaveBeenCalledWith(
        taskId,
        mockUser.token.clientId,
        newAssigneeId,
      );
    });
  });

  describe('updateTask', () => {
    const taskId = 'task-123';
    const updateTaskDto: UpdateTaskDto = {
      status: TaskStatus.IN_PROGRESS_20,
      name: 'Updated Task Name',
      description: 'Updated task description',
    };

    it('should update a task successfully', async () => {
      const updatedTask = { ...mockTask, ...updateTaskDto };
      mockTaskService.updateTask.mockResolvedValue(updatedTask);

      const result = await controller.updateTask(
        taskId,
        updateTaskDto,
        mockRequest,
      );

      expect(result).toEqual(updatedTask);
      expect(mockTaskService.updateTask).toHaveBeenCalledWith(
        taskId,
        updateTaskDto,
        mockUser.token.clientId,
      );
      expect(mockTaskService.updateTask).toHaveBeenCalledTimes(1);
    });

    it('should handle task not found error during update', async () => {
      const error = new NotFoundException('Task not found');
      mockTaskService.updateTask.mockRejectedValue(error);

      await expect(
        controller.updateTask(taskId, updateTaskDto, mockRequest),
      ).rejects.toThrow(NotFoundException);

      expect(mockTaskService.updateTask).toHaveBeenCalledWith(
        taskId,
        updateTaskDto,
        mockUser.token.clientId,
      );
    });

    it('should handle validation errors during update', async () => {
      const error = new BadRequestException('Invalid task status');
      mockTaskService.updateTask.mockRejectedValue(error);

      await expect(
        controller.updateTask(taskId, updateTaskDto, mockRequest),
      ).rejects.toThrow(BadRequestException);

      expect(mockTaskService.updateTask).toHaveBeenCalledWith(
        taskId,
        updateTaskDto,
        mockUser.token.clientId,
      );
    });

    it('should update with partial data', async () => {
      const partialUpdate: UpdateTaskDto = {
        status: TaskStatus.COMPLETED_30,
      };
      const updatedTask = { ...mockTask, status: TaskStatus.COMPLETED_30 };
      mockTaskService.updateTask.mockResolvedValue(updatedTask);

      const result = await controller.updateTask(
        taskId,
        partialUpdate,
        mockRequest,
      );

      expect(result).toEqual(updatedTask);
      expect(mockTaskService.updateTask).toHaveBeenCalledWith(
        taskId,
        partialUpdate,
        mockUser.token.clientId,
      );
    });

    it('should handle empty update object', async () => {
      const emptyUpdate: UpdateTaskDto = {};
      mockTaskService.updateTask.mockResolvedValue(mockTask);

      const result = await controller.updateTask(
        taskId,
        emptyUpdate,
        mockRequest,
      );

      expect(result).toEqual(mockTask);
      expect(mockTaskService.updateTask).toHaveBeenCalledWith(
        taskId,
        emptyUpdate,
        mockUser.token.clientId,
      );
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
});