import { useQuery } from '@tanstack/react-query';
import { caseService } from '../services/caseService';
import type { Case } from '../../alerts/types/triage.types';
import type { GetUserCasesQueryDto, GetUserCasesResponseDto, UserWorkloadStatsDto } from '../services/caseService';

export const useCase = (caseId: number | undefined) => {
  return useQuery<Case, Error>({
    queryKey: ['case', caseId],
    queryFn: () => {
      if (!caseId) {
        throw new Error('Case ID is required');
      }
      return caseService.getCaseDetails(caseId);
    },
    enabled: !!caseId,
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};

export const useUserCases = (query?: GetUserCasesQueryDto) => {
  return useQuery<GetUserCasesResponseDto, Error>({
    queryKey: ['userCases', query],
    queryFn: () => caseService.getUserCases(query),
    staleTime: 2 * 60 * 1000,
    retry: 2,
  });
};

export const useUserWorkloadStats = () => {
  return useQuery<UserWorkloadStatsDto, Error>({
    queryKey: ['userWorkloadStats'],
    queryFn: () => caseService.getUserWorkloadStats(),
    staleTime: 5 * 60 * 1000,
    retry: 2,
  });
};

export const canActOnCase = (caseStatus: string | undefined): boolean => {
  if (!caseStatus) return false;

  const closedStatuses = [
    'STATUS_82_CLOSED_CONFIRMED',
    'STATUS_81_CLOSED_REFUTED',
    'STATUS_83_CLOSED_INCONCLUSIVE'
  ];

  return !closedStatuses.includes(caseStatus);
};
