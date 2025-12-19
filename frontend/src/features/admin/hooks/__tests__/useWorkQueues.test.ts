import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWorkQueues } from '../useWorkQueues';
import workQueueService from '../../services/workQueueService';

vi.mock('../../services/workQueueService', () => ({
  __esModule: true,
  default: {
    getAllWorkQueues: vi.fn(),
  },
}));

const mockService = workQueueService as unknown as {
  getAllWorkQueues: vi.Mock;
};

const createResponse = (overrides = {}) => ({
  data: [
    {
      workQueueId: 'queue-1',
      name: 'Investigations',
      description: 'AML queue',
      tenantId: 'tenant',
      isActive: true,
      createdByUserId: 'user-1',
      roles: ['Analyst'],
      taskTypes: ['Review'],
      taskCount: 3,
      createdAt: '2024-01-01',
      updatedAt: '2024-01-02',
    },
  ],
  total: 1,
  page: 1,
  limit: 10,
  totalPages: 1,
  ...overrides,
});

describe('useWorkQueues', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches and transforms work queues on mount', async () => {
    mockService.getAllWorkQueues.mockResolvedValueOnce(createResponse());

    const { result } = renderHook(() => useWorkQueues());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.workQueues).toHaveLength(1);
    expect(result.current.workQueues[0]).toMatchObject({
      id: 'queue-1',
      status: 'Active',
      taskCount: 3,
    });
    expect(result.current.totalPages).toBe(1);
    expect(mockService.getAllWorkQueues).toHaveBeenCalledWith({});
  });

  it('exposes errors when the service fails', async () => {
    mockService.getAllWorkQueues.mockRejectedValueOnce(new Error('boom'));

    const { result } = renderHook(() => useWorkQueues());

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('boom');
  });

  it('allows filters to be updated and refetched', async () => {
    mockService.getAllWorkQueues
      .mockResolvedValueOnce(createResponse())
      .mockResolvedValueOnce(createResponse({ page: 2 }));

    const { result } = renderHook(() => useWorkQueues({ isActive: true }));

    await waitFor(() => expect(result.current.loading).toBe(false));

    result.current.updateFilters({ page: 2 });

    await waitFor(() =>
      expect(mockService.getAllWorkQueues).toHaveBeenCalledTimes(2),
    );
    expect(mockService.getAllWorkQueues).toHaveBeenLastCalledWith({
      isActive: true,
      page: 2,
    });
  });
});

