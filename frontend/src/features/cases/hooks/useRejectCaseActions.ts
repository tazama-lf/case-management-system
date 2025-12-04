import { caseService, type RejectCaseCreationDto, type RejectCaseDto } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useRejectCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleRejectCaseCreation = async (caseId: string, reason: string) => {
    try {
      const rejectCaseData: RejectCaseCreationDto = {
        reason: reason.trim()
      };

      await caseService.rejectCaseCreation(caseId, rejectCaseData);

      success('Case Creation Rejected', `Case ${caseId} creation rejected. Reason: ${reason}`);      await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not reject case creation.';
      const backendError = err instanceof Error ? err.message : '';
      if (backendError.includes('Approval task validation failed')) {
        errorMessage = `Cannot reject case creation. (${backendError})`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found. (${backendError})`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied. (${backendError})`;
      } else if (backendError) {
        errorMessage = `${backendError}`;
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

      await caseService.rejectCase(caseId, rejectCaseData);

      success('Case Rejected', `Case ${caseId} rejected. Reason: ${rejectionReason}`);      await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not reject case.';
      const backendError = err instanceof Error ? err.message : '';
      if (backendError.includes('Approval task validation failed')) {
        errorMessage = `Cannot reject case. (${backendError})`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found. (${backendError})`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied. (${backendError})`;
      } else if (backendError) {
        errorMessage = `${backendError}`;
      }
      error('Reject Case Failed', errorMessage);
      throw err;
    }
  };

  const handleRejectReopening = async (caseId: string, rejectionReason: string) => {
    try {
      await caseService.rejectCaseReopening(caseId, rejectionReason);

      success('Case Reopening Rejected', `Case ${caseId} reopening rejected. Reason: ${rejectionReason}`);      await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not reject case reopening.';
      const backendError = err instanceof Error ? err.message : '';
      if (backendError.includes('Approval task validation failed')) {
        errorMessage = `Cannot reject case reopening. (${backendError})`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found. (${backendError})`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied. (${backendError})`;
      } else if (backendError) {
        errorMessage = `${backendError}`;
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