import type { CloseCaseDto } from '../services/caseService';
import { caseService } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useCloseCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleCloseCaseSubmit = async (caseId: number, data: CloseCaseDto) => {
    try {
      await caseService.closeCase(caseId, data);
      success('Investigation Complete', 'Case submitted for review.');
      await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not close the case.';
      const backendError = err instanceof Error ? err.message : '';

      if (backendError.includes('Investigation task is not completed')) {
        errorMessage = `Complete the investigation task first. (${backendError})`;
      } else if (backendError.includes('not in a closeable state')) {
        errorMessage = `Case not ready for closure. (${backendError})`;
      } else if (backendError.includes('Unauthorized') || backendError.includes('403')) {
        errorMessage = `Access denied. (${backendError})`;
      } else if (backendError.includes('not found') || backendError.includes('404')) {
        errorMessage = `Case not found. (${backendError})`;
      } else if (backendError) {
        errorMessage = `${backendError}`;
      }

      error('Close Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleCloseCaseSubmit,
  };
};