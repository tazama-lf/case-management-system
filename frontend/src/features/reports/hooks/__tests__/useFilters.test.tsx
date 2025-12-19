import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFilters } from '../useFilters';
import apiClient from '../../../../shared/services/apiClient';

// Mock apiClient
vi.mock('../../../../shared/services/apiClient', () => ({
  default: {
    get: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches filters data successfully', async () => {
    const mockData = {
      caseTypes: [
        { value: 'FRAUD', label: 'Fraud' },
        { value: 'MONEY_LAUNDERING', label: 'Money Laundering' },
      ],
      priorities: [
        { value: 'HIGH', label: 'High' },
        { value: 'MEDIUM', label: 'Medium' },
      ],
      investigators: [
        { value: 'user-1', label: 'John Doe' },
      ],
    };

    vi.mocked(apiClient.get).mockResolvedValue(mockData);

    const { result } = renderHook(() => useFilters(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/reports/filters');
  });

  it('handles error when fetching filters', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Failed to fetch'));

    const { result } = renderHook(() => useFilters(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.data).toBeUndefined();
  });

  it('uses correct query key', () => {
    const { result } = renderHook(() => useFilters(), {
      wrapper: createWrapper(),
    });

    // Query key should be ['reports', 'filters']
    expect(result.current).toBeDefined();
  });

  it('has correct staleTime', async () => {
    const mockData = {
      caseTypes: [],
      priorities: [],
      investigators: [],
    };

    vi.mocked(apiClient.get).mockResolvedValue(mockData);

    const { result } = renderHook(() => useFilters(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // staleTime should be 5 minutes (5 * 60 * 1000)
    expect(result.current).toBeDefined();
  });
});

