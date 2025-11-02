import { useCloseCaseActions } from './useCloseCaseActions';
import { useAbandonCaseActions } from './useAbandonCaseActions';
import { useSuspendCaseActions } from './useSuspendCaseActions';
import { useResumeCaseActions } from './useResumeCaseActions';
import { useApproveCaseActions } from './useApproveCaseActions';
import { useRejectCaseActions } from './useRejectCaseActions';
import { useReturnCaseActions } from './useReturnCaseActions';
import { useReopenCaseActions } from './useReopenCaseActions';


export const useCaseActions = (refreshCases: () => Promise<void>) => {
  const { handleCloseCaseSubmit } = useCloseCaseActions(refreshCases);
  const { handleAbandonSubmit } = useAbandonCaseActions(refreshCases);
  const { handleSuspendSubmit } = useSuspendCaseActions(refreshCases);
  const { handleResumeSubmit } = useResumeCaseActions(refreshCases);
  const { 
    handleApproveClosureSubmit, 
    handleApproveCreation, 
    handleApproveReopening 
  } = useApproveCaseActions(refreshCases);
  const { 
    handleRejectCaseCreation, 
    handleRejectCase, 
    handleRejectReopening 
  } = useRejectCaseActions(refreshCases);
  const { handleReturnForReview } = useReturnCaseActions(refreshCases);
  const { handleReopenSubmit } = useReopenCaseActions(refreshCases);

  return {
    // Case management actions
    handleCloseCaseSubmit,
    handleAbandonSubmit,
    handleSuspendSubmit,
    handleResumeSubmit,
    handleReopenSubmit,
    
    // Approval actions
    handleApproveClosureSubmit,
    handleApproveCreation,
    handleApproveReopening,
    
    // Rejection actions
    handleRejectCaseCreation,
    handleRejectCase,
    handleRejectReopening,
    
    // Review actions
    handleReturnForReview,
  };
};


export {
  useCloseCaseActions,
  useAbandonCaseActions,
  useSuspendCaseActions,
  useResumeCaseActions,
  useApproveCaseActions,
  useRejectCaseActions,
  useReturnCaseActions,
  useReopenCaseActions,
};