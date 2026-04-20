import { describe, it, expect, vi, beforeEach } from 'vitest';
import { caseHistoryService } from '../caseHistoryService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient', () => ({
    default: { get: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);

describe('caseHistoryService', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('getCaseHistory', () => {
        it('returns an array of history entries on success', async () => {
            const entries = [
                {
                    event_log_id: 'e1',
                    user_id: 'u1',
                    operation: 'UPDATE',
                    entity_name: 'Case',
                    action_performed: 'Status changed',
                    case_id: 42,
                    performed_at: new Date('2024-01-01'),
                },
            ];
            mockGet.mockResolvedValueOnce(entries);

            const result = await caseHistoryService.getCaseHistory(42);

            expect(mockGet).toHaveBeenCalledWith('/api/v1/case-history/42');
            expect(result).toEqual(entries);
        });

        it('returns empty array when API returns non-array response', async () => {
            mockGet.mockResolvedValueOnce(null as any);

            const result = await caseHistoryService.getCaseHistory(1);

            expect(result).toEqual([]);
        });

        it('returns empty array on API error', async () => {
            const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => { });
            mockGet.mockRejectedValueOnce(new Error('Not found'));

            const result = await caseHistoryService.getCaseHistory(99);

            expect(result).toEqual([]);
            expect(consoleSpy).toHaveBeenCalled();
            consoleSpy.mockRestore();
        });
    });
});
