import type { CloseCaseDto } from '../services/caseService';
import { caseService } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useCloseCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleCloseCaseSubmit = async (caseId: string, data: CloseCaseDto) => {
    try {
      const response = await caseService.closeCase(caseId, data);

      success('Investigation Complete', `Great work! Case ${caseId} has been submitted for supervisor review.

Your investigation findings have been forwarded and the supervisor will review your work shortly.

What happens next:
• Supervisor reviews your investigation
• Final outcome decision will be made
• You'll be notified of the result

Status: ${response.closed_case.status}`);

      await refreshCases();

    } catch (err) {
      let errorMessage = 'Oops! Something went wrong while closing the case. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in a closeable state')) {
        errorMessage = `Hold on! This case can't be closed right now.

Here's what might be happening:
• The case isn't ready for closure yet
• You might not be the assigned investigator
• There could be pending tasks to complete

Please double-check the case status and try again.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Sorry, you don't have permission to close this case.

Make sure you're the assigned investigator for this case.`;
      } else if (errorString.includes('404')) {
        errorMessage = `Hmm, we can't find this case. It might have been moved or deleted.`;
      }

      error('Close Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleCloseCaseSubmit,
  };
};