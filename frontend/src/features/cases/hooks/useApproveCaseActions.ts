import {
  caseService,
  type ApproveCaseClosureDto,
} from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useApproveCaseActions = (refreshCases: () => Promise<void>): {
  handleApproveClosureSubmit: (caseId: number, finalOutcome: 'STATUS_81_CLOSED_REFUTED' | 'STATUS_82_CLOSED_CONFIRMED' | 'STATUS_83_CLOSED_INCONCLUSIVE', supervisorComments?: string) => Promise<void>;
  handleApproveCreation: (caseId: number) => Promise<void>;
  handleApproveReopening: (caseId: number) => Promise<void>;
} => {
  const { success, error } = useToast();

  const handleApproveClosureSubmit = async (
    caseId: number,
    finalOutcome:
      | 'STATUS_81_CLOSED_REFUTED'
      | 'STATUS_82_CLOSED_CONFIRMED'
      | 'STATUS_83_CLOSED_INCONCLUSIVE',
    supervisorComments?: string,
  ) => {
    try {
      const approveCaseData: ApproveCaseClosureDto = {
        finalOutcome,
        supervisorComments: (supervisorComments ?? '').trim(),
      };

      await caseService.approveCaseClosure(caseId, approveCaseData);

      success(
        'Case Closure Approved',
        `Case ${caseId} closure approved. Outcome: ${finalOutcome}`,
      );

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not approve case closure.';
      const backendError = err instanceof Error ? err.message : '';
      if (backendError.includes('Approval task validation failed')) {
        errorMessage = `Cannot approve case closure. (${backendError})`;
      } else if (
        backendError.includes('not found') ||
        backendError.includes('404')
      ) {
        errorMessage = `Case not found. (${backendError})`;
      } else if (
        backendError.includes('Unauthorized') ||
        backendError.includes('403')
      ) {
        errorMessage = `Access denied. (${backendError})`;
      } else if (backendError) {
        errorMessage = backendError;
      }
      error('Approve Case Closure Failed', errorMessage);
      throw err;
    }
  };

  const handleApproveCreation = async (caseId: number) => {
    try {
      await caseService.approveCaseCreation(caseId);

      success('Case Creation Approved', `Case ${caseId} creation approved.`);
      await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not approve case creation.';
      const backendError = err instanceof Error ? err.message : '';
      if (backendError.includes('Approval task validation failed')) {
        errorMessage = `Cannot approve case creation. (${backendError})`;
      } else if (
        backendError.includes('not found') ||
        backendError.includes('404')
      ) {
        errorMessage = `Case not found. (${backendError})`;
      } else if (
        backendError.includes('Unauthorized') ||
        backendError.includes('403')
      ) {
        errorMessage = `Access denied. (${backendError})`;
      } else if (backendError) {
        errorMessage = backendError;
      }
      error('Approve Case Creation Failed', errorMessage);
      throw err;
    }
  };

  const handleApproveReopening = async (caseId: number) => {
    try {
      await caseService.approveCaseReopening(caseId);

      success('Case Reopening Approved', `Case ${caseId} reopening approved.`);
      await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not approve case reopening.';
      const backendError = err instanceof Error ? err.message : '';
      if (backendError.includes('Approval task validation failed')) {
        errorMessage = `Cannot approve case reopening. (${backendError})`;
      } else if (
        backendError.includes('not found') ||
        backendError.includes('404')
      ) {
        errorMessage = `Case not found. (${backendError})`;
      } else if (
        backendError.includes('Unauthorized') ||
        backendError.includes('403')
      ) {
        errorMessage = `Access denied. (${backendError})`;
      } else if (backendError) {
        errorMessage = backendError;
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
