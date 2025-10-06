import { useQuery } from '@tanstack/react-query';
import { reportsService } from '../services/reportsService';
import type { ReportsData } from '../types/reports.types';

export const useReports = () => {
  return useQuery<ReportsData>({
    queryKey: ['reports'],
    queryFn: () => reportsService.getReportsData(),
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });
};

export const useCaseStatusStats = () => {
  return useQuery({
    queryKey: ['reports', 'stats'],
    queryFn: () => reportsService.getCaseStatusStats(),
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
  });
};
