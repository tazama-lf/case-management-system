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

      success('Reopening Request Submitted', `Your request to reopen case ${caseId} has been submitted.

Reason: ${reason}

Your request will be reviewed by a supervisor and you'll be notified of the decision.`);

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Something went wrong while submitting the reopening request. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in a reopenable state')) {
        errorMessage = `This case can't be reopened right now.

The case needs to be in closed status and not already pending reopening. Please check the case status.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Sorry, you don't have permission to request case reopening.

Please check that you have the right access level.`;
      } else if (errorString.includes('404')) {
        errorMessage = `We can't find this case. It might have been moved or deleted.`;
      }

      error('Reopen Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleReopenSubmit,
  };
};