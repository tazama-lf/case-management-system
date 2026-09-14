/* eslint-disable @typescript-eslint/explicit-function-return-type -- React Query hooks have complex inferred return types, matching useEvidence.ts's convention */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { investigatorService } from '../services/investigatorService';
import type { BlacklistCaseInvestigatorDto } from '../types/investigator.types';

export const investigatorKeys = {
  all: ['case-investigators'] as const,
  whitelist: (caseId: number) =>
    [...investigatorKeys.all, 'whitelist', caseId] as const,
  blacklist: (caseId: number) =>
    [...investigatorKeys.all, 'blacklist', caseId] as const,
};

/**
 * Hook to fetch a case's live whitelist (CaseInvestigator rows). Supervisor+
 * there is no viewer tier below supervisor for this endpoint at all.
 */
export const useCaseInvestigators = (caseId: number, enabled = true) =>
  useQuery({
    queryKey: investigatorKeys.whitelist(caseId),
    queryFn: async () => await investigatorService.getCaseInvestigators(caseId),
    enabled: enabled && !!caseId,
    staleTime: 30 * 1000,
  });

/** Hook to fetch a case's blacklist. */
export const useCaseBlacklist = (caseId: number, enabled = true) =>
  useQuery({
    queryKey: investigatorKeys.blacklist(caseId),
    queryFn: async () => await investigatorService.getCaseBlacklist(caseId),
    enabled: enabled && !!caseId,
    staleTime: 30 * 1000,
  });

// No useAddInvestigator — there is no whitelist add endpoint. The
// whitelist is populated exclusively by task assignment (plan §3,
// task-only); nobody, including a supervisor, adds to it by hand.

/** Revoke from the whitelist. Supervisor+ only, mandatory reason. */
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
        queryKey: investigatorKeys.whitelist(caseId),
      });
      toast.success('Investigator revoked');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to revoke investigator');
    },
  });
};

/**
 * Blacklist. Supervisor+ only, mandatory reason. Auto-revokes any live
 * whitelist row server-side, so invalidate both query keys.
 */
export const useBlacklistInvestigator = (caseId: number) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (dto: BlacklistCaseInvestigatorDto) =>
      await investigatorService.blacklistInvestigator(caseId, dto),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: investigatorKeys.whitelist(caseId),
      });
      queryClient.invalidateQueries({
        queryKey: investigatorKeys.blacklist(caseId),
      });
      toast.success('Investigator blacklisted');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to blacklist investigator');
    },
  });
};

/**
 * Unblock. Supervisor+ only, mandatory reason. Does NOT grant access back
 * — a subsequent add-to-whitelist is still required, so this
 * only invalidates the blacklist list, not the whitelist one.
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
        queryKey: investigatorKeys.blacklist(caseId),
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
