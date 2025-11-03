import { caseService, type AbandonCaseDto } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useAbandonCaseActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleAbandonSubmit = async (caseId: string, reason: string) => {
    try {
      const abandonCaseData: AbandonCaseDto = {
        reason: reason.trim()
      };

      const abandonedCase = await caseService.abandonCase(caseId, abandonCaseData);

      success('Case Abandoned Successfully', `Case ${caseId} has been abandoned as requested.

Reason: ${reason}
Status: ${abandonedCase.status}

The case has been removed from active investigations and won't appear in your queue anymore.`);

      await refreshCases();
    } catch (err) {
      let errorMessage = 'Something went wrong while abandoning the case. Please try again.';
      const errorString = err instanceof Error ? err.message : '';

      if (errorString.includes('Cannot abandon case other than draft status')) {
        errorMessage = `This case can't be abandoned right now.

It looks like the case isn't in draft status anymore. You can only abandon cases that haven't been started yet.`;
      } else if (errorString.includes('No complete new Case Task exists')) {
        errorMessage = `This case can't be abandoned.

The case needs to be in draft status with a pending "Complete New Case" task to be abandoned.`;
      } else if (errorString.includes('Unauthorized') || errorString.includes('403')) {
        errorMessage = `Sorry, you don't have permission to abandon this case.

Please check that you have the right access level.`;
      } else if (errorString.includes('404')) {
        errorMessage = `We can't find this case. It might have been moved or deleted.`;
      }

      error('Abandon Case Failed', errorMessage);
      throw err;
    }
  };

  return {
    handleAbandonSubmit,
  };
};