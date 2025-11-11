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
      const backendError = err instanceof Error ? err.message : '';
      
      if (backendError.includes('Approval task validation failed')) {
        errorMessage = `Unable to reject case creation right now.

This usually means:
• The case creation approval task isn't available
• The case may have already been approved or rejected
• There might be missing required information

Please refresh the page and check the current case status.

Technical details: ${backendError}`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found.

This case may have been moved, deleted, or you may not have access to it.

Technical details: ${backendError}`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied.

You don't have permission to reject case creation. Please check with your supervisor.

Technical details: ${backendError}`;
      } else if (backendError) {
        errorMessage = `${backendError}

If this problem persists, please contact support.`;
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
      const backendError = err instanceof Error ? err.message : '';
      
      if (backendError.includes('Approval task validation failed')) {
        errorMessage = `Unable to reject case right now.

This usually means:
• The case approval task isn't available
• The case may have already been approved or rejected
• There might be missing required information

Please refresh the page and check the current case status.

Technical details: ${backendError}`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found.

This case may have been moved, deleted, or you may not have access to it.

Technical details: ${backendError}`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied.

You don't have permission to reject this case. Please check with your supervisor.

Technical details: ${backendError}`;
      } else if (backendError) {
        errorMessage = `${backendError}

If this problem persists, please contact support.`;
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
      const backendError = err instanceof Error ? err.message : '';
      
      if (backendError.includes('Approval task validation failed')) {
        errorMessage = `Unable to reject case reopening right now.

This usually means:
• The reopening approval task isn't available
• The case may have already been approved for reopening or rejected
• There might be missing required information

Please refresh the page and check the current case status.

Technical details: ${backendError}`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found.

This case may have been moved, deleted, or you may not have access to it.

Technical details: ${backendError}`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied.

You don't have permission to reject case reopening. Please check with your supervisor.

Technical details: ${backendError}`;
      } else if (backendError) {
        errorMessage = `${backendError}

If this problem persists, please contact support.`;
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