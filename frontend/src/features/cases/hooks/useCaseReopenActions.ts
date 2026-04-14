import { caseService } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useCaseReopenActions = (
  refreshCases: () => Promise<void>,
): {
  handleApproveReopenSubmit: (caseId: number) => Promise<void>;
  handleRejectReopenSubmit: (caseId: number, reason: string) => Promise<void>;
} => {
  const { success, error } = useToast();

  const handleApproveReopenSubmit = async (caseId: number): Promise<void> => {
    try {
      await caseService.approveCaseReopening(caseId);
      success('Case Reopening Approved', `Case ${caseId} reopening approved.`);
      await refreshCases();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to approve case reopening';
      error('Approve Case Reopening Failed', message);
      throw err;
    }
  };

  const handleRejectReopenSubmit = async (caseId: number, reason: string): Promise<void> => {
    try {
      await caseService.rejectCaseReopening(caseId, reason);
      success(
        'Case Reopening Rejected',
        `Case ${caseId} reopening rejected. Reason: ${reason}`,
      );
      await refreshCases();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to reject case reopening';
      error('Reject Case Reopening Failed', message);
      throw err;
    }
  };

  return {
    handleApproveReopenSubmit,
    handleRejectReopenSubmit,
  };
};
