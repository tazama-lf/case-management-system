import { describe, it, expect, vi, beforeEach } from 'vitest';
import EntityMetadataService from '../entityMetatdataService';
import { apiClient } from '@/shared';

vi.mock('@/shared', () => ({
    apiClient: { get: vi.fn() },
}));

const mockGet = vi.mocked(apiClient.get);

describe('EntityMetadataService', () => {
    beforeEach(() => vi.clearAllMocks());

    describe('fetchEntityMetadata', () => {
        it('calls the correct endpoint and returns data', async () => {
            const mockResponse = {
                entityId: 'E1',
                entityType: 'ACCOUNT',
                details: { name: 'Bob', risk: 'HIGH' },
            };
            mockGet.mockResolvedValueOnce(mockResponse);

            const result = await EntityMetadataService.fetchEntityMetadata(101, 'tenant-1');

            expect(mockGet).toHaveBeenCalledWith(
                '/api/v1/lakehouse/entity-metadata/101?tenantId=tenant-1',
            );
            expect(result).toEqual(mockResponse);
        });

        it('propagates errors from API client', async () => {
            mockGet.mockRejectedValueOnce(new Error('Not found'));

            await expect(
                EntityMetadataService.fetchEntityMetadata(0, 'tenant-1'),
            ).rejects.toThrow('Not found');
        });
    });
});
