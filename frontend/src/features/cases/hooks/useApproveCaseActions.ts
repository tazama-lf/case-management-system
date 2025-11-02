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
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('not in an approvable state')) {
        errorMessage = `This case can't be approved for closure right now.

The case might not be ready for approval yet. Please check if there's a pending closure task waiting for your review.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Sorry, you don't have permission to approve case closures.

Please check that you have supervisor privileges.`;
      } else if (errorString.includes('404')) {
        errorMessage = `We can't find this case. It might have been moved or deleted.`;
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
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Sorry, you don't have permission to approve case creation.

Please check that you have supervisor privileges.`;
      } else if (errorString.includes('404')) {
        errorMessage = `We can't find this case. It might have been moved or deleted.`;
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
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Sorry, you don't have permission to approve case reopening.

Please check that you have supervisor privileges.`;
      } else if (errorString.includes('404')) {
        errorMessage = `We can't find this case. It might have been moved or deleted.`;
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