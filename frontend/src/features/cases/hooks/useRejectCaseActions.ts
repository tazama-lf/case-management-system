import { caseService, type RejectCaseCreationDto, type RejectCaseDto } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useRejectCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleRejectCaseCreation = async (caseId: string, reason: string) => {
    try {
      const rejectCaseData: RejectCaseCreationDto = {
        reason: reason.trim()
      };

      const rejectedCase = await caseService.rejectCaseCreation(caseId, rejectCaseData);

      success('Case Creation Rejected', `Case ${caseId} creation has been declined.

Reason: ${reason}
Status: ${rejectedCase.status}

The case creator will be notified of your decision and the reasoning provided.`);

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Something went wrong while rejecting the case creation. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in a rejectable state')) {
        errorMessage = `This case creation can't be rejected right now.

The case might not be waiting for approval. Please check if there's a pending creation task for your review.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Sorry, you don't have permission to reject case creation.

Please check that you have supervisor privileges.`;
      } else if (errorString.includes('404')) {
        errorMessage = `We can't find this case. It might have been moved or deleted.`;
      }

      error('Reject Case Creation Failed', errorMessage);
      throw err;
    }
  };

  const handleRejectCase = async (caseId: string, rejectionReason: string) => {
    try {
      const rejectCaseData: RejectCaseDto = {
        rejectionReason: rejectionReason.trim()
      };

      const rejectedCase = await caseService.rejectCase(caseId, rejectCaseData);

      success('Case Rejected', `Case ${caseId} has been rejected.

Reason: ${rejectionReason}
Status: ${rejectedCase.status}

The case has been declined and moved out of the active queue.`);

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Something went wrong while rejecting the case. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in a rejectable state')) {
        errorMessage = `This case can't be rejected right now.

Please check the case status and ensure it's in a state that allows rejection.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Sorry, you don't have permission to reject this case.

Please check that you have the right access level.`;
      } else if (errorString.includes('404')) {
        errorMessage = `We can't find this case. It might have been moved or deleted.`;
      }

      error('Reject Case Failed', errorMessage);
      throw err;
    }
  };

  const handleRejectReopening = async (caseId: string, rejectionReason: string) => {
    try {
      const result = await caseService.rejectCaseReopening(caseId, rejectionReason);

      success('Case Reopening Rejected', `Case ${caseId} reopening has been declined.

Reason: ${rejectionReason}
${result.message}

The requester will be notified of your decision.`);

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Something went wrong while rejecting the case reopening. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Sorry, you don't have permission to reject case reopening.

Please check that you have supervisor privileges.`;
      } else if (errorString.includes('404')) {
        errorMessage = `We can't find this case. It might have been moved or deleted.`;
      }

      error('Reject Case Reopening Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleRejectCaseCreation,
    handleRejectCase,
    handleRejectReopening,
  };
};