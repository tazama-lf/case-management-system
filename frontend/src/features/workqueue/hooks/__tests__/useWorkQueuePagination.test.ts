import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useWorkQueuePagination } from '../useWorkQueuePagination';
import type { UnifiedWorkQueueTask } from '../../types/flowable.types';

const createMockTask = (id: string): UnifiedWorkQueueTask => ({
  id,
  taskId: id,
  name: `Task ${id}`,
  status: 'UNASSIGNED',
  priority: 'NEW',
  createdAt: '2023-01-01T00:00:00.000Z',
  processInstanceId: 'proc-1',
});

describe('useWorkQueuePagination', () => {
  it('initializes with default values', () => {
    const tasks = Array.from({ length: 25 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result } = renderHook(() => useWorkQueuePagination(tasks));

    expect(result.current.pagination.currentPage).toBe(1);
    expect(result.current.pagination.pageSize).toBe(10);
    expect(result.current.pagination.totalItems).toBe(25);
    expect(result.current.pagination.totalPages).toBe(3);
    expect(result.current.paginatedTasks).toHaveLength(10);
  });

  it('returns correct paginated tasks for first page', () => {
    const tasks = Array.from({ length: 25 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result } = renderHook(() => useWorkQueuePagination(tasks));

    expect(result.current.paginatedTasks).toHaveLength(10);
    expect(result.current.paginatedTasks[0].id).toBe('task-1');
    expect(result.current.paginatedTasks[9].id).toBe('task-10');
  });

  it('changes page when onPageChange is called', () => {
    const tasks = Array.from({ length: 25 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result } = renderHook(() => useWorkQueuePagination(tasks));

    act(() => {
      result.current.pagination.onPageChange(2);
    });

    expect(result.current.pagination.currentPage).toBe(2);
    expect(result.current.paginatedTasks).toHaveLength(10);
    expect(result.current.paginatedTasks[0].id).toBe('task-11');
    expect(result.current.paginatedTasks[9].id).toBe('task-20');
  });

  it('returns correct paginated tasks for last page', () => {
    const tasks = Array.from({ length: 25 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result } = renderHook(() => useWorkQueuePagination(tasks));

    act(() => {
      result.current.pagination.onPageChange(3);
    });

    expect(result.current.pagination.currentPage).toBe(3);
    expect(result.current.paginatedTasks).toHaveLength(5);
    expect(result.current.paginatedTasks[0].id).toBe('task-21');
    expect(result.current.paginatedTasks[4].id).toBe('task-25');
  });

  it('changes page size when setPageSize is called', () => {
    const tasks = Array.from({ length: 25 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result } = renderHook(() => useWorkQueuePagination(tasks));

    act(() => {
      result.current.setPageSize(5);
    });

    expect(result.current.pagination.pageSize).toBe(5);
    expect(result.current.pagination.totalPages).toBe(5);
    expect(result.current.paginatedTasks).toHaveLength(5);
    expect(result.current.paginatedTasks[0].id).toBe('task-1');
    expect(result.current.paginatedTasks[4].id).toBe('task-5');
  });

  it('recalculates total pages when page size changes', () => {
    const tasks = Array.from({ length: 25 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result } = renderHook(() => useWorkQueuePagination(tasks));

    expect(result.current.pagination.totalPages).toBe(3);

    act(() => {
      result.current.setPageSize(20);
    });

    expect(result.current.pagination.totalPages).toBe(2);
  });

  it('auto-resets to page 1 when current page exceeds total pages after page size increase', () => {
    const tasks = Array.from({ length: 25 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result } = renderHook(() => useWorkQueuePagination(tasks));

    // Go to page 3
    act(() => {
      result.current.pagination.onPageChange(3);
    });

    expect(result.current.pagination.currentPage).toBe(3);

    // Increase page size so that total pages becomes 2
    act(() => {
      result.current.setPageSize(20);
    });

    // Should auto-reset to page 1
    expect(result.current.pagination.currentPage).toBe(1);
    expect(result.current.pagination.totalPages).toBe(2);
  });

  it('auto-resets to page 1 when tasks array becomes smaller', () => {
    const initialTasks = Array.from({ length: 25 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result, rerender } = renderHook(
      ({ tasks }) => useWorkQueuePagination(tasks),
      {
        initialProps: { tasks: initialTasks },
      },
    );

    // Go to page 3
    act(() => {
      result.current.pagination.onPageChange(3);
    });

    expect(result.current.pagination.currentPage).toBe(3);

    // Reduce tasks to only 5 items (1 page)
    const reducedTasks = initialTasks.slice(0, 5);
    rerender({ tasks: reducedTasks });

    // Should auto-reset to page 1
    expect(result.current.pagination.currentPage).toBe(1);
    expect(result.current.pagination.totalPages).toBe(1);
    expect(result.current.paginatedTasks).toHaveLength(5);
  });

  it('handles empty tasks array', () => {
    const { result } = renderHook(() => useWorkQueuePagination([]));

    expect(result.current.pagination.currentPage).toBe(1);
    expect(result.current.pagination.pageSize).toBe(10);
    expect(result.current.pagination.totalItems).toBe(0);
    expect(result.current.pagination.totalPages).toBe(1);
    expect(result.current.paginatedTasks).toHaveLength(0);
  });

  it('handles tasks array smaller than page size', () => {
    const tasks = Array.from({ length: 5 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result } = renderHook(() => useWorkQueuePagination(tasks));

    expect(result.current.pagination.totalPages).toBe(1);
    expect(result.current.paginatedTasks).toHaveLength(5);
    expect(result.current.paginatedTasks[0].id).toBe('task-1');
    expect(result.current.paginatedTasks[4].id).toBe('task-5');
  });

  it('handles exactly one page of tasks', () => {
    const tasks = Array.from({ length: 10 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result } = renderHook(() => useWorkQueuePagination(tasks));

    expect(result.current.pagination.totalPages).toBe(1);
    expect(result.current.paginatedTasks).toHaveLength(10);
  });

  it('maintains page 1 when tasks array changes but current page is still valid', () => {
    const initialTasks = Array.from({ length: 25 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result, rerender } = renderHook(
      ({ tasks }) => useWorkQueuePagination(tasks),
      {
        initialProps: { tasks: initialTasks },
      },
    );

    expect(result.current.pagination.currentPage).toBe(1);

    // Change tasks but keep enough for page 1
    const newTasks = Array.from({ length: 30 }, (_, i) =>
      createMockTask(`new-task-${i + 1}`),
    );
    rerender({ tasks: newTasks });

    expect(result.current.pagination.currentPage).toBe(1);
    expect(result.current.pagination.totalPages).toBe(3);
  });

  it('updates paginated tasks when tasks array changes', () => {
    const initialTasks = Array.from({ length: 10 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result, rerender } = renderHook(
      ({ tasks }) => useWorkQueuePagination(tasks),
      {
        initialProps: { tasks: initialTasks },
      },
    );

    expect(result.current.paginatedTasks[0].id).toBe('task-1');

    const newTasks = Array.from({ length: 10 }, (_, i) =>
      createMockTask(`new-task-${i + 1}`),
    );
    rerender({ tasks: newTasks });

    expect(result.current.paginatedTasks[0].id).toBe('new-task-1');
  });

  it('handles large page size that exceeds total items', () => {
    const tasks = Array.from({ length: 5 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result } = renderHook(() => useWorkQueuePagination(tasks));

    act(() => {
      result.current.setPageSize(100);
    });

    expect(result.current.pagination.pageSize).toBe(100);
    expect(result.current.pagination.totalPages).toBe(1);
    expect(result.current.paginatedTasks).toHaveLength(5);
  });

  it('handles page size of 1', () => {
    const tasks = Array.from({ length: 5 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result } = renderHook(() => useWorkQueuePagination(tasks));

    act(() => {
      result.current.setPageSize(1);
    });

    expect(result.current.pagination.pageSize).toBe(1);
    expect(result.current.pagination.totalPages).toBe(5);
    expect(result.current.paginatedTasks).toHaveLength(1);
    expect(result.current.paginatedTasks[0].id).toBe('task-1');
  });

  it('correctly calculates total pages for various task counts', () => {
    const testCases = [
      { tasks: 0, pageSize: 10, expectedPages: 1 },
      { tasks: 1, pageSize: 10, expectedPages: 1 },
      { tasks: 10, pageSize: 10, expectedPages: 1 },
      { tasks: 11, pageSize: 10, expectedPages: 2 },
      { tasks: 25, pageSize: 10, expectedPages: 3 },
      { tasks: 100, pageSize: 10, expectedPages: 10 },
      { tasks: 99, pageSize: 10, expectedPages: 10 },
    ];

    testCases.forEach(({ tasks: taskCount, pageSize, expectedPages }) => {
      const tasks = Array.from({ length: taskCount }, (_, i) =>
        createMockTask(`task-${i + 1}`),
      );

      const { result } = renderHook(() => useWorkQueuePagination(tasks));

      act(() => {
        result.current.setPageSize(pageSize);
      });

      expect(result.current.pagination.totalPages).toBe(expectedPages);
    });
  });

  it('preserves page state when navigating between valid pages', () => {
    const tasks = Array.from({ length: 25 }, (_, i) =>
      createMockTask(`task-${i + 1}`),
    );

    const { result } = renderHook(() => useWorkQueuePagination(tasks));

    act(() => {
      result.current.pagination.onPageChange(2);
    });
    expect(result.current.pagination.currentPage).toBe(2);

    act(() => {
      result.current.pagination.onPageChange(1);
    });
    expect(result.current.pagination.currentPage).toBe(1);

    act(() => {
      result.current.pagination.onPageChange(3);
    });
    expect(result.current.pagination.currentPage).toBe(3);
  });
});

