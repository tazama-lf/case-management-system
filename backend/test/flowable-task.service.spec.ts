import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { FlowableTaskService } from '../src/modules/flowable/services/flowable-task.service';
import { FlowableClientFactory } from '../src/modules/flowable/services/flowable-client.factory';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AxiosInstance } from 'axios';

describe('FlowableTaskService', () => {
  let service: FlowableTaskService;
  let logger: jest.Mocked<LoggerService>;
  let clientFactory: jest.Mocked<FlowableClientFactory>;
  let flowableClient: jest.Mocked<AxiosInstance>;

  beforeEach(async () => {
    flowableClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowableTaskService,
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
          },
        },
        {
          provide: FlowableClientFactory,
          useValue: {
            getClient: jest.fn().mockReturnValue(flowableClient),
            getBaseUrl: jest.fn().mockReturnValue('http://test-flowable:8080'),
          },
        },
      ],
    }).compile();

    service = module.get<FlowableTaskService>(FlowableTaskService);
    logger = module.get(LoggerService) as jest.Mocked<LoggerService>;
    clientFactory = module.get(FlowableClientFactory) as jest.Mocked<FlowableClientFactory>;

    jest.clearAllMocks();
  });

  describe('createTask', () => {
    const taskData = {
      name: 'Test Task',
      description: 'Test Description',
      assignee: 'user-123',
    };

    it('should create a task successfully without variables', async () => {
      const mockResponse = {
        data: {
          id: 'task-123',
          name: 'Test Task',
          description: 'Test Description',
          assignee: 'user-123',
        },
      };

      flowableClient.post.mockResolvedValue(mockResponse);

      const result = await service.createTask(taskData);

      expect(result).toEqual(mockResponse.data);
      expect(flowableClient.post).toHaveBeenCalledWith('/service/runtime/tasks', {
        name: taskData.name,
        description: taskData.description,
        assignee: taskData.assignee,
      });
      expect(logger.log).toHaveBeenCalledWith('Task created: task-123', 'FlowableTaskService');
    });

    it('should create a task with variables', async () => {
      const taskDataWithVars = {
        ...taskData,
        variables: {
          postgres_task_id: 'pg-123',
          task_status: 'OPEN',
        },
      };

      const mockResponse = {
        data: {
          id: 'task-456',
          name: 'Test Task',
        },
      };

      flowableClient.post.mockResolvedValue(mockResponse);

      const result = await service.createTask(taskDataWithVars);

      expect(result).toEqual(mockResponse.data);
      expect(flowableClient.post).toHaveBeenCalledWith(
        '/service/runtime/tasks',
        expect.objectContaining({
          name: taskDataWithVars.name,
          variables: expect.arrayContaining([
            { name: 'postgres_task_id', value: 'pg-123', type: 'string' },
            { name: 'task_status', value: 'OPEN', type: 'string' },
          ]),
        }),
      );
    });

    it('should throw HttpException when task creation fails', async () => {
      flowableClient.post.mockRejectedValue(new Error('Network error'));

      await expect(service.createTask(taskData)).rejects.toThrow(HttpException);
      await expect(service.createTask(taskData)).rejects.toThrow('Failed to create task');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create task'),
        expect.any(String),
        'FlowableTaskService',
      );
    });

    it('should handle non-Error exceptions when task creation fails', async () => {
      flowableClient.post.mockRejectedValue('String error');

      await expect(service.createTask(taskData)).rejects.toThrow(HttpException);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to create task: String error'),
        undefined,
        'FlowableTaskService',
      );
    });
  });

  describe('getProcessTasks', () => {
    const processInstanceId = 'process-123';

    it('should get all tasks for a process instance with variables', async () => {
      const mockTasksResponse = {
        data: {
          data: [
            { id: 'task-1', name: 'Task 1' },
            { id: 'task-2', name: 'Task 2' },
          ],
        },
      };

      const mockVariablesResponse1 = {
        data: [
          { name: 'var1', value: 'value1' },
          { name: 'var2', value: 'value2' },
        ],
      };

      const mockVariablesResponse2 = {
        data: [{ name: 'var3', value: 'value3' }],
      };

      flowableClient.get
        .mockResolvedValueOnce(mockTasksResponse)
        .mockResolvedValueOnce(mockVariablesResponse1)
        .mockResolvedValueOnce(mockVariablesResponse2);

      const result = await service.getProcessTasks(processInstanceId);

      expect(result).toHaveLength(2);
      expect(result[0]).toHaveProperty('variables');
      expect(result[0]).toHaveProperty('variablesMap');
      expect(result[0].variablesMap).toEqual({ var1: 'value1', var2: 'value2' });
      expect(result[1].variablesMap).toEqual({ var3: 'value3' });
      expect(logger.log).toHaveBeenCalledWith(`Retrieved 2 tasks with variables for process ${processInstanceId}`, 'FlowableTaskService');
    });

    it('should handle tasks without variables gracefully', async () => {
      const mockTasksResponse = {
        data: {
          data: [{ id: 'task-1', name: 'Task 1' }],
        },
      };

      flowableClient.get.mockResolvedValueOnce(mockTasksResponse).mockRejectedValueOnce(new Error('Variables not found'));

      const result = await service.getProcessTasks(processInstanceId);

      expect(result).toHaveLength(1);
      expect(result[0].variables).toEqual([]);
      expect(result[0].variablesMap).toEqual({});
      expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to fetch variables for task task-1'), 'FlowableTaskService');
    });

    it('should handle non-Error exceptions when fetching variables', async () => {
      const mockTasksResponse = {
        data: {
          data: [{ id: 'task-1', name: 'Task 1' }],
        },
      };

      flowableClient.get.mockResolvedValueOnce(mockTasksResponse).mockRejectedValueOnce('String error');

      const result = await service.getProcessTasks(processInstanceId);

      expect(result).toHaveLength(1);
      expect(result[0].variables).toEqual([]);
      expect(logger.warn).toHaveBeenCalledWith('Failed to fetch variables for task task-1: String error', 'FlowableTaskService');
    });

    it('should throw HttpException when getting process tasks fails', async () => {
      flowableClient.get.mockRejectedValue(new Error('Network error'));

      await expect(service.getProcessTasks(processInstanceId)).rejects.toThrow(HttpException);
      await expect(service.getProcessTasks(processInstanceId)).rejects.toThrow('Failed to get process tasks');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get process tasks'),
        expect.any(String),
        'FlowableTaskService',
      );
    });

    it('should handle non-Error exceptions when getting process tasks fails', async () => {
      flowableClient.get.mockRejectedValue('String error');

      await expect(service.getProcessTasks(processInstanceId)).rejects.toThrow(HttpException);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get process tasks: String error'),
        undefined,
        'FlowableTaskService',
      );
    });
  });

  describe('completeTask', () => {
    const taskId = 'task-123';

    it('should complete a task without variables', async () => {
      const mockResponse = { data: { success: true } };

      flowableClient.post.mockResolvedValue(mockResponse);

      const result = await service.completeTask(taskId);

      expect(result).toEqual(mockResponse.data);
      expect(flowableClient.post).toHaveBeenCalledWith(`/service/runtime/tasks/${taskId}`, {
        action: 'complete',
        variables: [],
      });
      expect(logger.log).toHaveBeenCalledWith(`Task completed: ${taskId}`, 'FlowableTaskService');
    });

    it('should complete a task with variables', async () => {
      const variables = {
        outcome: 'approved',
        notes: 'Looks good',
      };
      const mockResponse = { data: { success: true } };

      flowableClient.post.mockResolvedValue(mockResponse);

      const result = await service.completeTask(taskId, variables);

      expect(result).toEqual(mockResponse.data);
      expect(flowableClient.post).toHaveBeenCalledWith(
        `/service/runtime/tasks/${taskId}`,
        expect.objectContaining({
          action: 'complete',
          variables: expect.arrayContaining([
            { name: 'outcome', value: 'approved', type: 'string' },
            { name: 'notes', value: 'Looks good', type: 'string' },
          ]),
        }),
      );
    });

    it('should throw HttpException when completing task fails', async () => {
      flowableClient.post.mockRejectedValue(new Error('Network error'));

      await expect(service.completeTask(taskId)).rejects.toThrow(HttpException);
      await expect(service.completeTask(taskId)).rejects.toThrow('Failed to complete task');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to complete task'),
        expect.any(String),
        'FlowableTaskService',
      );
    });
  });

  describe('claimTask', () => {
    const taskId = 'task-123';
    const userId = 'user-456';

    it('should claim a task for a user', async () => {
      flowableClient.post.mockResolvedValue({ data: {} });

      await service.claimTask(taskId, userId);

      expect(flowableClient.post).toHaveBeenCalledWith(`/service/runtime/tasks/${taskId}`, {
        action: 'claim',
        assignee: userId,
      });
      expect(logger.log).toHaveBeenCalledWith(`Task ${taskId} claimed by user ${userId}`, 'FlowableTaskService');
    });

    it('should throw HttpException when claiming task fails', async () => {
      flowableClient.post.mockRejectedValue(new Error('Network error'));

      await expect(service.claimTask(taskId, userId)).rejects.toThrow(HttpException);
      await expect(service.claimTask(taskId, userId)).rejects.toThrow('Failed to claim task');
      expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('Failed to claim task'), expect.any(String), 'FlowableTaskService');
    });
  });

  describe('unclaimTask', () => {
    const taskId = 'task-123';

    it('should unclaim a task', async () => {
      flowableClient.post.mockResolvedValue({ data: {} });

      await service.unclaimTask(taskId);

      expect(flowableClient.post).toHaveBeenCalledWith(`/service/runtime/tasks/${taskId}`, {
        action: 'claim',
        assignee: null,
      });
      expect(logger.log).toHaveBeenCalledWith(`Task ${taskId} unclaimed`, 'FlowableTaskService');
    });

    it('should throw HttpException when unclaiming task fails', async () => {
      flowableClient.post.mockRejectedValue(new Error('Network error'));

      await expect(service.unclaimTask(taskId)).rejects.toThrow(HttpException);
      await expect(service.unclaimTask(taskId)).rejects.toThrow('Failed to unclaim task');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to unclaim task'),
        expect.any(String),
        'FlowableTaskService',
      );
    });
  });

  describe('updateTaskVariable', () => {
    const taskId = 123;
    const variableName = 'task_status';
    const value = 'COMPLETED';

    it('should update a single task variable', async () => {
      const mockResponse = { data: { success: true } };

      flowableClient.put.mockResolvedValue(mockResponse);

      const result = await service.updateTaskVariable(taskId, variableName, value);

      expect(result).toEqual(mockResponse.data);
      expect(flowableClient.put).toHaveBeenCalledWith(`/service/runtime/tasks/${taskId}/variables/${variableName}`, {
        name: variableName,
        value,
        type: 'string',
      });
      expect(logger.log).toHaveBeenCalledWith(`Variable ${variableName} updated for task ${taskId}`, 'FlowableTaskService');
    });

    it('should throw HttpException when updating variable fails', async () => {
      flowableClient.put.mockRejectedValue(new Error('Network error'));

      await expect(service.updateTaskVariable(taskId, variableName, value)).rejects.toThrow(HttpException);
      await expect(service.updateTaskVariable(taskId, variableName, value)).rejects.toThrow('Failed to update task variable');
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to update task variable'),
        expect.any(String),
        'FlowableTaskService',
      );
    });
  });
});
