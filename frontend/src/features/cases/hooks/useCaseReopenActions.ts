import { caseService } from '../services/caseService';
import { useToast } from '../../../shared/providers/ToastProvider';

export const useCaseReopenActions = (refreshCases: () => Promise<void>) => {
  const { success, error } = useToast();

  const handleApproveReopenSubmit = async (caseId: string) => {
    try {
      const resp = await caseService.approveCaseReopening(caseId);

      const updatedStatus = resp.case?.status;
      let outcomeDetails = '';
      if (updatedStatus === 'STATUS_10_ASSIGNED') {
        const assignedTo = resp.investigation_task?.assigned_to ? ` and assigned to ${resp.investigation_task.assigned_to}` : '';
        outcomeDetails = `\n\nStatus: STATUS_10_ASSIGNED\nAn \"Investigate Case\" task (${resp.investigation_task?.task_id || 'N/A'}) has been created${assignedTo}.`;
      } else if (updatedStatus === 'STATUS_02_READY_FOR_ASSIGNMENT') {
        const candidateGroup = resp.investigation_task?.candidateGroup || 'Investigations';
        outcomeDetails = `\n\nStatus: STATUS_02_READY_FOR_ASSIGNMENT\nAn \"Investigate Case\" task (${resp.investigation_task?.task_id || 'N/A'}) has been created in the ${candidateGroup} queue.`;
      } else if (updatedStatus === 'STATUS_31_REOPENED') {
        outcomeDetails = `\n\nStatus: STATUS_31_REOPENED\nAn \"Investigate Case\" task has been created.`;
      }

      success('Case Reopening Approved', `Case ${caseId} reopening has been approved.${outcomeDetails}`);
      
      await refreshCases();
    } catch (err) {
      console.error('Error approving case reopening:', err);
      const message = err instanceof Error ? err.message : 'Failed to approve case reopening';
      error('Approve Case Reopening Failed', message);
      throw err;
    }
  };

  const handleRejectReopenSubmit = async (caseId: string, reason: string) => {
    try {
      const resp = await caseService.rejectCaseReopening(caseId, reason);

      let outcomeDetails = `\n\nReason: ${resp.rejection_reason || reason}`;
      const status = resp.case?.status;
      if (status?.startsWith('STATUS_8') || status?.startsWith('STATUS_7')) {
        outcomeDetails += `\nStatus: ${status}\nThe case remains closed.`;
      }

      success('Case Reopening Rejected', `Case ${caseId} reopening has been rejected.${outcomeDetails}`);
      
      await refreshCases();
    } catch (err) {
      console.error('Error rejecting case reopening:', err);
      const message = err instanceof Error ? err.message : 'Failed to reject case reopening';
      error('Reject Case Reopening Failed', message);
      throw err;
    }
  };

  return {
    handleApproveReopenSubmit,
    handleRejectReopenSubmit,
  };
};