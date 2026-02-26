import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { evidenceService } from '../services/evidenceService';
import type {
  UploadEvidenceDto,
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
 * Hook to fetch evidence statistics
 */
// export const useEvidenceStatistics = (
//   caseId: string,
//   enabled: boolean = true,
// ) => {
//   return useQuery({
//     queryKey: evidenceKeys.statistics(caseId),
//     queryFn: () => evidenceService.getCaseEvidenceStatistics(caseId),
//     enabled: enabled && !!caseId,
//     staleTime: 5 * 60 * 1000, // 5 minutes
//   });
// };

/**
 * Hook to fetch evidence audit log
 */
// export const useEvidenceAuditLog = (
//   evidenceId: string,
//   enabled: boolean = true,
// ) => {
//   return useQuery({
//     queryKey: evidenceKeys.auditLog(evidenceId),
//     queryFn: () => evidenceService.getEvidenceAuditLog(evidenceId),
//     enabled: enabled && !!evidenceId,
//   });
// };

/**
 * Hook to upload evidence
 */
// export const useUploadEvidence = (caseId: number) => {
//   const queryClient = useQueryClient();

//   return useMutation({
//     mutationFn: (data: UploadEvidenceDto) =>
//       evidenceService.uploadEvidence(data),
//     onSuccess: (response) => {
//       queryClient.invalidateQueries({
//         queryKey: evidenceKeys.list(caseId, undefined),
//       });
//       queryClient.invalidateQueries({
//         queryKey: evidenceKeys.statistics(caseId),
//       });
//       toast.success(
//         `Evidence "${response.evidence.file_name}" uploaded successfully`,
//       );
//     },
//     onError: (error: Error) => {
//       toast.error(`Upload failed: ${error.message}`);
//     },
//   });
// };

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
 * Hook to delete evidence
 */
// export const useDeleteEvidence = (caseId: string) => {
//   const queryClient = useQueryClient();

//   return useMutation({
//     mutationFn: ({
//       evidenceId,
//       reason,
//     }: {
//       evidenceId: string;
//       reason?: string;
//     }) => evidenceService.deleteEvidence(evidenceId, reason || ''),
//     onSuccess: () => {
//       queryClient.invalidateQueries({
//         queryKey: evidenceKeys.list(caseId, undefined),
//       });
//       queryClient.invalidateQueries({
//         queryKey: evidenceKeys.statistics(caseId),
//       });
//       toast.success('Evidence deleted successfully');
//     },
//     onError: (error: Error) => {
//       toast.error(`Delete failed: ${error.message}`);
//     },
//   });
// };

/**
 * Hook to update evidence metadata
 */
// export const useUpdateEvidenceMetadata = (caseId: string) => {
//   const queryClient = useQueryClient();

//   return useMutation({
//     mutationFn: ({
//       evidenceId,
//       updates,
//     }: {
//       evidenceId: string;
//       updates: Parameters<typeof evidenceService.updateEvidenceMetadata>[1];
//     }) => evidenceService.updateEvidenceMetadata(evidenceId, updates),
//     onSuccess: (evidence) => {
//       queryClient.invalidateQueries({
//         queryKey: evidenceKeys.detail(evidence.evidence_id),
//       });
//       queryClient.invalidateQueries({
//         queryKey: evidenceKeys.list(caseId, undefined),
//       });
//       toast.success('Evidence metadata updated successfully');
//     },
//     onError: (error: Error) => {
//       toast.error(`Update failed: ${error.message}`);
//     },
//   });
// };

/**
 * Hook to download evidence
 */
// export const useDownloadEvidence = () => {
//   return useMutation({
//     mutationFn: (evidenceId: string) =>
//       evidenceService.downloadEvidence(evidenceId),
//     onSuccess: (response) => {
//       // Trigger download
//       window.open(response.url, '_blank');
//       toast.success('Download started');
//     },
//     onError: (error: Error) => {
//       toast.error(`Download failed: ${error.message}`);
//     },
//   });
// };

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
