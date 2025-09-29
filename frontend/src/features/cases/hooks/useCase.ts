import { useQuery } from '@tanstack/react-query';
import { caseService } from '../services/caseService';
import type { Case } from '../../alerts/types/triage.types';

export const useCase = (caseId: string | undefined) => {
  return useQuery<Case, Error>({
    queryKey: ['case', caseId],
    queryFn: () => {
      if (!caseId) {
        throw new Error('Case ID is required');
      }
      return caseService.getCaseDetails(caseId);
    },
    enabled: !!caseId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 2,
  });
};

// Helper function to check if a case can be acted upon (updated/closed)
export const canActOnCase = (caseStatus: string | undefined): boolean => {
  if (!caseStatus) return false;
  
  // Based on backend logic in triage.service.ts manualCloseAlert method
  const closedStatuses = [
    'STATUS_82_CLOSED_CONFIRMED',
    'STATUS_81_CLOSED_REFUTED', 
    'STATUS_83_CLOSED_INCONCLUSIVE'
  ];
  
  return !closedStatuses.includes(caseStatus);
};
