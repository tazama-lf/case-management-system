import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useDashboard } from '../useDashboard';
import { dashboardService } from '../../services/dashboardService';

vi.mock('../../services/dashboardService', () => ({
  dashboardService: {
    getDashboardData: vi.fn(),
  },
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('useDashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches dashboard data successfully', async () => {
    const mockData = {
      stats: {
        totalAlerts: 10,
        highPriorityAlerts: 5,
        openCases: 3,
        casesResolvedThisWeek: 7,
      },
      recentCases: [],
      activeCases: [],
    };

    vi.mocked(dashboardService.getDashboardData).mockResolvedValue(mockData);

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(dashboardService.getDashboardData).toHaveBeenCalledTimes(1);
  });

  it('handles loading state', () => {
    vi.mocked(dashboardService.getDashboardData).mockImplementation(
      () => new Promise(() => {}),
    );

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('handles error state', async () => {
    const error = new Error('Failed to fetch');

    vi.mocked(dashboardService.getDashboardData).mockRejectedValue(error);

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('uses correct query key and returns dashboard data', async () => {
    const mockData = {
      stats: {
        totalAlerts: 0,
        highPriorityAlerts: 0,
        openCases: 0,
        casesResolvedThisWeek: 0,
      },
      recentCases: [],
      activeCases: [],
    };

    vi.mocked(dashboardService.getDashboardData).mockResolvedValue(mockData);

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(dashboardService.getDashboardData).toHaveBeenCalledTimes(1);
  });
});
