/* eslint-disable @typescript-eslint/explicit-function-return-type -- React Query hooks have complex inferred return types, matching useEvidence.ts's convention */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { investigatorService } from '../services/investigatorService';
import type { BlocklistCaseInvestigatorDto } from '../types/investigator.types';

export const investigatorKeys = {
  all: ['case-investigators'] as const,
  allowlist: (caseId: number) =>
    [...investigatorKeys.all, 'allowlist', caseId] as const,
  blocklist: (caseId: number) =>
    [...investigatorKeys.all, 'blocklist', caseId] as const,
  history: (caseId: number) =>
    [...investigatorKeys.all, 'history', caseId] as const,
};

/**
 * Hook to fetch a case's live allowlist (CaseInvestigator rows). Supervisor+
 * there is no viewer tier below supervisor for this endpoint at all.
 */
export const useCaseInvestigators = (caseId: number, enabled = true) =>
  useQuery({
    queryKey: investigatorKeys.allowlist(caseId),
    queryFn: async () => await investigatorService.getCaseInvestigators(caseId),
    enabled: enabled && !!caseId,
    staleTime: 30 * 1000,
  });

/** Hook to fetch a case's blocklist. */
export const useCaseBlocklist = (caseId: number, enabled = true) =>
  useQuery({
    queryKey: investigatorKeys.blocklist(caseId),
    queryFn: async () => await investigatorService.getCaseBlocklist(caseId),
    enabled: enabled && !!caseId,
    staleTime: 30 * 1000,
  });

/**
 * Hook to fetch a case's access history: who was revoked (manually or by reassignment) and who
 * was unblocked. Those rows are kept, but the live lists above only show current state.
 */
export const useCaseAccessHistory = (caseId: number, enabled = true) =>
  useQuery({
    queryKey: investigatorKeys.history(caseId),
    queryFn: async () => await investigatorService.getCaseAccessHistory(caseId),
    enabled: enabled && !!caseId,
    staleTime: 30 * 1000,
  });

// No useAddInvestigator — there is no allowlist add endpoint. The
// allowlist is populated exclusively by task assignment; nobody, including a supervisor, adds to it by hand.

/** Revoke from the allowlist. Supervisor+ only, mandatory reason. */
export const useRevokeInvestigator = (caseId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      reason,
    }: {
      userId: string;
      reason: string;
    }) => {
      await investigatorService.revokeInvestigator(caseId, userId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: investigatorKeys.allowlist(caseId),
      });
      queryClient.invalidateQueries({
        queryKey: investigatorKeys.history(caseId),
      });
      toast.success('Investigator revoked');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revoke investigator');
    },
  });
};

/**
 * Blocklist. Supervisor+ only, mandatory reason. Auto-revokes any live
 * allowlist row server-side, so invalidate both query keys.
 */
export const useBlocklistInvestigator = (caseId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: BlocklistCaseInvestigatorDto) =>
      await investigatorService.blocklistInvestigator(caseId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: investigatorKeys.allowlist(caseId),
      });
      queryClient.invalidateQueries({
        queryKey: investigatorKeys.blocklist(caseId),
      });
      queryClient.invalidateQueries({
        queryKey: investigatorKeys.history(caseId),
      });
      toast.success('Investigator blocklisted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to blocklist investigator');
    },
  });
};

/**
 * Unblock. Supervisor+ only, mandatory reason. Does NOT grant access back
 * - a subsequent add-to-allowlist is still required, so this
 * only invalidates the blocklist list, not the allowlist one.
 */
export const useUnblockInvestigator = (caseId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      reason,
    }: {
      userId: string;
      reason: string;
    }) => {
      await investigatorService.unblockInvestigator(caseId, userId, reason);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: investigatorKeys.blocklist(caseId),
      });
      queryClient.invalidateQueries({
        queryKey: investigatorKeys.history(caseId),
      });
      toast.success(
        'Investigator unblocked — they still need to be re-added to regain access',
      );
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to unblock investigator');
    },
  });
};
/* eslint-enable @typescript-eslint/explicit-function-return-type */
