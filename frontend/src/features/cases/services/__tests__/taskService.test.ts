import { describe, it, expect, vi, beforeEach } from 'vitest';
import { taskService, TaskStatus } from '../taskService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

describe('taskService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getTasksByCaseId', () => {
    it('gets tasks by case ID', async () => {
      const mockTasks = [
        {
          task_id: 'TASK-1',
          case_id: 'CASE-123',
          name: 'Review Transaction',
          status: 'STATUS_20_IN_PROGRESS',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockTasks);

      const result = await taskService.getTasksByCaseId('CASE-123');

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/task/case/CASE-123');
      expect(result).toEqual(mockTasks);
    });

    it('returns empty array when response is not an array', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue(null);

      const result = await taskService.getTasksByCaseId('CASE-123');

      expect(result).toEqual([]);
    });

    it('handles errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('Failed to fetch');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(taskService.getTasksByCaseId('CASE-123')).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getInvestigationTaskForCase', () => {
    it('gets investigation task for case', async () => {
      const mockTasks = [
        {
          task_id: 'TASK-1',
          case_id: 'CASE-123',
          name: 'Investigation task',
          status: 'STATUS_20_IN_PROGRESS',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
        {
          task_id: 'TASK-2',
          case_id: 'CASE-123',
          name: 'Review Document',
          status: 'STATUS_10_ASSIGNED',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      // Mock getTasksByCaseId which is called internally - need to mock for the specific URL
      (apiClient.get as vi.Mock).mockImplementation((url: string) => {
        if (url.includes('/case/CASE-123')) {
          return Promise.resolve(mockTasks);
        }
        return Promise.resolve([]);
      });

      const result = await taskService.getInvestigationTaskForCase('CASE-123');

      expect(result).toBeDefined();
      expect(result?.task_id).toBe('TASK-1');
    });

    it('returns null when no investigation task found', async () => {
      const mockTasks = [
        {
          task_id: 'TASK-1',
          case_id: 'CASE-123',
          name: 'Review Document',
          status: 'STATUS_20_IN_PROGRESS',
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockTasks);

      const result = await taskService.getInvestigationTaskForCase('CASE-123');

      expect(result).toBeNull();
    });
  });

  describe('assignTask', () => {
    it('assigns a task', async () => {
      const mockResponse = {
        success: true,
        message: 'Task assigned',
      };
      (apiClient.post as vi.Mock).mockResolvedValue(mockResponse);

      const result = await taskService.assignTask('TASK-1', {
        assignedUserId: 'user-1',
        assignmentNotes: 'Test notes',
      });

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/task/TASK-1/assign',
        {
          assignedUserId: 'user-1',
          assignmentNotes: 'Test notes',
        },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('unassignTask', () => {
    it('unassigns a task', async () => {
      const mockResponse = {
        success: true,
        message: 'Task unassigned',
      };
      (apiClient.patch as vi.Mock).mockResolvedValue(mockResponse);

      const result = await taskService.unassignTask('TASK-1', {
        reason: 'No longer needed',
      });

      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/task/TASK-1/unassign',
        { reason: 'No longer needed' },
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('updateTask', () => {
    it('updates a task', async () => {
      const mockTask = {
        id: 'TASK-1',
        name: 'Updated Task',
        status: 'STATUS_20_IN_PROGRESS',
      };
      (apiClient.patch as vi.Mock).mockResolvedValue(mockTask);

      const result = await taskService.updateTask('TASK-1', {
        name: 'Updated Task',
      });

      expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/task/TASK-1', {
        name: 'Updated Task',
      });
      expect(result).toEqual(mockTask);
    });

    it('validates task response', async () => {
      (apiClient.patch as vi.Mock).mockResolvedValue({ name: 'Task' });

      await expect(taskService.updateTask('TASK-1', {})).rejects.toThrow(
        'Task ID is missing',
      );
    });
  });

  describe('updateTaskForSupervisor', () => {
    it('updates task for supervisor', async () => {
      const mockTask = {
        task_id: 'TASK-1',
        status: 'STATUS_20_IN_PROGRESS',
        assigned_user_id: 'user-1',
      };
      (apiClient.patch as vi.Mock).mockResolvedValue(mockTask);

      const result = await taskService.updateTaskForSupervisor('TASK-1', {
        status: TaskStatus.STATUS_20_IN_PROGRESS,
      });

      expect(apiClient.patch).toHaveBeenCalled();
      expect(result).toEqual(mockTask);
    });
  });

  describe('createTask', () => {
    it('creates a task', async () => {
      const mockTask = {
        id: 'TASK-1',
        name: 'New Task',
        status: 'STATUS_01_UNASSIGNED',
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
      };
      (apiClient.post as vi.Mock).mockResolvedValue(mockTask);

      const result = await taskService.createTask({
        name: 'New Task',
        status: 'STATUS_01_UNASSIGNED',
      });

      expect(apiClient.post).toHaveBeenCalledWith('/api/v1/task', {
        name: 'New Task',
        status: 'STATUS_01_UNASSIGNED',
      });
      expect(result).toEqual(mockTask);
    });

    it('validates task response has id', async () => {
      (apiClient.post as vi.Mock).mockResolvedValue({ name: 'Task' });

      await expect(
        taskService.createTask({
          name: 'New Task',
          status: 'STATUS_01_UNASSIGNED',
        }),
      ).rejects.toThrow('Task ID is missing from response');
    });

    it('validates task response is an object', async () => {
      (apiClient.post as vi.Mock).mockResolvedValue(null);

      await expect(
        taskService.createTask({
          name: 'New Task',
          status: 'STATUS_01_UNASSIGNED',
        }),
      ).rejects.toThrow('Invalid task data received');
    });

    it('handles errors gracefully', async () => {
      const error = new Error('Failed to create task');
      (apiClient.post as vi.Mock).mockRejectedValue(error);

      await expect(
        taskService.createTask({
          name: 'New Task',
          status: 'STATUS_01_UNASSIGNED',
        }),
      ).rejects.toThrow();
    });
  });

  describe('completeTask', () => {
    it('completes a task', async () => {
      const mockResponse = { task_id: 1 };
      (apiClient.post as vi.Mock).mockResolvedValue(mockResponse);

      const result = await taskService.completeTask('TASK-1' as any);

      expect(apiClient.post).toHaveBeenCalledWith(
        '/api/v1/task/TASK-1/complete',
      );
      expect(result.success).toBe(true);
    });
  });

  describe('closeTask', () => {
    it('closes a task', async () => {
      const mockTask = {
        id: 'TASK-1',
        status: TaskStatus.STATUS_30_COMPLETED,
      };
      (apiClient.patch as vi.Mock).mockResolvedValue(mockTask);

      const result = await taskService.closeTask('TASK-1', {
        notes: 'Task completed',
      });

      expect(apiClient.patch).toHaveBeenCalled();
      expect(result.success).toBe(true);
    });
  });

  describe('startTask', () => {
    it('starts a task', async () => {
      const mockTask = {
        task_id: 'TASK-1',
        status: TaskStatus.STATUS_20_IN_PROGRESS,
      };
      (apiClient.patch as vi.Mock).mockResolvedValue(mockTask);

      const result = await taskService.startTask('TASK-1');

      expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/task/TASK-1', {
        status: TaskStatus.STATUS_20_IN_PROGRESS,
      });
      expect(result).toEqual(mockTask);
    });
  });

  describe('blockTask', () => {
    it('blocks a task', async () => {
      const mockTask = {
        task_id: 'TASK-1',
        status: TaskStatus.STATUS_21_BLOCKED,
      };
      (apiClient.patch as vi.Mock).mockResolvedValue(mockTask);

      const result = await taskService.blockTask('TASK-1');

      expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/task/TASK-1', {
        status: TaskStatus.STATUS_21_BLOCKED,
      });
      expect(result).toEqual(mockTask);
    });
  });

  describe('completeTaskForSupervisor', () => {
    it('completes task for supervisor', async () => {
      const mockTask = {
        task_id: 'TASK-1',
        status: TaskStatus.STATUS_30_COMPLETED,
      };
      (apiClient.patch as vi.Mock).mockResolvedValue(mockTask);

      const result = await taskService.completeTaskForSupervisor('TASK-1');

      expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/task/TASK-1', {
        status: TaskStatus.STATUS_30_COMPLETED,
      });
      expect(result).toEqual(mockTask);
    });
  });

  describe('error handling', () => {
    it('handles errors when task operation fails', async () => {
      const error = new Error('Failed to assign task');
      (apiClient.post as vi.Mock).mockRejectedValue(error);

      await expect(
        taskService.assignTask('TASK-1', { assignedUserId: 'user-1' }),
      ).rejects.toThrow();
    });

    it('handles API error responses with message', async () => {
      const apiError = {
        response: {
          data: {
            message: 'Custom error message',
          },
        },
      };
      (apiClient.get as vi.Mock).mockRejectedValue(apiError);

      await expect(taskService.getTasksByCaseId('CASE-123')).rejects.toThrow(
        'Custom error message',
      );
    });

    it('handles API error responses without message', async () => {
      const apiError = {
        response: {
          data: {},
        },
      };
      (apiClient.get as vi.Mock).mockRejectedValue(apiError);

      await expect(taskService.getTasksByCaseId('CASE-123')).rejects.toThrow(
        'Failed to get tasks by case ID',
      );
    });

    it('handles errors without response', async () => {
      const error = new Error('Network error');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(taskService.getTasksByCaseId('CASE-123')).rejects.toThrow(
        'Failed to get tasks by case ID: Network error',
      );
    });

    it('handles getInvestigationTaskForCase errors', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      const error = new Error('Failed to fetch');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(
        taskService.getInvestigationTaskForCase('CASE-123'),
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getTasks', () => {
    it('gets tasks with no filters', async () => {
      const mockResponse = {
        tasks: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      const result = await taskService.getTasks();

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/task'),
      );
      expect(result).toEqual(mockResponse);
    });

    it('gets tasks with filters', async () => {
      const mockResponse = {
        tasks: [],
        total: 0,
        page: 1,
        limit: 10,
        totalPages: 0,
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      await taskService.getTasks({
        status: 'STATUS_20_IN_PROGRESS',
        assignedUserId: 'user-1',
        caseId: 5,
        priority: 'HIGH',
        page: 2,
        limit: 25,
        sortBy: 'created_at',
        sortOrder: 'desc',
      });

      const calledUrl = (apiClient.get as vi.Mock).mock.calls[0][0] as string;
      expect(calledUrl).toContain('status=STATUS_20_IN_PROGRESS');
      expect(calledUrl).toContain('assignedUserId=user-1');
      expect(calledUrl).toContain('caseId=5');
    });

    it('throws on error', async () => {
      (apiClient.get as vi.Mock).mockRejectedValue(new Error('fail'));
      await expect(taskService.getTasks()).rejects.toThrow();
    });
  });

  describe('getAllTasks', () => {
    it('gets all tasks without status filter', async () => {
      const mockTasks = [{ task_id: 1, name: 'Task 1' }];
      (apiClient.get as vi.Mock).mockResolvedValue(mockTasks);

      const result = await taskService.getAllTasks();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/task');
      expect(result).toEqual(mockTasks);
    });

    it('gets all tasks with status filter', async () => {
      const mockTasks = [{ task_id: 1, name: 'Task 1' }];
      (apiClient.get as vi.Mock).mockResolvedValue(mockTasks);

      await taskService.getAllTasks('STATUS_20_IN_PROGRESS');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/api/v1/task?status=STATUS_20_IN_PROGRESS',
      );
    });

    it('returns empty array for non-array response', async () => {
      (apiClient.get as vi.Mock).mockResolvedValue({ data: 'invalid' });

      const result = await taskService.getAllTasks();
      expect(result).toEqual([]);
    });

    it('throws on error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue(new Error('fail'));
      await expect(taskService.getAllTasks()).rejects.toThrow();
      vi.restoreAllMocks();
    });
  });

  describe('getTaskDetails', () => {
    it('gets task details by ID', async () => {
      const mockTask = { id: 1, name: 'Task', status: 'STATUS_20_IN_PROGRESS' };
      (apiClient.get as vi.Mock).mockResolvedValue(mockTask);

      const result = await taskService.getTaskDetails(1);

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/task/1');
      expect(result.id).toBe(1);
    });

    it('throws on error', async () => {
      (apiClient.get as vi.Mock).mockRejectedValue(new Error('fail'));
      await expect(taskService.getTaskDetails(1)).rejects.toThrow();
    });
  });

  describe('assignTaskToInvestigator', () => {
    it('assigns task to investigator', async () => {
      const mockResponse = { task_id: 1, assigned_user_id: 'user-1' };
      (apiClient.patch as vi.Mock).mockResolvedValue(mockResponse);

      const result = await taskService.assignTaskToInvestigator(
        1,
        'user-1',
        'Assigned',
      );

      expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/task/1/assign', {
        assignedUserId: 'user-1',
        note: 'Assigned',
      });
      expect(result.task_id).toBe(1);
    });

    it('throws on error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      (apiClient.patch as vi.Mock).mockRejectedValue(new Error('fail'));
      await expect(
        taskService.assignTaskToInvestigator(1, 'user-1'),
      ).rejects.toThrow();
      vi.restoreAllMocks();
    });
  });

  describe('reassignTask', () => {
    it('reassigns a task', async () => {
      const mockResponse = { success: true, message: 'Task reassigned' };
      (apiClient.patch as vi.Mock).mockResolvedValue(mockResponse);

      const result = await taskService.reassignTask(1, 'user-2', 'Reassigned');

      expect(apiClient.patch).toHaveBeenCalledWith('/api/v1/task/1/reassign', {
        assignedUserId: 'user-2',
        note: 'Reassigned',
      });
      expect(result.success).toBe(true);
    });

    it('throws on error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      (apiClient.patch as vi.Mock).mockRejectedValue(new Error('fail'));
      await expect(
        taskService.reassignTask(1, 'user-2', 'note'),
      ).rejects.toThrow();
      vi.restoreAllMocks();
    });
  });
});
