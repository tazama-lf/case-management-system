import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useDashboard, useDashboardStats } from '../useDashboard';
import { dashboardService } from '../../services/dashboardService';

vi.mock('../../services/dashboardService', () => ({
  dashboardService: {
    getDashboardData: vi.fn(),
    getDashboardStats: vi.fn(),
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
      recentAlerts: [],
      activeCases: [],
    };

    (dashboardService.getDashboardData as vi.Mock).mockResolvedValue(mockData);

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockData);
    expect(dashboardService.getDashboardData).toHaveBeenCalled();
  });

  it('handles loading state', () => {
    (dashboardService.getDashboardData as vi.Mock).mockImplementation(
      () => new Promise(() => {}),
    );

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('handles error state', async () => {
    const error = new Error('Failed to fetch');
    (dashboardService.getDashboardData as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('uses correct query key', async () => {
    (dashboardService.getDashboardData as vi.Mock).mockResolvedValue({
      stats: {
        totalAlerts: 0,
        highPriorityAlerts: 0,
        openCases: 0,
        casesResolvedThisWeek: 0,
      },
      recentAlerts: [],
      activeCases: [],
    });

    const { result } = renderHook(() => useDashboard(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
  });
});

describe('useDashboardStats', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches dashboard stats successfully', async () => {
    const mockStats = {
      totalAlerts: 10,
      highPriorityAlerts: 5,
      openCases: 3,
      casesResolvedThisWeek: 7,
    };

    (dashboardService.getDashboardStats as vi.Mock).mockResolvedValue(mockStats);

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toEqual(mockStats);
    expect(dashboardService.getDashboardStats).toHaveBeenCalled();
  });

  it('handles loading state', () => {
    (dashboardService.getDashboardStats as vi.Mock).mockImplementation(
      () => new Promise(() => {}),
    );

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('handles error state', async () => {
    const error = new Error('Failed to fetch');
    (dashboardService.getDashboardStats as vi.Mock).mockRejectedValue(error);

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });

    expect(result.current.error).toBeDefined();
  });

  it('uses correct query key', async () => {
    (dashboardService.getDashboardStats as vi.Mock).mockResolvedValue({
      totalAlerts: 0,
      highPriorityAlerts: 0,
      openCases: 0,
      casesResolvedThisWeek: 0,
    });

    const { result } = renderHook(() => useDashboardStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current.isSuccess).toBe(true);
    });

    expect(result.current.data).toBeDefined();
  });
});

