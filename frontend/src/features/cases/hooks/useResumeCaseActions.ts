import { caseService, type ResumeCaseDto } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useResumeCaseActions = (
  refreshCases: () => Promise<void>,
): {
  handleResumeSubmit: (caseId: number, reason: string) => Promise<void>;
} => {
  const { success, error } = useToast();

  const handleResumeSubmit = async (caseId: number, reason: string): Promise<void> => {
    try {
      const resumeCaseData: ResumeCaseDto = {
        reason: reason.trim(),
      };

      await caseService.resumeCase(caseId, resumeCaseData);

      success('Case Resumed', `Case ${caseId} resumed. Reason: ${reason}`);
      await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not resume case.';
      const backendError = err instanceof Error ? err.message : '';
      if (backendError.includes('not in a resumable state')) {
        errorMessage = `Cannot resume case (not suspended). (${backendError})`;
      } else if (
        backendError.includes('Unauthorized') ||
        backendError.includes('403')
      ) {
        errorMessage = `Access denied. (${backendError})`;
      } else if (
        backendError.includes('not found') ||
        backendError.includes('404')
      ) {
        errorMessage = `Case not found. (${backendError})`;
      } else if (backendError) {
        errorMessage = backendError;
      }
      error('Resume Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleResumeSubmit,
  };
};
