/**
 * React Query Hooks for Sanctions Screening
 * Manages server state for sanctions screening operations
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import type {
  SanctionsScreening,
  CreateSanctionsScreeningDto,
  UpdateSanctionsScreeningDto,
  SanctionsScreeningFilters,
} from '../types/sanctions.types';
import * as sanctionsService from '../services/sanctionsService';

// Query Keys
export const sanctionsKeys = {
  all: ['sanctions-screenings'] as const,
  lists: () => [...sanctionsKeys.all, 'list'] as const,
  list: (caseId: string, filters?: SanctionsScreeningFilters) =>
    [...sanctionsKeys.lists(), caseId, filters] as const,
  details: () => [...sanctionsKeys.all, 'detail'] as const,
  detail: (id: string) => [...sanctionsKeys.details(), id] as const,
  statistics: (caseId: string) =>
    [...sanctionsKeys.all, 'statistics', caseId] as const,
  auditLogs: (screeningId: string) =>
    [...sanctionsKeys.all, 'audit', screeningId] as const,
  search: (filters: SanctionsScreeningFilters) =>
    [...sanctionsKeys.all, 'search', filters] as const,
};

/**
 * Hook to fetch all sanctions screenings for a case
 */
export const useCaseSanctionsScreenings = (
  caseId: string,
  filters?: SanctionsScreeningFilters,
) => {
  return useQuery({
    queryKey: sanctionsKeys.list(caseId, filters),
    queryFn: () => sanctionsService.getCaseSanctionsScreenings(caseId, filters),
    staleTime: 2 * 60 * 1000, // 2 minutes
    enabled: !!caseId,
  });
};

/**
 * Hook to fetch a single sanctions screening
 */
export const useSanctionsScreening = (screeningId: string) => {
  return useQuery({
    queryKey: sanctionsKeys.detail(screeningId),
    queryFn: () => sanctionsService.getSanctionsScreening(screeningId),
    staleTime: 2 * 60 * 1000,
    enabled: !!screeningId,
  });
};

/**
 * Hook to create a new sanctions screening
 */
export const useCreateSanctionsScreening = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateSanctionsScreeningDto) =>
      sanctionsService.createSanctionsScreening(data),
    onSuccess: (_response, variables) => {
      // Invalidate and refetch case screenings list
      queryClient.invalidateQueries({
        queryKey: sanctionsKeys.list(variables.case_id),
      });

      // Invalidate statistics
      queryClient.invalidateQueries({
        queryKey: sanctionsKeys.statistics(variables.case_id),
      });

      toast.success('Sanctions screening uploaded successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to upload screening: ${error.message}`);
    },
  });
};

/**
 * Hook to update an existing sanctions screening
 */
export const useUpdateSanctionsScreening = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: UpdateSanctionsScreeningDto) =>
      sanctionsService.updateSanctionsScreening(data),
    onSuccess: (response) => {
      const screening = response.screening;

      // Update the specific screening in cache
      queryClient.setQueryData<SanctionsScreening>(
        sanctionsKeys.detail(screening.screening_id),
        screening,
      );

      // Invalidate the list
      queryClient.invalidateQueries({
        queryKey: sanctionsKeys.list(screening.case_id),
      });

      toast.success('Sanctions screening updated successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update screening: ${error.message}`);
    },
  });
};

/**
 * Hook to delete a sanctions screening
 */
export const useDeleteSanctionsScreening = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (screeningId: string) =>
      sanctionsService.deleteSanctionsScreening(screeningId),
    onSuccess: (response) => {
      // Invalidate all lists (we don't have case_id here)
      queryClient.invalidateQueries({
        queryKey: sanctionsKeys.lists(),
      });

      // Remove from detail cache
      queryClient.removeQueries({
        queryKey: sanctionsKeys.detail(response.screening_id),
      });

      toast.success('Sanctions screening deleted successfully');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete screening: ${error.message}`);
    },
  });
};

/**
 * Hook to download sanctions report
 */
export const useDownloadSanctionsReport = () => {
  return useMutation({
    mutationFn: (screeningId: string) =>
      sanctionsService.downloadSanctionsReport(screeningId),
    onSuccess: () => {
      toast.success('Download started');
    },
    onError: (error: Error) => {
      toast.error(`Failed to download report: ${error.message}`);
    },
  });
};

/**
 * Hook to fetch audit logs for a screening
 */
export const useSanctionsScreeningAuditLogs = (screeningId: string) => {
  return useQuery({
    queryKey: sanctionsKeys.auditLogs(screeningId),
    queryFn: () => sanctionsService.getSanctionsScreeningAuditLogs(screeningId),
    staleTime: 1 * 60 * 1000, // 1 minute
    enabled: !!screeningId,
  });
};

/**
 * Hook to fetch statistics for a case
 */
export const useCaseSanctionsStatistics = (caseId: string) => {
  return useQuery({
    queryKey: sanctionsKeys.statistics(caseId),
    queryFn: () => sanctionsService.getCaseSanctionsStatistics(caseId),
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!caseId,
  });
};

/**
 * Hook to search sanctions screenings across all cases
 */
export const useSearchSanctionsScreenings = (
  filters: SanctionsScreeningFilters,
  page = 1,
  limit = 20,
) => {
  return useQuery({
    queryKey: sanctionsKeys.search(filters),
    queryFn: () =>
      sanctionsService.searchSanctionsScreenings(filters, page, limit),
    staleTime: 2 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });
};
