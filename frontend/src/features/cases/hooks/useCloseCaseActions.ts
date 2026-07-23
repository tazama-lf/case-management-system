import type { CloseCaseDto } from '../services/caseService';
import { caseService } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';
import authService from '@/features/auth/services/authService';

export const useCloseCaseActions = (
  refreshCases: () => Promise<void>,
): {
  handleCloseCaseSubmit: (caseId: number, data: CloseCaseDto) => Promise<void>;
} => {
  const { success, error } = useToast();

  const handleCloseCaseSubmit = async (
    caseId: number,
    data: CloseCaseDto,
  ): Promise<void> => {
    try {
      await caseService.closeCase(caseId, data);
      const user = authService.getUser();
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- Defensive: user may be null at runtime if session expired
      const isSupervisor = Boolean(user?.validatedClaims?.CMS_SUPERVISOR);

      success(
        'Investigation Complete',
        isSupervisor
          ? 'Case Closed Successfully.'
          : 'Case Closed Successfully. Submitted for review.',
      );

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not close the case.';
      const backendError = err instanceof Error ? err.message : '';

      if (backendError.includes('Investigation task is not completed')) {
        errorMessage = `Complete the investigation task first. (${backendError})`;
      } else if (backendError.includes('not in a closeable state')) {
        errorMessage = `Case not ready for closure. (${backendError})`;
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

      error('Close Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleCloseCaseSubmit,
  };
};
