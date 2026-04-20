import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEntityMetadata } from '../useEntityMetadata';
import entityMetatdataService from '../../services/entityMetatdataService';

vi.mock('../../services/entityMetatdataService', () => ({
    default: { fetchEntityMetadata: vi.fn() },
}));

const mockFetch = vi.mocked(entityMetatdataService.fetchEntityMetadata);

const createWrapper = () => {
    const queryClient = new QueryClient({
        defaultOptions: { queries: { retry: false } },
    });
    return ({ children }: { children: React.ReactNode }) =>
        React.createElement(QueryClientProvider, { client: queryClient }, children);
};

describe('useEntityMetadata', () => {
    beforeEach(() => vi.clearAllMocks());

    it('returns entity metadata on successful fetch', async () => {
        const mockData = { entityId: 'E1', entityType: 'ACCOUNT', details: {} };
        mockFetch.mockResolvedValueOnce(mockData as any);

        const { result } = renderHook(
            () => useEntityMetadata(101, 'tenant-1'),
            { wrapper: createWrapper() },
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(mockFetch).toHaveBeenCalledWith(101, 'tenant-1');
        expect(result.current.entityMetadata).toEqual(mockData);
        expect(result.current.error).toBeNull();
    });

    it('does not fetch when alertId is 0', () => {
        const { result } = renderHook(
            () => useEntityMetadata(0, 'tenant-1'),
            { wrapper: createWrapper() },
        );

        expect(result.current.isLoading).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('does not fetch when tenantId is empty string', () => {
        const { result } = renderHook(
            () => useEntityMetadata(1, ''),
            { wrapper: createWrapper() },
        );

        expect(result.current.isLoading).toBe(false);
        expect(mockFetch).not.toHaveBeenCalled();
    });

    it('sets error when fetch fails', async () => {
        mockFetch.mockRejectedValueOnce(new Error('Not found'));

        const { result } = renderHook(
            () => useEntityMetadata(99, 'tenant-x'),
            { wrapper: createWrapper() },
        );

        await waitFor(() => expect(result.current.isLoading).toBe(false));

        expect(result.current.error).toBeTruthy();
        expect(result.current.entityMetadata).toBeUndefined();
    });
});
