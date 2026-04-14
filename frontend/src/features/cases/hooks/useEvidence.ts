import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evidenceService } from '../services/evidenceService';
import type {
  VerifyEvidenceDto,
  EvidenceSearchFilters,
} from '../types/evidence.types';
import toast from 'react-hot-toast';

export const evidenceKeys = {
  all: ['evidence'] as const,
  lists: () => [...evidenceKeys.all, 'list'] as const,
  list: (caseId: number, filters?: EvidenceSearchFilters) =>
    [...evidenceKeys.lists(), caseId, filters] as const,
  details: () => [...evidenceKeys.all, 'detail'] as const,
  detail: (id: string) => [...evidenceKeys.details(), id] as const,
  statistics: (caseId: number) =>
    [...evidenceKeys.all, 'statistics', caseId] as const,
  auditLog: (evidenceId: string) =>
    [...evidenceKeys.all, 'audit-log', evidenceId] as const,
  search: (filters: EvidenceSearchFilters) =>
    [...evidenceKeys.all, 'search', filters] as const,
};

/**
 * Hook to fetch case evidence list
 */
export const useCaseEvidence = (
  caseId: number,
  filters?: EvidenceSearchFilters,
  enabled = true,
) =>
  useQuery({
    queryKey: evidenceKeys.list(caseId, filters),
    queryFn: async () => await evidenceService.getCaseEvidence(caseId),
    enabled: enabled && !!caseId,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

/**
 * Hook to fetch evidence details
 */
export const useEvidenceDetails = (evidenceId: string, enabled = true) =>
  useQuery({
    queryKey: evidenceKeys.detail(evidenceId),
    queryFn: async () => await evidenceService.getEvidenceById(evidenceId),
    enabled: enabled && !!evidenceId,
  });

/**
 * Hook to verify evidence integrity
 */
export const useVerifyEvidence = (caseId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: VerifyEvidenceDto) =>
      await evidenceService.verifyEvidence(data.evidenceId),
    onSuccess: (response) => {
      queryClient.invalidateQueries({
        queryKey: evidenceKeys.detail(response.evidenceId),
      });
      queryClient.invalidateQueries({
        queryKey: evidenceKeys.list(caseId, undefined),
      });

      if (response.expectedHash) {
        toast.success('Evidence integrity verified successfully');
      } else {
        toast.error('Evidence integrity check failed - hash mismatch!');
      }
    },
    onError: (error: Error) => {
      toast.error(`Verification failed: ${error.message}`);
    },
  });
};

/**
 * Hook to search evidence across cases
 */
export const useSearchEvidence = (
  filters: EvidenceSearchFilters,
  page = 1,
  limit = 20,
  enabled = true,
) =>
  useQuery({
    queryKey: evidenceKeys.search(filters),
    queryFn: async () =>
      await evidenceService.searchEvidence(filters, page, limit),
    enabled,
    staleTime: 2 * 60 * 1000,
  });
