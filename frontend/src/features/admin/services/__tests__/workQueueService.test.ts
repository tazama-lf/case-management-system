import workQueueService from '../workQueueService';
import apiClient from '@/shared/services/apiClient';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockApi = apiClient as unknown as {
  get: vi.Mock;
  post: vi.Mock;
  put: vi.Mock;
  delete: vi.Mock;
};

describe('workQueueService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds a query string when fetching all work queues', async () => {
    mockApi.get.mockResolvedValueOnce({
      data: [],
      page: 1,
      limit: 10,
      total: 0,
      totalPages: 0,
    });

    await workQueueService.getAllWorkQueues({
      role: 'analyst',
      isActive: true,
      page: 2,
      limit: 25,
      sortBy: 'name',
      sortOrder: 'desc',
    });

    expect(mockApi.get).toHaveBeenCalledWith(
      '/api/v1/work-queues?role=analyst&isActive=true&page=2&limit=25&sortBy=name&sortOrder=desc',
    );
  });

  it('calls delete endpoint for removing a work queue', async () => {
    mockApi.delete.mockResolvedValueOnce(undefined);

    await workQueueService.deleteWorkQueue('queue-1');

    expect(mockApi.delete).toHaveBeenCalledWith(
      '/api/v1/work-queues/queue-1',
    );
  });

  it('supports create and update operations', async () => {
    const payload = { name: 'AML Queue' };
    mockApi.post.mockResolvedValueOnce(payload);
    mockApi.put.mockResolvedValueOnce(payload);

    await workQueueService.createWorkQueue(payload);
    await workQueueService.updateWorkQueue('queue-1', payload);

    expect(mockApi.post).toHaveBeenCalledWith(
      '/api/v1/work-queues',
      payload,
    );
    expect(mockApi.put).toHaveBeenCalledWith(
      '/api/v1/work-queues/queue-1',
      payload,
    );
  });
});

