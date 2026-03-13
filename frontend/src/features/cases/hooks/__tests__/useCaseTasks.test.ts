import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useCaseTasks } from '../useCaseTasks';
import { taskService } from '../../services/taskService';

vi.mock('../../services/taskService', () => ({
  taskService: {
    getTasksByCaseId: vi.fn(),
  },
}));

describe('useCaseTasks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when caseId is undefined', () => {
    const { result } = renderHook(() => useCaseTasks());
    expect(result.current.tasks).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(taskService.getTasksByCaseId).not.toHaveBeenCalled();
  });

  it('fetches tasks when caseId is provided', async () => {
    const mockTasks = [
      { id: 1, name: 'Task A', status: 'IN_PROGRESS' },
      { id: 2, name: 'Task B', status: 'COMPLETED' },
    ];
    vi.mocked(taskService.getTasksByCaseId).mockResolvedValue(mockTasks as any);

    const { result } = renderHook(() => useCaseTasks(100));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(taskService.getTasksByCaseId).toHaveBeenCalledWith(100);
    expect(result.current.tasks).toEqual(mockTasks);
    expect(result.current.error).toBeNull();
  });

  it('sets error when fetch fails', async () => {
    vi.mocked(taskService.getTasksByCaseId).mockRejectedValue(new Error('Network error'));

    const { result } = renderHook(() => useCaseTasks(200));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network error');
    expect(result.current.tasks).toEqual([]);
  });

  it('sets generic error when non-Error is thrown', async () => {
    vi.mocked(taskService.getTasksByCaseId).mockRejectedValue('unknown');

    const { result } = renderHook(() => useCaseTasks(300));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Failed to fetch tasks');
  });

  it('refetches when caseId changes', async () => {
    vi.mocked(taskService.getTasksByCaseId).mockResolvedValue([]);

    const { result, rerender } = renderHook(
      ({ caseId }) => useCaseTasks(caseId),
      { initialProps: { caseId: 100 } },
    );

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(taskService.getTasksByCaseId).toHaveBeenCalledWith(100);

    rerender({ caseId: 200 });
    await waitFor(() => expect(taskService.getTasksByCaseId).toHaveBeenCalledWith(200));
  });

  it('exposes fetchTasks for manual refresh', async () => {
    vi.mocked(taskService.getTasksByCaseId).mockResolvedValue([]);

    const { result } = renderHook(() => useCaseTasks(100));
    await waitFor(() => expect(result.current.loading).toBe(false));

    vi.mocked(taskService.getTasksByCaseId).mockResolvedValue([{ id: 3 }] as any);
    await result.current.fetchTasks();

    await waitFor(() => expect(result.current.tasks).toEqual([{ id: 3 }]));
  });
});
