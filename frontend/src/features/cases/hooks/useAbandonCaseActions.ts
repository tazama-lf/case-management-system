import { caseService, type AbandonCaseDto } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useAbandonCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleAbandonSubmit = async (caseId: string, reason: string) => {
    try {
      const abandonCaseData: AbandonCaseDto = {
        reason: reason.trim()
      };

      const abandonedCase = await caseService.abandonCase(caseId, abandonCaseData);

      success('Case Abandoned Successfully', `Case ${caseId} has been abandoned as requested.

Reason: ${reason}
Status: ${abandonedCase.status}

The case has been removed from active investigations and won't appear in your queue anymore.`);

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Something went wrong while abandoning the case. Please try again.';
      const backendError = err instanceof Error ? err.message : '';
      
      if (backendError.includes('Cannot abandon case other than draft status')) {
        errorMessage = `Unable to abandon this case.

This case can't be abandoned because it's no longer in draft status. You can only abandon cases that haven't been started yet.

Technical details: ${backendError}`;
      } else if (backendError.includes('No complete new Case Task exists')) {
        errorMessage = `Unable to abandon this case.

The case needs to be in draft status with a pending "Complete New Case" task to be abandoned.

Technical details: ${backendError}`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied.

You don't have permission to abandon this case. Please check that you have the right access level.

Technical details: ${backendError}`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found.

This case may have been moved, deleted, or you may not have access to it.

Technical details: ${backendError}`;
      } else if (backendError) {
        errorMessage = `${backendError}

If this problem persists, please contact support.`;
      }

      error('Abandon Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleAbandonSubmit,
  };
};