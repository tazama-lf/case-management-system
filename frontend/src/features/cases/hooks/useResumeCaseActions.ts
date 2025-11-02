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
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in a resumable state')) {
        errorMessage = `This case can't be resumed right now.

The case needs to be in suspended status to be resumed. Please check the case status and try again.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Sorry, you don't have permission to resume this case.

Please check that you have the right access level.`;
      } else if (errorString.includes('404')) {
        errorMessage = `We can't find this case. It might have been moved or deleted.`;
      }

      error('Resume Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleResumeSubmit,
  };
};