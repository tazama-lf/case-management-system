import { caseService } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';
import { authService } from '@/features/auth';
import React from 'react';

export const useReopenCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();
  const [isSupervisor, setIsSupervisor] = React.useState(false);

  React.useEffect(() => {
    const user = authService.getUser();
    const isSupervisor = user?.validatedClaims?.CMS_SUPERVISOR === true;
    setIsSupervisor(isSupervisor);
  }, []);

  const handleReopenSubmit = async (caseId: number, reason: string) => {
    try {
      const reopenCaseData = {
        reason: reason.trim(),
      };

      await caseService.reopenCase(caseId, reopenCaseData);

      if (isSupervisor) {
        success('Case Reopened', `Case ${caseId} reopened successfully.`);
      } else {
        success(
          'Reopen Request Submitted',
          `Reopen request for case ${caseId} submitted. Reason: ${reason}`,
        );
      }
      await refreshCases();
    } catch (err) {
      let errorMessage = 'Could not submit reopen request.';
      const backendError = err instanceof Error ? err.message : '';
      if (backendError.includes('not in a reopenable state')) {
        errorMessage = `Cannot reopen case (not closed). (${backendError})`;
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
      error('Reopen Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleReopenSubmit,
  };
};
