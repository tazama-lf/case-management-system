import { caseService, type ReturnCaseForReviewDto } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useReturnCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleReturnForReview = async (caseId: string, reviewComments: string) => {
    try {
      const returnCaseData: ReturnCaseForReviewDto = {
        reviewComments: reviewComments.trim()
      };

      const returnedCase = await caseService.returnCaseForReview(caseId, returnCaseData);

      success('Case Returned for Review', `Case ${caseId} has been sent back for additional review.

Your Comments: ${reviewComments}
Status: ${returnedCase.status}

The investigator will receive your feedback and can make the necessary adjustments.`);

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Something went wrong while returning the case for review. Please try again.';
      const backendError = err instanceof Error ? err.message : '';
      
      if (backendError.includes('not in a returnable state')) {
        errorMessage = `Unable to return this case for review right now.

Please check the case status and ensure it's ready for review feedback.

Technical details: ${backendError}`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied.

You don't have permission to return this case for review. Please check that you have supervisor privileges.

Technical details: ${backendError}`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found.

This case may have been moved, deleted, or you may not have access to it.

Technical details: ${backendError}`;
      } else if (backendError) {
        errorMessage = `${backendError}

If this problem persists, please contact support.`;
      }

      error('Return Case for Review Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleReturnForReview,
  };
};