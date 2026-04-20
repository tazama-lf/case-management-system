import { describe, it, expect, vi, beforeEach } from 'vitest';
import referenceIdService from '../referenceIdService';
import apiClient from '@/shared/services/apiClient';

vi.mock('@/shared/services/apiClient', () => ({
    __esModule: true,
    default: { get: vi.fn(), post: vi.fn() },
}));

const mockApi = apiClient as unknown as { get: vi.Mock; post: vi.Mock };

describe('referenceIdService', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('getReferenceIds', () => {
        it('returns items and totalCount on success', async () => {
            const items = [{ id: '1', txTp: 'TRANSFER', referenceIdName: 'REF-001' }];
            mockApi.get.mockResolvedValueOnce(items);

            const result = await referenceIdService.getReferenceIds();

            expect(mockApi.get).toHaveBeenCalledWith('/admin/referencesIds/all');
            expect(result).toEqual({ items, totalCount: 1 });
        });

        it('returns empty items when API returns empty array', async () => {
            mockApi.get.mockResolvedValueOnce([]);

            const result = await referenceIdService.getReferenceIds();

            expect(result).toEqual({ items: [], totalCount: 0 });
        });

        it('throws formatted error on API failure', async () => {
            mockApi.get.mockRejectedValueOnce(new Error('Network error'));

            await expect(referenceIdService.getReferenceIds()).rejects.toThrow('Network error');
        });

        it('throws with API response message when available', async () => {
            mockApi.get.mockRejectedValueOnce({
                response: { data: { message: 'Unauthorized' } },
            });

            await expect(referenceIdService.getReferenceIds()).rejects.toThrow('Unauthorized');
        });

        it('throws generic error when no message available', async () => {
            mockApi.get.mockRejectedValueOnce({});

            await expect(referenceIdService.getReferenceIds()).rejects.toThrow(
                'Failed to get reference ids',
            );
        });
    });

    describe('createReferenceIds', () => {
        const payload = { txTp: 'TRANSFER', referenceIdName: 'REF-001' };

        it('creates a reference ID and returns response', async () => {
            const response = { items: [{ ...payload, id: '1' }], totalCount: 1 };
            mockApi.post.mockResolvedValueOnce(response);

            const result = await referenceIdService.createReferenceIds(payload);

            expect(mockApi.post).toHaveBeenCalledWith('/admin/reference-id', payload);
            expect(result).toEqual(response);
        });

        it('throws formatted error on creation failure', async () => {
            mockApi.post.mockRejectedValueOnce(new Error('Conflict'));

            await expect(referenceIdService.createReferenceIds(payload)).rejects.toThrow('Conflict');
        });
    });
});
