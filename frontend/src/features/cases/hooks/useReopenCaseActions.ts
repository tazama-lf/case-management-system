import { caseService } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useReopenCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleReopenSubmit = async (caseId: string, reason: string) => {
    try {
      const reopenCaseData = {
        reason: reason.trim()
      };

      await caseService.reopenCase(caseId, reopenCaseData);

  success('Reopen Request Submitted', `Reopen request for case ${caseId} submitted. Reason: ${reason}`);

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not submit reopen request.';
      const backendError = err instanceof Error ? err.message : '';
      if (backendError.includes('not in a reopenable state')) {
        errorMessage = `Cannot reopen case (not closed). (${backendError})`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied. (${backendError})`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found. (${backendError})`;
      } else if (backendError) {
        errorMessage = `${backendError}`;
      }
      error('Reopen Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleReopenSubmit,
  };
};