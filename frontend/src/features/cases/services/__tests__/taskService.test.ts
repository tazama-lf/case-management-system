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
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
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
        { reason: 'No longer needed' }
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

      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/task/TASK-1',
        { name: 'Updated Task' }
      );
      expect(result).toEqual(mockTask);
    });

    it('validates task response', async () => {
      (apiClient.patch as vi.Mock).mockResolvedValue({ name: 'Task' });

      await expect(taskService.updateTask('TASK-1', {})).rejects.toThrow(
        'Task ID is missing'
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

  describe('getWorkQueue', () => {
    it('gets work queue without filters', async () => {
      const mockResponse = {
        tasks: [],
        total: 0,
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      const result = await taskService.getWorkQueue();

      expect(apiClient.get).toHaveBeenCalledWith('/api/v1/task/work-queue?');
      expect(result).toEqual(mockResponse);
    });

    it('gets work queue with filters', async () => {
      const mockResponse = {
        tasks: [],
        total: 0,
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      await taskService.getWorkQueue({
        role: 'investigator',
        candidateGroup: 'investigations',
        page: 1,
        limit: 20,
      });

      expect(apiClient.get).toHaveBeenCalledWith(
        expect.stringContaining('role=investigator'),
      );
    });

    it('filters out undefined and null values', async () => {
      const mockResponse = {
        tasks: [],
        total: 0,
      };
      (apiClient.get as vi.Mock).mockResolvedValue(mockResponse);

      await taskService.getWorkQueue({
        role: 'investigator',
        candidateGroup: undefined,
        page: null as any,
        limit: 20,
      });

      const callUrl = (apiClient.get as vi.Mock).mock.calls[0][0] as string;
      expect(callUrl).toContain('role=investigator');
      expect(callUrl).toContain('limit=20');
      expect(callUrl).not.toContain('candidateGroup');
      expect(callUrl).not.toContain('page');
    });

    it('handles errors gracefully', async () => {
      const error = new Error('Failed to fetch work queue');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(taskService.getWorkQueue()).rejects.toThrow();
    });
  });

  describe('completeTask', () => {
    it('completes a task', async () => {
      const mockTask = {
        id: 'TASK-1',
        status: TaskStatus.STATUS_30_COMPLETED,
      };
      (apiClient.patch as vi.Mock).mockResolvedValue(mockTask);

      const result = await taskService.completeTask('TASK-1');

      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/task/TASK-1',
        { status: TaskStatus.STATUS_30_COMPLETED }
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

      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/task/TASK-1',
        { status: TaskStatus.STATUS_20_IN_PROGRESS }
      );
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

      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/task/TASK-1',
        { status: TaskStatus.STATUS_21_BLOCKED }
      );
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

      expect(apiClient.patch).toHaveBeenCalledWith(
        '/api/v1/task/TASK-1',
        { status: TaskStatus.STATUS_30_COMPLETED }
      );
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
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const error = new Error('Failed to fetch');
      (apiClient.get as vi.Mock).mockRejectedValue(error);

      await expect(
        taskService.getInvestigationTaskForCase('CASE-123'),
      ).rejects.toThrow();

      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});

