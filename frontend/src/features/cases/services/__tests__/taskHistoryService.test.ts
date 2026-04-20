import { describe, it, expect, vi, beforeEach } from 'vitest';
import { taskHistoryService } from '../taskHistoryService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient', () => ({
    default: { get: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);

describe('taskHistoryService', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('getCaseHistory', () => {
        it('returns task history entries on success', async () => {
            const entries = [
                {
                    event_log_id: 'e1',
                    user_id: 'u1',
                    operation: 'CREATE',
                    entity_name: 'Task',
                    action_performed: 'Task created',
                    case_id: 10,
                    performed_at: new Date('2024-02-01'),
                    task_id: 5,
                },
            ];
            mockGet.mockResolvedValueOnce(entries);

            const result = await taskHistoryService.getCaseHistory(10);

            expect(mockGet).toHaveBeenCalledWith('/api/v1/task-history/10');
            expect(result).toEqual(entries);
        });

        it('returns empty array when API returns non-array', async () => {
            mockGet.mockResolvedValueOnce({ taskHistory: [] } as any);

            const result = await taskHistoryService.getCaseHistory(1);

            expect(result).toEqual([]);
        });

        it('returns empty array on API error', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            mockGet.mockRejectedValueOnce(new Error('Network error'));

            const result = await taskHistoryService.getCaseHistory(99);

            expect(result).toEqual([]);
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});
