import { useQuery } from '@tanstack/react-query';
import { reportsService } from '../services/reportsService';
import type {
  ReportsData,
  InvestigatorWorkloadData,
  TaskCompletionData,
  AuditLogsData,
  CaseAgeingData
} from '../types/reports.types';

export const useReports = (dateRange?: string, filters?: { caseType: string; priority: string; investigator: string }) => {
  return useQuery<ReportsData>({
    queryKey: ['reports', dateRange, filters],
    queryFn: () => reportsService.getReportsData(dateRange, filters),
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });
};

export const useCaseStatusStats = () => {
  return useQuery({
    queryKey: ['reports', 'stats'],
    queryFn: () => reportsService.getReportsData(),
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
  });
};

export const useInvestigatorWorkload = (dateRange?: string) => {
  return useQuery<InvestigatorWorkloadData>({
    queryKey: ['reports', 'investigator-workload', dateRange],
    queryFn: () => reportsService.getInvestigatorWorkloadData(dateRange),
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });
};

export const useTaskCompletion = (dateRange?: string) => {
  return useQuery<TaskCompletionData>({
    queryKey: ['reports', 'task-completion', dateRange],
    queryFn: () => reportsService.getTaskCompletionData(dateRange),
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });
};

export const useAuditLogs = (dateRange?: string) => {
  return useQuery<AuditLogsData>({
    queryKey: ['reports', 'audit-logs', dateRange],
    queryFn: () => reportsService.getAuditLogsData(dateRange),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
    retry: 1,
  });
};

export const useCaseAgeing = (dateRange?: string) => {
  return useQuery<CaseAgeingData>({
    queryKey: ['reports', 'case-ageing', dateRange],
    queryFn: () => reportsService.getCaseAgeingData(dateRange),
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });
};