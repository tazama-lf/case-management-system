import { useQuery } from '@tanstack/react-query';
import { dashboardService } from '../services/dashboardService';
import type { DashboardData } from '../types/dashboard.types';

export const useDashboard = () =>
  useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: async () => await dashboardService.getDashboardData(),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
  });

export const useDashboardStats = () =>
  useQuery({
    queryKey: ['dashboard', 'stats'],
    queryFn: async () => await dashboardService.getDashboardStats(),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
  });
