import { describe, it, expect, vi, beforeEach } from 'vitest';
import { taskService } from '../taskService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

describe('taskService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('closes a task', async () => {
    const mockTask = {
      id: 'TASK-1',
      status: 'STATUS_30_COMPLETED',
    };
    (apiClient.patch as vi.Mock).mockResolvedValue(mockTask);

    const result = await taskService.closeTask('TASK-1', {
      notes: 'Task completed',
    });

    expect(apiClient.patch).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('handles errors when task operation fails', async () => {
    const error = new Error('Failed to assign task');
    (apiClient.post as vi.Mock).mockRejectedValue(error);

    await expect(
      taskService.assignTask('TASK-1', { assignedUserId: 'user-1' }),
    ).rejects.toThrow();
  });
});

