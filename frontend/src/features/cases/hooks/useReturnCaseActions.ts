import {
  caseService,
  type ReturnCaseForReviewDto,
} from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useReturnCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleReturnForReview = async (
    caseId: number,
    reviewComments: string,
  ) => {
    try {
      const returnCaseData: ReturnCaseForReviewDto = {
        reviewComments: reviewComments.trim(),
      };

      await caseService.returnCaseForReview(caseId, returnCaseData);

      success(
        'Case Returned for Review',
        `Case ${caseId} returned for review. Comments: ${reviewComments}`,
      );
      await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not return case for review.';
      const backendError = err instanceof Error ? err.message : '';
      if (backendError.includes('not in a returnable state')) {
        errorMessage = `Cannot return case for review. (${backendError})`;
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
      error('Return Case for Review Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleReturnForReview,
  };
};
