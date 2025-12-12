import { caseService, type AbandonCaseDto } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useAbandonCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleAbandonSubmit = async (caseId: number, reason: string) => {
    try {
      const abandonCaseData: AbandonCaseDto = {
        reason: reason.trim()
      };

      await caseService.abandonCase(caseId, abandonCaseData);

      success('Case Abandoned', `Case ${caseId} abandoned. Reason: ${reason}`); await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not abandon case.';
      const backendError = err instanceof Error ? err.message : '';
      if (backendError.includes('Cannot abandon case other than draft status')) {
        errorMessage = `Cannot abandon case (not draft). (${backendError})`;
      } else if (backendError.includes('No complete new Case Task exists')) {
        errorMessage = `Cannot abandon case (pending task). (${backendError})`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied. (${backendError})`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found. (${backendError})`;
      } else if (backendError) {
        errorMessage = `${backendError}`;
      }
      error('Abandon Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleAbandonSubmit,
  };
};