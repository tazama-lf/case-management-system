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
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in a returnable state')) {
        errorMessage = `This case can't be returned for review right now.

Please check the case status and ensure it's ready for review feedback.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Sorry, you don't have permission to return this case for review.

Please check that you have supervisor privileges.`;
      } else if (errorString.includes('404')) {
        errorMessage = `We can't find this case. It might have been moved or deleted.`;
      }

      error('Return Case for Review Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleReturnForReview,
  };
};