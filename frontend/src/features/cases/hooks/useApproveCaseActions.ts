import { caseService, type ApproveCaseClosureDto } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useApproveCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleApproveClosureSubmit = async (
    caseId: string, 
    finalOutcome: 'STATUS_81_CLOSED_REFUTED' | 'STATUS_82_CLOSED_CONFIRMED' | 'STATUS_83_CLOSED_INCONCLUSIVE',
    supervisorComments?: string
  ) => {
    try {
      const approveCaseData: ApproveCaseClosureDto = {
        finalOutcome,
        supervisorComments: supervisorComments?.trim()
      };

      const approvedCase = await caseService.approveCaseClosure(caseId, approveCaseData);

      success('Case Closure Approved', `Perfect! You've approved the closure of case ${caseId}.

Final Decision: ${finalOutcome.replace('STATUS_', '').replace('_', ' - ')}
${supervisorComments ? `Your Comments: ${supervisorComments}` : ''}
Status: ${approvedCase.status}

The case is now officially closed and removed from pending approvals.`);

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Something went wrong while approving the case closure. Please try again.';
      const backendError = err instanceof Error ? err.message : '';
      
      if (backendError.includes('Approval task validation failed')) {
        errorMessage = `Unable to approve case closure right now.

This usually means:
• The case isn't ready for final approval yet
• The approval task may have already been completed
• There might be missing required information

Please refresh the page and check if the case status has changed.

Technical details: ${backendError}`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found.

This case may have been moved, deleted, or you may not have access to it.

Technical details: ${backendError}`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied.

You don't have permission to approve case closures. Please check with your supervisor.

Technical details: ${backendError}`;
      } else if (backendError) {
        errorMessage = `${backendError}

If this problem persists, please contact support.`;
      }

      error('Approve Case Closure Failed', errorMessage);
      throw err;
    }
  };

  const handleApproveCreation = async (caseId: string) => {
    try {
      const approvedCase = await caseService.approveCaseCreation(caseId);

      success('Case Creation Approved', `Excellent! Case ${caseId} has been approved and is ready to go.

Status: ${approvedCase.status}

The case is now active and has been assigned to an investigator.`);

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Something went wrong while approving the case creation. Please try again.';
      const backendError = err instanceof Error ? err.message : '';
      
      if (backendError.includes('Approval task validation failed')) {
        errorMessage = `Unable to approve case creation right now.

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

You don't have permission to approve case creation. Please check with your supervisor.

Technical details: ${backendError}`;
      } else if (backendError) {
        errorMessage = `${backendError}

If this problem persists, please contact support.`;
      }

      error('Approve Case Creation Failed', errorMessage);
      throw err;
    }
  };

  const handleApproveReopening = async (caseId: string) => {
    try {
      const result = await caseService.approveCaseReopening(caseId);

      success('Case Reopening Approved', `Great! Case ${caseId} has been approved for reopening.

${result.message}

The case is now back in the investigation queue.`);

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Something went wrong while approving the case reopening. Please try again.';
      const backendError = err instanceof Error ? err.message : '';
      
      if (backendError.includes('Approval task validation failed')) {
        errorMessage = `Unable to approve case reopening right now.

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

You don't have permission to approve case reopening. Please check with your supervisor.

Technical details: ${backendError}`;
      } else if (backendError) {
        errorMessage = `${backendError}

If this problem persists, please contact support.`;
      }

      error('Approve Case Reopening Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleApproveClosureSubmit,
    handleApproveCreation,
    handleApproveReopening,
  };
};