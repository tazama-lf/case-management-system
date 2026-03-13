import { describe, it, expect, vi, beforeEach } from 'vitest';
import { taskHistoryService } from '../taskHistoryService';
import apiClient from '@/shared/services/apiClient';

vi.mock('@/shared/services/apiClient', () => ({
  default: { get: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);

describe('TaskHistoryService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns task history entries on success', async () => {
    const entries = [
      { event_log_id: '1', user_id: 'u1', operation: 'UPDATE', entity_name: 'task', action_performed: 'updated', case_id: 1, performed_at: new Date(), task_id: 10 },
    ];
    mockGet.mockResolvedValue(entries as any);

    const result = await taskHistoryService.getCaseHistory(1);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/task-history/1');
    expect(result).toEqual(entries);
  });

  it('returns empty array when response is not an array', async () => {
    mockGet.mockResolvedValue({ taskHistory: [] } as any);

    const result = await taskHistoryService.getCaseHistory(1);
    expect(result).toEqual([]);
  });

  it('returns empty array on error', async () => {
    mockGet.mockRejectedValue(new Error('fail'));

    const result = await taskHistoryService.getCaseHistory(1);
    expect(result).toEqual([]);
  });
});
