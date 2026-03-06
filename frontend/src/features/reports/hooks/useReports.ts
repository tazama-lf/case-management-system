import { useQuery } from '@tanstack/react-query';
import { ReportsService } from '../services/reportsService';
import type {
  ReportsData,
  InvestigatorWorkloadData,
  TaskCompletionData,
  AuditLogsData,
  CaseAgeingData,
  EvidenceFindingsData,
} from '../types/reports.types';
import { NO_CACHE, TEN_MINUTES, FIVE_MINUTES } from '@/shared/constants/timing';

export const useReports = (
  dateRange?: string,
  filters?: { caseType: string; priority: string; investigator: string },
): ReturnType<typeof useQuery<ReportsData>> =>
  useQuery<ReportsData>({
    queryKey: ['reports', dateRange, filters],
    queryFn: async () =>
      await ReportsService.getReportsData(dateRange, filters),
    staleTime: NO_CACHE, // Force fresh data for debugging
    refetchInterval: TEN_MINUTES,
    refetchOnWindowFocus: true,
  });

export const useCaseStatusStats = (): ReturnType<typeof useQuery> =>
  useQuery({
    queryKey: ['reports', 'stats'],
    queryFn: async () => await ReportsService.getReportsData(),
    staleTime: TEN_MINUTES,
    refetchInterval: TEN_MINUTES,
  });

export const useInvestigatorWorkload = (dateRange?: string): ReturnType<typeof useQuery<InvestigatorWorkloadData>> =>
  useQuery<InvestigatorWorkloadData>({
    queryKey: ['reports', 'investigator-workload', dateRange],
    queryFn: async () =>
      await ReportsService.getInvestigatorWorkloadData(dateRange),
    staleTime: TEN_MINUTES,
    refetchInterval: TEN_MINUTES,
    refetchOnWindowFocus: true,
  });

export const useTaskCompletion = (dateRange?: string): ReturnType<typeof useQuery<TaskCompletionData>> =>
  useQuery<TaskCompletionData>({
    queryKey: ['reports', 'task-completion', dateRange],
    queryFn: async () => await ReportsService.getTaskCompletionData(dateRange),
    staleTime: TEN_MINUTES,
    refetchInterval: TEN_MINUTES,
    refetchOnWindowFocus: true,
  });

export const useAuditLogs = (dateRange?: string): ReturnType<typeof useQuery<AuditLogsData>> =>
  useQuery<AuditLogsData>({
    queryKey: ['reports', 'audit-logs', dateRange],
    queryFn: async () => await ReportsService.getAuditLogsData(dateRange),
    staleTime: FIVE_MINUTES,
    refetchInterval: FIVE_MINUTES,
    refetchOnWindowFocus: true,
    retry: 1,
  });

export const useCaseAgeing = (dateRange?: string): ReturnType<typeof useQuery<CaseAgeingData>> =>
  useQuery<CaseAgeingData>({
    queryKey: ['reports', 'case-ageing', dateRange],
    queryFn: async () => await ReportsService.getCaseAgeingData(dateRange),
    staleTime: TEN_MINUTES,
    refetchInterval: TEN_MINUTES,
    refetchOnWindowFocus: true,
  });

export const useEvidenceFindings = (dateRange?: string): ReturnType<typeof useQuery<EvidenceFindingsData>> =>
  useQuery<EvidenceFindingsData>({
    queryKey: ['reports', 'evidence-findings', dateRange],
    queryFn: async () =>
      await ReportsService.getEvidenceFindingsData(dateRange),
    staleTime: TEN_MINUTES,
    refetchInterval: TEN_MINUTES,
    refetchOnWindowFocus: true,
  });
