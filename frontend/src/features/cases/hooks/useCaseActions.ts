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
    handleCloseCaseSubmit,
    handleAbandonSubmit,
    handleSuspendSubmit,
    handleResumeSubmit,
    handleReopenSubmit,
    handleApproveClosureSubmit,
    handleApproveCreation,
    handleApproveReopening,
    handleRejectCaseCreation,
    handleRejectCase,
    handleRejectReopening,
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