import { caseService, type SuspendCaseDto } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useSuspendCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleSuspendSubmit = async (caseId: string, reason: string) => {
    try {
      const suspendCaseData: SuspendCaseDto = {
        reason: reason.trim(),
      };

      const suspendedCase = await caseService.suspendCase(
        caseId,
        suspendCaseData,
      );

      success(
        'Case Suspended',
        `Case ${caseId} has been put on hold.

Reason: ${reason}
Status: ${suspendedCase.status}

The case is now paused and won't appear in your active queue. You can resume it anytime from the suspended cases list.`,
      );

      await refreshCases();
    } catch (err) {
      let errorMessage =
        'Something went wrong while suspending the case. Please try again.';
      const backendError = err instanceof Error ? err.message : '';

      if (backendError.includes('not in a suspendable state')) {
        errorMessage = `Unable to suspend this case right now.

This case needs to be actively in progress to be suspended. Please check the case status and try again.

Technical details: ${backendError}`;
      } else if (
        backendError.includes('Unauthorized') ||
        backendError.includes('403')
      ) {
        errorMessage = `Access denied.

You don't have permission to suspend this case. Please check that you have the right access level.

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

      error('Suspend Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleSuspendSubmit,
  };
};
