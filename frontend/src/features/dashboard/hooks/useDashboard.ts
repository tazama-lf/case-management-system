import { useQuery } from '@tanstack/react-query';
import dashboardService from '../services/dashboardService';
import type { DashboardData } from '../types/dashboard.types';
import { FIVE_MINUTES } from '@/shared/constants/timing';

export const useDashboard = (): ReturnType<typeof useQuery<DashboardData>> =>
  useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => await dashboardService.getDashboardData(),
    staleTime: FIVE_MINUTES,
    refetchInterval: FIVE_MINUTES,
    refetchOnWindowFocus: true,
  });

export const useDashboardStats = (): ReturnType<typeof useQuery> =>
  useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => await dashboardService.getDashboardStats(),
    staleTime: FIVE_MINUTES,
    refetchInterval: FIVE_MINUTES,
  });
