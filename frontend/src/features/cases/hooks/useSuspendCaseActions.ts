import { caseService, type SuspendCaseDto } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useSuspendCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleSuspendSubmit = async (caseId: string, reason: string) => {
    try {
      const suspendCaseData: SuspendCaseDto = {
        reason: reason.trim()
      };

      const suspendedCase = await caseService.suspendCase(caseId, suspendCaseData);

      success('Case Suspended', `Case ${caseId} has been put on hold.

Reason: ${reason}
Status: ${suspendedCase.status}

The case is now paused and won't appear in your active queue. You can resume it anytime from the suspended cases list.`);

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Something went wrong while suspending the case. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in a suspendable state')) {
        errorMessage = `This case can't be suspended right now.

The case needs to be actively in progress to be suspended. Please check the case status and try again.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Sorry, you don't have permission to suspend this case.

Please check that you have the right access level.`;
      } else if (errorString.includes('404')) {
        errorMessage = `We can't find this case. It might have been moved or deleted.`;
      }

      error('Suspend Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleSuspendSubmit,
  };
};