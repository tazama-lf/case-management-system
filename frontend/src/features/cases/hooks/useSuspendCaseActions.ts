import { caseService, type SuspendCaseDto } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useSuspendCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleSuspendSubmit = async (caseId: number, reason: string, taskIds: number[]) => {
    try {
      const suspendCaseData: SuspendCaseDto = {
        reason: reason.trim(),
        taskIds: taskIds
      };

      await caseService.suspendCase(caseId, suspendCaseData);

      success('Case Suspended', `Case ${caseId} suspended. Reason: ${reason}`); await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not suspend case.';
      const backendError = err instanceof Error ? err.message : '';
      if (backendError.includes('not in a suspendable state')) {
        errorMessage = `Cannot suspend case (not in progress). (${backendError})`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied. (${backendError})`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found. (${backendError})`;
      } else if (backendError) {
        errorMessage = `${backendError}`;
      }
      error('Suspend Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleSuspendSubmit,
  };
};