import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCaseTasks } from '../useCaseTasks';
import { taskService } from '../../services/taskService';

vi.mock('../../services/taskService', () => ({
    taskService: { getTasksByCaseId: vi.fn() },
}));

const mockGetTasks = vi.mocked(taskService.getTasksByCaseId);

describe('useCaseTasks', () => {
    beforeEach(() => vi.clearAllMocks());

    it('does not fetch when caseId is undefined', () => {
        const { result } = renderHook(() => useCaseTasks(undefined));

        expect(result.current.loading).toBe(false);
        expect(result.current.tasks).toHaveLength(0);
        expect(mockGetTasks).not.toHaveBeenCalled();
    });

    it('fetches tasks when caseId is provided', async () => {
        const tasks = [{ task_id: 1, name: 'Investigation', case_id: 5 }];
        mockGetTasks.mockResolvedValueOnce(tasks as any);

        const { result } = renderHook(() => useCaseTasks(5));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(mockGetTasks).toHaveBeenCalledWith(5);
        expect(result.current.tasks).toHaveLength(1);
        expect(result.current.error).toBeNull();
    });

    it('sets error state when fetch fails', async () => {
        mockGetTasks.mockRejectedValueOnce(new Error('Task fetch failed'));

        const { result } = renderHook(() => useCaseTasks(10));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBe('Task fetch failed');
        expect(result.current.tasks).toHaveLength(0);
    });

    it('sets generic error message for non-Error rejections', async () => {
        mockGetTasks.mockRejectedValueOnce('unexpected');

        const { result } = renderHook(() => useCaseTasks(10));

        await waitFor(() => expect(result.current.loading).toBe(false));

        expect(result.current.error).toBe('Failed to fetch tasks');
    });

    it('fetchTasks can be called manually to refresh', async () => {
        mockGetTasks
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([{ task_id: 2, name: 'Review', case_id: 5 }] as any);

        const { result } = renderHook(() => useCaseTasks(5));
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(() => result.current.fetchTasks());

        expect(mockGetTasks).toHaveBeenCalledTimes(2);
    });
});
