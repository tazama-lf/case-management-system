import { useQuery } from '@tanstack/react-query';
import { reportsService } from '../services/reportsService';
import type {
  ReportsData,
  InvestigatorWorkloadData,
  TaskCompletionData,
  AuditLogsData,
  CaseAgeingData,
  EvidenceFindingsData,
} from '../types/reports.types';

export const useReports = (
  dateRange?: string,
  filters?: { caseType: string; priority: string; investigator: string },
): ReturnType<typeof useQuery<ReportsData>> =>
  useQuery<ReportsData>({
    queryKey: ['reports', dateRange, filters],
    queryFn: async () =>
      await reportsService.getReportsData(dateRange, filters),
    staleTime: 0, // Force fresh data for debugging
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });

export const useCaseStatusStats = (): ReturnType<typeof useQuery> =>
  useQuery({
    queryKey: ['reports', 'stats'],
    queryFn: async () => await reportsService.getReportsData(),
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
  });

export const useInvestigatorWorkload = (dateRange?: string): ReturnType<typeof useQuery<InvestigatorWorkloadData>> =>
  useQuery<InvestigatorWorkloadData>({
    queryKey: ['reports', 'investigator-workload', dateRange],
    queryFn: async () =>
      await reportsService.getInvestigatorWorkloadData(dateRange),
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });

export const useTaskCompletion = (dateRange?: string): ReturnType<typeof useQuery<TaskCompletionData>> =>
  useQuery<TaskCompletionData>({
    queryKey: ['reports', 'task-completion', dateRange],
    queryFn: async () => await reportsService.getTaskCompletionData(dateRange),
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });

export const useAuditLogs = (dateRange?: string): ReturnType<typeof useQuery<AuditLogsData>> =>
  useQuery<AuditLogsData>({
    queryKey: ['reports', 'audit-logs', dateRange],
    queryFn: async () => await reportsService.getAuditLogsData(dateRange),
    staleTime: 1000 * 60 * 5,
    refetchInterval: 1000 * 60 * 5,
    refetchOnWindowFocus: true,
    retry: 1,
  });

export const useCaseAgeing = (dateRange?: string): ReturnType<typeof useQuery<CaseAgeingData>> =>
  useQuery<CaseAgeingData>({
    queryKey: ['reports', 'case-ageing', dateRange],
    queryFn: async () => await reportsService.getCaseAgeingData(dateRange),
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });

export const useEvidenceFindings = (dateRange?: string): ReturnType<typeof useQuery<EvidenceFindingsData>> =>
  useQuery<EvidenceFindingsData>({
    queryKey: ['reports', 'evidence-findings', dateRange],
    queryFn: async () =>
      await reportsService.getEvidenceFindingsData(dateRange),
    staleTime: 1000 * 60 * 10,
    refetchInterval: 1000 * 60 * 10,
    refetchOnWindowFocus: true,
  });
