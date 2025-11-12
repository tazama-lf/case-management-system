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
      let errorMessage = 'Something went wrong while closing the case. Please try again.';
      const backendError = err instanceof Error ? err.message : '';
      
      if (backendError.includes('Investigation task is not completed')) {
        errorMessage = `Investigation task must be completed first.

Before closing a case, you need to:
• Complete your investigation task 
• Mark the investigation status as "COMPLETED"
• Go to Work Queue or view the case to find pending tasks

The investigation task needs to have status "STATUS_30_COMPLETED" to close the case.

Technical details: ${backendError}`;
      } else if (backendError.includes('not in a closeable state')) {
        errorMessage = `Unable to close this case right now.

This usually means:
• The case isn't ready for closure yet
• You might not be the assigned investigator
• There could be pending tasks to complete

Please double-check the case status and try again.

Technical details: ${backendError}`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied.

You don't have permission to close this case. Make sure you're the assigned investigator.

Technical details: ${backendError}`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found.

This case may have been moved, deleted, or you may not have access to it.

Technical details: ${backendError}`;
      } else if (backendError) {
        errorMessage = `${backendError}

If this problem persists, please contact support.`;
      }

      error('Close Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleCloseCaseSubmit,
  };
};