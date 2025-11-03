import type { CaseRow } from '../components/CasesTable';

export interface CaseAction {
  type: 'close' | 'approve' | 'return' | 'approve-creation' | 'approve-reopen' | 'reject-reopen' | 'reject-creation' | 'reopen' | 'abandon' | 'suspend' | 'resume' | 'reject';
  label: string;
  icon: string;
  colorClass: string;
  handler: (caseItem: CaseRow) => void;
  condition: (caseItem: CaseRow) => boolean;
}

export const getCaseActions = (
  caseItem: CaseRow,
  handlers: {
    onCloseCase?: (c: CaseRow) => void;
    onApproveCase?: (c: CaseRow) => void;
    onReturnForReview?: (c: CaseRow) => void;
    onApproveCaseCreation?: (c: CaseRow) => void;
    onApproveCaseReopen?: (c: CaseRow) => void;
    onRejectCaseReopen?: (c: CaseRow) => void;
    onRejectCaseCreation?: (c: CaseRow) => void;
    onReopenCase?: (c: CaseRow) => void;
    onAbandonCase?: (c: CaseRow) => void;
    onSuspendCase?: (c: CaseRow) => void;
    onResumeCase?: (c: CaseRow) => void;
    onRejectCase?: (c: CaseRow) => void;
  }
): CaseAction[] => {
  const actions: CaseAction[] = [
    {
      type: 'close',
      label: 'Complete Case',
      icon: 'XCircleIcon',
      colorClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      handler: handlers.onCloseCase!,
      condition: (c) => 
        !!handlers.onCloseCase && 
        (c.status === 'STATUS_20_IN_PROGRESS' || c.status.includes('IN PROGRESS'))
    },
    {
      type: 'approve',
      label: 'Approve',
      icon: 'CheckIcon',
      colorClass: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
      handler: handlers.onApproveCase!,
      condition: (c) => 
        !!handlers.onApproveCase && 
        (c.status === 'STATUS_22_PENDING_FINAL_APPROVAL' || c.status.includes('PENDING FINAL APPROVAL'))
    },
    {
      type: 'return',
      label: 'Return',
      icon: 'ArrowPathIcon',
      colorClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      handler: handlers.onReturnForReview!,
      condition: (c) => 
        !!handlers.onReturnForReview && 
        (c.status === 'STATUS_22_PENDING_FINAL_APPROVAL' || c.status.includes('PENDING FINAL APPROVAL'))
    },
    {
      type: 'approve-creation',
      label: 'Approve',
      icon: 'CheckIcon',
      colorClass: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
      handler: handlers.onApproveCaseCreation!,
      condition: (c) => 
        !!handlers.onApproveCaseCreation && 
        (c.status === 'STATUS_01_PENDING_CASE_CREATION_APPROVAL' || c.status.includes('PENDING CASE CREATION APPROVAL'))
    },
    {
      type: 'approve-reopen',
      label: 'Approve Reopen',
      icon: 'CheckIcon',
      colorClass: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
      handler: handlers.onApproveCaseReopen!,
      condition: (c) => 
        !!handlers.onApproveCaseReopen && 
        (c.status === 'STATUS_31_PENDING_CASE_REOPENING_APPROVAL' || c.status.includes('PENDING CASE REOPENING APPROVAL'))
    },
    {
      type: 'reject-reopen',
      label: 'Reject',
      icon: 'XCircleIcon',
      colorClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      handler: handlers.onRejectCaseReopen!,
      condition: (c) => 
        !!handlers.onRejectCaseReopen && 
        (c.status === 'STATUS_31_PENDING_CASE_REOPENING_APPROVAL' || c.status.includes('PENDING CASE REOPENING APPROVAL'))
    },
    {
      type: 'reject-creation',
      label: 'Reject',
      icon: 'XCircleIcon',
      colorClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      handler: handlers.onRejectCaseCreation!,
      condition: (c) => 
        !!handlers.onRejectCaseCreation && 
        (c.status === 'STATUS_01_PENDING_CASE_CREATION_APPROVAL' || c.status.includes('PENDING CASE CREATION APPROVAL'))
    },
    {
      type: 'reopen',
      label: 'Reopen',
      icon: 'ArrowPathIcon',
      colorClass: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
      handler: handlers.onReopenCase!,
      condition: (c) => 
        !!handlers.onReopenCase && 
        (c.status.includes('CLOSED') || c.status.includes('COMPLETED'))
    },
    {
      type: 'abandon',
      label: 'Abandon',
      icon: 'TrashIcon',
      colorClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      handler: handlers.onAbandonCase!,
      condition: (c) => 
        !!handlers.onAbandonCase && 
        c.status === 'STATUS_00_DRAFT'
    },
    {
      type: 'suspend',
      label: 'Suspend',
      icon: 'PauseIcon',
      colorClass: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500',
      handler: handlers.onSuspendCase!,
      condition: (c) => 
        !!handlers.onSuspendCase && 
        c.status === 'STATUS_20_IN_PROGRESS'
    },
    {
      type: 'resume',
      label: 'Resume',
      icon: 'PlayIcon',
      colorClass: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
      handler: handlers.onResumeCase!,
      condition: (c) => 
        !!handlers.onResumeCase && 
        c.status.includes('SUSPENDED')
    },
    {
      type: 'reject',
      label: 'Reject',
      icon: 'XCircleIcon',
      colorClass: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
      handler: handlers.onRejectCase!,
      condition: (c) => 
        !!handlers.onRejectCase && 
        (c.status === 'STATUS_22_PENDING_FINAL_APPROVAL' || c.status.includes('PENDING FINAL APPROVAL'))
    }
  ];

  return actions.filter(action => action.condition(caseItem));
};

export const getIconComponent = (iconName: string) => {
  const iconMap: Record<string, any> = {
    'CheckIcon': 'CheckIcon',
    'XCircleIcon': 'XCircleIcon', 
    'ArrowPathIcon': 'ArrowPathIcon',
    'TrashIcon': 'TrashIcon',
    'PauseIcon': 'PauseIcon',
    'PlayIcon': 'PlayIcon'
  };
  
  return iconMap[iconName] || 'CheckIcon';
};