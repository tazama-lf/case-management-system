import { describe, it, expect, vi, beforeEach } from 'vitest';
import { caseHistoryService } from '../caseHistoryService';
import apiClient from '@/shared/services/apiClient';

vi.mock('@/shared/services/apiClient', () => ({
  default: { get: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);

describe('CaseHistoryService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns case history entries on success', async () => {
    const entries = [
      { event_log_id: '1', user_id: 'u1', operation: 'CREATE', entity_name: 'case', action_performed: 'created', case_id: 1, performed_at: new Date() },
    ];
    mockGet.mockResolvedValue(entries as any);

    const result = await caseHistoryService.getCaseHistory(1);
    expect(mockGet).toHaveBeenCalledWith('/api/v1/case-history/1');
    expect(result).toEqual(entries);
  });

  it('returns empty array when response is not an array', async () => {
    mockGet.mockResolvedValue({ data: 'not-array' } as any);

    const result = await caseHistoryService.getCaseHistory(1);
    expect(result).toEqual([]);
  });

  it('returns empty array on error', async () => {
    mockGet.mockRejectedValue(new Error('fail'));

    const result = await caseHistoryService.getCaseHistory(1);
    expect(result).toEqual([]);
  });
});
