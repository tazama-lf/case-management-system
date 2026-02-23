import { Test, TestingModule } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { FlowableTaskService } from '../src/modules/flowable/services/flowable-task.service';
import { FlowableUtilitiesService } from '../src/modules/flowable/services/flowable-utilities.service';
import { FlowableClientFactory } from '../src/modules/flowable/services/flowable-client.factory';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AxiosInstance } from 'axios';

describe('FlowableTaskService', () => {
  let service: FlowableTaskService;
  let logger: jest.Mocked<LoggerService>;
  let utilityService: jest.Mocked<FlowableUtilitiesService>;
  let clientFactory: jest.Mocked<FlowableClientFactory>;
  let flowableClient: jest.Mocked<AxiosInstance>;

  beforeEach(async () => {
    // Mock AxiosInstance
    flowableClient = {
      get: jest.fn(),
      post: jest.fn(),
      put: jest.fn(),
      delete: jest.fn(),
    } as any;

    // Mock dependencies
    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockUtilityService = {
      getTaskVariables: jest.fn(),
    };

    const mockClientFactory = {
      getClient: jest.fn().mockReturnValue(flowableClient),
      getBaseUrl: jest.fn().mockReturnValue('http://test-flowable:8080'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FlowableTaskService,
        { provide: LoggerService, useValue: mockLogger },
        { provide: FlowableUtilitiesService, useValue: mockUtilityService },
        { provide: FlowableClientFactory, useValue: mockClientFactory },
      ],
    }).compile();

    service = module.get<FlowableTaskService>(FlowableTaskService);
    logger = module.get(LoggerService) as jest.Mocked<LoggerService>;
    utilityService = module.get(FlowableUtilitiesService) as jest.Mocked<FlowableUtilitiesService>;
    clientFactory = module.get(FlowableClientFactory) as jest.Mocked<FlowableClientFactory>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('createTask', () => {
    it('should create a task successfully', async () => {
      const taskData = {
        name: 'Test Task',
        description: 'Test Description',
        assignee: 'user-123',
      };

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
      expect(flowableClient.post).toHaveBeenCalledWith(
        '/service/runtime/tasks',
        {
          name: taskData.name,
          description: taskData.description,
          assignee: taskData.assignee,
        }
      );
      expect(logger.log).toHaveBeenCalledWith('Task created: task-123', 'FlowableTaskService');
    });

    it('should create a task with variables', async () => {
      const taskData = {
        name: 'Test Task',
        description: 'Test Description',
        assignee: 'user-123',
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

      const result = await service.createTask(taskData);

      expect(result).toEqual(mockResponse.data);
      expect(flowableClient.post).toHaveBeenCalledWith(
        '/service/runtime/tasks',
        expect.objectContaining({
          name: taskData.name,
          variables: expect.arrayContaining([
            { name: 'postgres_task_id', value: 'pg-123', type: 'string' },
            { name: 'task_status', value: 'OPEN', type: 'string' },
          ]),
        })
      );
    });

    it('should throw HttpException when task creation fails', async () => {
      const taskData = {
        name: 'Test Task',
        description: 'Test Description',
        assignee: 'user-123',
      };

      flowableClient.post.mockRejectedValue(new Error('Network error'));

      await expect(service.createTask(taskData)).rejects.toThrow(HttpException);
      await expect(service.createTask(taskData)).rejects.toThrow('Failed to create task');
      expect(logger.error).toHaveBeenCalled();
    });
  });

  describe('getTask', () => {
    it('should get a task by ID successfully', async () => {
      const taskId = 123;
      const mockResponse = {
        data: {
          id: taskId,
          name: 'Test Task',
          assignee: 'user-123',
        },
      };

      flowableClient.get.mockResolvedValue(mockResponse);

      const result = await service.getTask(taskId);

      expect(result).toEqual(mockResponse.data);
      expect(flowableClient.get).toHaveBeenCalledWith(`/service/runtime/tasks/${taskId}`);
    });

    it('should return null when task is not found', async () => {
      const taskId = 999;
      const error: any = new Error('Not found');
      error.response = { status: 404 };

      flowableClient.get.mockRejectedValue(error);

      const result = await service.getTask(taskId);

      expect(result).toBeNull();
    });

    it('should throw HttpException for other errors', async () => {
      const taskId = 123;
      flowableClient.get.mockRejectedValue(new Error('Server error'));

      await expect(service.getTask(taskId)).rejects.toThrow(HttpException);
      await expect(service.getTask(taskId)).rejects.toThrow('Failed to get task');
    });
  });

  describe('getProcessTasks', () => {
    it('should get all tasks for a process instance', async () => {
      const processInstanceId = 'process-123';
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
        data: [
          { name: 'var3', value: 'value3' },
        ],
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
      expect(logger.log).toHaveBeenCalledWith(
        `Retrieved 2 tasks with variables for process ${processInstanceId}`,
        'FlowableTaskService'
      );
    });

    it('should handle tasks without variables gracefully', async () => {
      const processInstanceId = 'process-456';
      const mockTasksResponse = {
        data: {
          data: [
            { id: 'task-1', name: 'Task 1' },
          ],
        },
      };

      flowableClient.get
        .mockResolvedValueOnce(mockTasksResponse)
        .mockRejectedValueOnce(new Error('Variables not found'));

      const result = await service.getProcessTasks(processInstanceId);

      expect(result).toHaveLength(1);
      expect(result[0].variables).toEqual([]);
      expect(result[0].variablesMap).toEqual({});
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should throw HttpException when getting process tasks fails', async () => {
      const processInstanceId = 'process-789';
      flowableClient.get.mockRejectedValue(new Error('Network error'));

      await expect(service.getProcessTasks(processInstanceId)).rejects.toThrow(HttpException);
      await expect(service.getProcessTasks(processInstanceId)).rejects.toThrow('Failed to get process tasks');
    });
  });

  describe('completeTask', () => {
    it('should complete a task without variables', async () => {
      const taskId = 123;
      const mockResponse = { data: { success: true } };

      flowableClient.post.mockResolvedValue(mockResponse);

      const result = await service.completeTask(taskId);

      expect(result).toEqual(mockResponse.data);
      expect(flowableClient.post).toHaveBeenCalledWith(
        `/service/runtime/tasks/${taskId}`,
        {
          action: 'complete',
          variables: [],
        }
      );
      expect(logger.log).toHaveBeenCalledWith(`Task completed: ${taskId}`, 'FlowableTaskService');
    });

    it('should complete a task with variables', async () => {
      const taskId = 456;
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
        })
      );
    });

    it('should throw HttpException when completing task fails', async () => {
      const taskId = 789;
      flowableClient.post.mockRejectedValue(new Error('Network error'));

      await expect(service.completeTask(taskId)).rejects.toThrow(HttpException);
      await expect(service.completeTask(taskId)).rejects.toThrow('Failed to complete task');
    });
  });

  describe('claimTask', () => {
    it('should claim a task for a user', async () => {
      const taskId = 123;
      const userId = 'user-456';

      flowableClient.post.mockResolvedValue({ data: {} });

      await service.claimTask(taskId, userId);

      expect(flowableClient.post).toHaveBeenCalledWith(
        `/service/runtime/tasks/${taskId}`,
        {
          action: 'claim',
          assignee: userId,
        }
      );
      expect(logger.log).toHaveBeenCalledWith(`Task ${taskId} claimed by user ${userId}`, 'FlowableTaskService');
    });

    it('should throw HttpException when claiming task fails', async () => {
      const taskId = 123;
      const userId = 'user-456';
      flowableClient.post.mockRejectedValue(new Error('Network error'));

      await expect(service.claimTask(taskId, userId)).rejects.toThrow(HttpException);
      await expect(service.claimTask(taskId, userId)).rejects.toThrow('Failed to claim task');
    });
  });

  describe('unclaimTask', () => {
    it('should unclaim a task', async () => {
      const taskId = 123;

      flowableClient.post.mockResolvedValue({ data: {} });

      await service.unclaimTask(taskId);

      expect(flowableClient.post).toHaveBeenCalledWith(
        `/service/runtime/tasks/${taskId}`,
        {
          action: 'claim',
          assignee: null,
        }
      );
      expect(logger.log).toHaveBeenCalledWith(`Task ${taskId} unclaimed`, 'FlowableTaskService');
    });

    it('should throw HttpException when unclaiming task fails', async () => {
      const taskId = 123;
      flowableClient.post.mockRejectedValue(new Error('Network error'));

      await expect(service.unclaimTask(taskId)).rejects.toThrow(HttpException);
      await expect(service.unclaimTask(taskId)).rejects.toThrow('Failed to unclaim task');
    });
  });

  describe('delegateTask', () => {
    it('should delegate a task to another user', async () => {
      const taskId = 123;
      const userId = 'user-789';

      flowableClient.post.mockResolvedValue({ data: {} });

      await service.delegateTask(taskId, userId);

      expect(flowableClient.post).toHaveBeenCalledWith(
        `/service/runtime/tasks/${taskId}`,
        {
          action: 'delegate',
          assignee: userId,
        }
      );
      expect(logger.log).toHaveBeenCalledWith(`Task ${taskId} delegated to user ${userId}`, 'FlowableTaskService');
    });

    it('should throw HttpException when delegating task fails', async () => {
      const taskId = 123;
      const userId = 'user-789';
      flowableClient.post.mockRejectedValue(new Error('Network error'));

      await expect(service.delegateTask(taskId, userId)).rejects.toThrow(HttpException);
      await expect(service.delegateTask(taskId, userId)).rejects.toThrow('Failed to delegate task');
    });
  });

  describe('assignTaskToCandidateGroup', () => {
    it('should assign a task to a candidate group', async () => {
      const taskId = 123;
      const group = 'Supervisors';
      const mockResponse = { data: { success: true } };

      flowableClient.post.mockResolvedValue(mockResponse);

      const result = await service.assignTaskToCandidateGroup(taskId, group);

      expect(result).toEqual(mockResponse.data);
      expect(flowableClient.post).toHaveBeenCalledWith(
        `/service/runtime/tasks/${taskId}/identitylinks`,
        {
          type: 'candidate',
          group: 'supervisors',
        }
      );
      expect(logger.log).toHaveBeenCalledWith(`Task ${taskId} assigned to candidate group ${group}`, 'FlowableTaskService');
    });

    it('should throw HttpException when assigning to candidate group fails', async () => {
      const taskId = 123;
      const group = 'Supervisors';
      flowableClient.post.mockRejectedValue(new Error('Network error'));

      await expect(service.assignTaskToCandidateGroup(taskId, group)).rejects.toThrow(HttpException);
      await expect(service.assignTaskToCandidateGroup(taskId, group)).rejects.toThrow('Failed to assign task to candidate group');
    });
  });

  describe('getTaskIdentityLinks', () => {
    it('should get task identity links', async () => {
      const taskId = 123;
      const mockResponse = {
        data: [
          { type: 'candidate', group: 'supervisors' },
          { type: 'assignee', userId: 'user-123' },
        ],
      };

      flowableClient.get.mockResolvedValue(mockResponse);

      const result = await service.getTaskIdentityLinks(taskId);

      expect(result).toEqual(mockResponse.data);
      expect(flowableClient.get).toHaveBeenCalledWith(`/service/runtime/tasks/${taskId}/identitylinks`);
    });

    it('should throw HttpException when getting identity links fails', async () => {
      const taskId = 123;
      flowableClient.get.mockRejectedValue(new Error('Network error'));

      await expect(service.getTaskIdentityLinks(taskId)).rejects.toThrow(HttpException);
      await expect(service.getTaskIdentityLinks(taskId)).rejects.toThrow('Failed to get task identity links');
    });
  });

  describe('getCandidateGroupTasks', () => {
    it('should get tasks for a candidate group with variables', async () => {
      const candidateGroup = 'Supervisors';
      const mockTasksResponse = {
        data: {
          data: [
            { id: 'task-1', name: 'Task 1' },
            { id: 'task-2', name: 'Task 2' },
          ],
        },
      };

      flowableClient.get.mockResolvedValue(mockTasksResponse);
      utilityService.getTaskVariables
        .mockResolvedValueOnce({ var1: 'value1' })
        .mockResolvedValueOnce({ var2: 'value2' });

      const result = await service.getCandidateGroupTasks(candidateGroup);

      expect(result).toHaveLength(2);
      expect(result[0].variables).toEqual({ var1: 'value1' });
      expect(result[1].variables).toEqual({ var2: 'value2' });
      expect(flowableClient.get).toHaveBeenCalledWith(
        '/service/runtime/tasks',
        {
          params: {
            candidateGroup: 'supervisors',
            includeTaskLocalVariables: true,
            includeProcessVariables: true,
          },
        }
      );
    });

    it('should get tasks without variables when includeVariables is false', async () => {
      const candidateGroup = 'Investigations';
      const mockTasksResponse = {
        data: {
          data: [
            { id: 'task-1', name: 'Task 1' },
          ],
        },
      };

      flowableClient.get.mockResolvedValue(mockTasksResponse);

      const result = await service.getCandidateGroupTasks(candidateGroup, false);

      expect(result).toHaveLength(1);
      expect(utilityService.getTaskVariables).not.toHaveBeenCalled();
    });

    it('should handle variable fetch failure gracefully', async () => {
      const candidateGroup = 'Supervisors';
      const mockTasksResponse = {
        data: {
          data: [
            { id: 'task-1', name: 'Task 1' },
          ],
        },
      };

      flowableClient.get.mockResolvedValue(mockTasksResponse);
      utilityService.getTaskVariables.mockRejectedValue(new Error('Variables error'));

      const result = await service.getCandidateGroupTasks(candidateGroup);

      expect(result).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalledWith('Failed to get variables for task task-1', 'FlowableTaskService');
    });

    it('should throw HttpException when getting candidate tasks fails', async () => {
      const candidateGroup = 'Supervisors';
      flowableClient.get.mockRejectedValue(new Error('Network error'));

      await expect(service.getCandidateGroupTasks(candidateGroup)).rejects.toThrow(HttpException);
      await expect(service.getCandidateGroupTasks(candidateGroup)).rejects.toThrow('Failed to get candidate tasks');
    });
  });

  describe('getUserTasks', () => {
    it('should get tasks for a user with variables', async () => {
      const assignee = 'user-123';
      const mockTasksResponse = {
        data: {
          data: [
            { id: 'task-1', name: 'Task 1' },
            { id: 'task-2', name: 'Task 2' },
          ],
        },
      };

      flowableClient.get.mockResolvedValue(mockTasksResponse);
      utilityService.getTaskVariables
        .mockResolvedValueOnce({ var1: 'value1' })
        .mockResolvedValueOnce({ var2: 'value2' });

      const result = await service.getUserTasks(assignee);

      expect(result).toHaveLength(2);
      expect(result[0].variables).toEqual({ var1: 'value1' });
      expect(flowableClient.get).toHaveBeenCalledWith(
        '/service/runtime/tasks',
        {
          params: {
            assignee,
            includeTaskLocalVariables: true,
            includeProcessVariables: true,
          },
        }
      );
    });

    it('should get tasks without variables when includeVariables is false', async () => {
      const assignee = 'user-456';
      const mockTasksResponse = {
        data: {
          data: [
            { id: 'task-1', name: 'Task 1' },
          ],
        },
      };

      flowableClient.get.mockResolvedValue(mockTasksResponse);

      const result = await service.getUserTasks(assignee, false);

      expect(result).toHaveLength(1);
      expect(utilityService.getTaskVariables).not.toHaveBeenCalled();
    });

    it('should handle variable fetch failure gracefully', async () => {
      const assignee = 'user-789';
      const mockTasksResponse = {
        data: {
          data: [
            { id: 'task-1', name: 'Task 1' },
          ],
        },
      };

      flowableClient.get.mockResolvedValue(mockTasksResponse);
      utilityService.getTaskVariables.mockRejectedValue(new Error('Variables error'));

      const result = await service.getUserTasks(assignee);

      expect(result).toHaveLength(1);
      expect(logger.warn).toHaveBeenCalled();
    });

    it('should throw HttpException when getting user tasks fails', async () => {
      const assignee = 'user-123';
      flowableClient.get.mockRejectedValue(new Error('Network error'));

      await expect(service.getUserTasks(assignee)).rejects.toThrow(HttpException);
      await expect(service.getUserTasks(assignee)).rejects.toThrow('Failed to get user tasks');
    });
  });

  describe('setTaskVariables', () => {
    it('should set multiple task variables', async () => {
      const taskId = 123;
      const variables = {
        postgres_task_id: 'pg-123',
        task_status: 'IN_PROGRESS',
      };
      const mockResponse = { data: { success: true } };

      flowableClient.post.mockResolvedValue(mockResponse);

      const result = await service.setTaskVariables(taskId, variables);

      expect(result).toEqual(mockResponse.data);
      expect(flowableClient.post).toHaveBeenCalledWith(
        `/service/runtime/tasks/${taskId}/variables`,
        expect.arrayContaining([
          { name: 'postgres_task_id', value: 'pg-123', type: 'string' },
          { name: 'task_status', value: 'IN_PROGRESS', type: 'string' },
        ])
      );
      expect(logger.log).toHaveBeenCalledWith(
        `Variables set successfully for task ${taskId}: ${JSON.stringify(variables)}`,
        'FlowableTaskService'
      );
    });

    it('should log error response details when setting variables fails', async () => {
      const taskId = 123;
      const variables = { test: 'value' };
      const error: any = new Error('API error');
      error.response = {
        data: { error: 'Bad request' },
        status: 400,
      };

      flowableClient.post.mockRejectedValue(error);

      await expect(service.setTaskVariables(taskId, variables)).rejects.toThrow(HttpException);
      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('Flowable API error response'),
        'FlowableTaskService'
      );
      expect(logger.error).toHaveBeenCalledWith(
        'Status code: 400',
        'FlowableTaskService'
      );
    });

    it('should throw HttpException when no error response', async () => {
      const taskId = 123;
      const variables = { test: 'value' };
      flowableClient.post.mockRejectedValue(new Error('Network error'));

      await expect(service.setTaskVariables(taskId, variables)).rejects.toThrow(HttpException);
      await expect(service.setTaskVariables(taskId, variables)).rejects.toThrow('Failed to set task variables');
    });
  });

  describe('updateTaskVariable', () => {
    it('should update a single task variable', async () => {
      const taskId = 123;
      const variableName = 'task_status';
      const value = 'COMPLETED';
      const mockResponse = { data: { success: true } };

      flowableClient.put.mockResolvedValue(mockResponse);

      const result = await service.updateTaskVariable(taskId, variableName, value);

      expect(result).toEqual(mockResponse.data);
      expect(flowableClient.put).toHaveBeenCalledWith(
        `/service/runtime/tasks/${taskId}/variables/${variableName}`,
        {
          name: variableName,
          value,
          type: 'string',
        }
      );
      expect(logger.log).toHaveBeenCalledWith(`Variable ${variableName} updated for task ${taskId}`, 'FlowableTaskService');
    });

    it('should throw HttpException when updating variable fails', async () => {
      const taskId = 123;
      const variableName = 'task_status';
      const value = 'COMPLETED';
      flowableClient.put.mockRejectedValue(new Error('Network error'));

      await expect(service.updateTaskVariable(taskId, variableName, value)).rejects.toThrow(HttpException);
      await expect(service.updateTaskVariable(taskId, variableName, value)).rejects.toThrow('Failed to update task variable');
    });
  });

  describe('deleteTaskVariable', () => {
    it('should delete a task variable', async () => {
      const taskId = 123;
      const variableName = 'old_variable';

      flowableClient.delete.mockResolvedValue({ data: {} });

      await service.deleteTaskVariable(taskId, variableName);

      expect(flowableClient.delete).toHaveBeenCalledWith(
        `/service/runtime/tasks/${taskId}/variables/${variableName}`
      );
      expect(logger.log).toHaveBeenCalledWith(`Variable ${variableName} deleted from task ${taskId}`, 'FlowableTaskService');
    });

    it('should throw HttpException when deleting variable fails', async () => {
      const taskId = 123;
      const variableName = 'old_variable';
      flowableClient.delete.mockRejectedValue(new Error('Network error'));

      await expect(service.deleteTaskVariable(taskId, variableName)).rejects.toThrow(HttpException);
      await expect(service.deleteTaskVariable(taskId, variableName)).rejects.toThrow('Failed to delete task variable');
    });
  });

  describe('formatVariables', () => {
    it('should format string variables correctly', async () => {
      const taskData = {
        name: 'Test Task',
        description: 'Test Description',
        assignee: 'user-123',
        variables: {
          var1: 'value1',
          var2: 'value2',
        },
      };

      const mockResponse = { data: { id: 'task-123' } };
      flowableClient.post.mockResolvedValue(mockResponse);

      await service.createTask(taskData);

      expect(flowableClient.post).toHaveBeenCalledWith(
        '/service/runtime/tasks',
        expect.objectContaining({
          variables: expect.arrayContaining([
            { name: 'var1', value: 'value1', type: 'string' },
            { name: 'var2', value: 'value2', type: 'string' },
          ]),
        })
      );
    });

    it('should throw error for undefined variable values', async () => {
      const taskData = {
        name: 'Test Task',
        description: 'Test Description',
        assignee: 'user-123',
        variables: {
          valid: 'value',
          invalid: undefined as any,
        },
      };

      flowableClient.post.mockImplementation(() => {
        throw new Error('Variable "invalid" has undefined value. All variables must have string values.');
      });

      await expect(service.createTask(taskData)).rejects.toThrow();
    });

    it('should format boolean variables correctly', async () => {
      const taskId = 123;
      const variables: any = {
        completed: true,
        approved: false,
      };

      const mockResponse = { data: { success: true } };
      flowableClient.post.mockResolvedValue(mockResponse);

      await service.completeTask(taskId, variables);

      expect(flowableClient.post).toHaveBeenCalledWith(
        `/service/runtime/tasks/${taskId}`,
        expect.objectContaining({
          variables: expect.arrayContaining([
            { name: 'completed', value: true, type: 'boolean' },
            { name: 'approved', value: false, type: 'boolean' },
          ]),
        })
      );
    });
  });
});
