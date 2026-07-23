import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import type { DashboardData } from '../types/dashboard.types';

export const useDashboard = (): ReturnType<typeof useQuery<DashboardData>> =>
  useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => await dashboardService.getDashboardData(),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });
