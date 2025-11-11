import { caseService, type ResumeCaseDto } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useResumeCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleResumeSubmit = async (caseId: string, reason: string) => {
    try {
      const resumeCaseData: ResumeCaseDto = {
        reason: reason.trim()
      };

      const resumedCase = await caseService.resumeCase(caseId, resumeCaseData);

      success('Case Resumed', `Great! Case ${caseId} is back in action.

Reason: ${reason}
Status: ${resumedCase.status}

The case has been moved back to your active queue and you can continue your investigation.`);

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Something went wrong while resuming the case. Please try again.';
      const backendError = err instanceof Error ? err.message : '';
      
      if (backendError.includes('not in a resumable state')) {
        errorMessage = `Unable to resume this case right now.

This case needs to be in suspended status to be resumed. Please check the case status and try again.

Technical details: ${backendError}`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied.

You don't have permission to resume this case. Please check that you have the right access level.

Technical details: ${backendError}`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found.

This case may have been moved, deleted, or you may not have access to it.

Technical details: ${backendError}`;
      } else if (backendError) {
        errorMessage = `${backendError}

If this problem persists, please contact support.`;
      }

      error('Resume Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleResumeSubmit,
  };
};