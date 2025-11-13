import { caseService } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useReopenCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleReopenSubmit = async (caseId: string, reason: string) => {
    try {
      const reopenCaseData = {
        reason: reason.trim(),
      };

      await caseService.reopenCase(caseId, reopenCaseData);

      success(
        'Reopening Request Submitted',
        `Your request to reopen case ${caseId} has been submitted.

Reason: ${reason}

Your request will be reviewed by a supervisor and you'll be notified of the decision.`,
      );

      await refreshCases();
    } catch (err) {
      let errorMessage =
        'Something went wrong while submitting the reopening request. Please try again.';
      const backendError = err instanceof Error ? err.message : '';

      if (backendError.includes('not in a reopenable state')) {
        errorMessage = `Unable to request reopening for this case.

This case needs to be in closed status and not already pending reopening. Please check the case status.

Technical details: ${backendError}`;
      } else if (
        backendError.includes('Unauthorized') ||
        backendError.includes('403')
      ) {
        errorMessage = `Access denied.

You don't have permission to request case reopening. Please check that you have the right access level.

Technical details: ${backendError}`;
      } else if (
        backendError.includes('not found') ||
        backendError.includes('404')
      ) {
        errorMessage = `Case not found.

This case may have been moved, deleted, or you may not have access to it.

Technical details: ${backendError}`;
      } else if (backendError) {
        errorMessage = `${backendError}

If this problem persists, please contact support.`;
      }

      error('Reopen Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleReopenSubmit,
  };
};
