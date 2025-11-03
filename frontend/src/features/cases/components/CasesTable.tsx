import React from 'react';
import { EyeIcon, CheckIcon, XCircleIcon, PlayIcon, PauseIcon, TrashIcon, ArrowPathIcon } from '@heroicons/react/24/outline';
import { 
  getCaseStatusColorClass, 
  getTypeColorClass
} from '@/shared/utils/colors';
import { formatDateGB } from '@/shared/utils/dateUtils';
import type { CaseWithTasksDto } from '../services/caseService';

export type CaseRow = {
  id: string;
  type: string;
  typeColor: string;
  status: string;
  statusColor: string;
  typologyId: string;
  score: number;
  createdOn: string;
  pickedOn: string;
  action: 'View' | 'Complete';
  assignee?: string;
  priority: string;
  userRole: 'owner' | 'task_assignee' | 'both';
  totalTasks: number;
  alertId?: string;
  alertMessage?: string;
  confidencePercent?: number;
};

export const formatStatus = (status: string): string => {
  
  return status;
};

export const transformBackendCaseToUI = (backendCase: CaseWithTasksDto): CaseRow => {
  return {
    id: backendCase.case_id,
    type: backendCase.case_type,
    typeColor: getTypeColorClass(backendCase.case_type),
    status: formatStatus(backendCase.status),
    statusColor: getCaseStatusColorClass(backendCase.status),
    typologyId: backendCase.alert?.alert_id?.substring(0, 8) || 'N/A',
    score: backendCase.alert?.confidence_per || 0,
    createdOn: formatDateGB(backendCase.created_at),
    pickedOn: backendCase.user_role === 'owner' ? formatDateGB(backendCase.updated_at) : '-',
    action: backendCase.status === 'STATUS_00_DRAFT' ? 'Complete' : 'View',
    assignee: backendCase.user_role === 'owner' ? 'Current User' : 'Assigned User',
    priority: backendCase.priority,
    userRole: backendCase.user_role,
    totalTasks: backendCase.total_tasks,
    alertId: backendCase.alert?.alert_id,
    alertMessage: backendCase.alert?.message,
    confidencePercent: backendCase.alert?.confidence_per,
  };
};

interface CasesTableProps {
  rows: CaseRow[];
  onView: (row: CaseRow) => void;
  onComplete: (row: CaseRow) => void;
  onCloseCase?: (row: CaseRow) => void;
  onReopenCase?: (row: CaseRow) => void;
  onAbandonCase?: (row: CaseRow) => void;
  onSuspendCase?: (row: CaseRow) => void;
  onResumeCase?: (row: CaseRow) => void;
  onRejectCase?: (row: CaseRow) => void;
  onApproveCase?: (row: CaseRow) => void;
  onApproveCaseReopen?: (row: CaseRow) => void;
  onRejectCaseReopen?: (row: CaseRow) => void;
  onApproveCaseCreation?: (row: CaseRow) => void;
  onRejectCaseCreation?: (row: CaseRow) => void;
  onReturnForReview?: (row: CaseRow) => void;
}

const CasesTable: React.FC<CasesTableProps> = ({ 
  rows, 
  onView, 
  onComplete, 
  onCloseCase,
  onReopenCase,
  onAbandonCase,
  onSuspendCase,
  onResumeCase,
  onRejectCase,
  onApproveCase,
  onApproveCaseReopen,
  onRejectCaseReopen,
  onApproveCaseCreation,
  onRejectCaseCreation,
  onReturnForReview
}) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Case ID</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Case Type</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Typology ID</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Typology Score</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Created on</th>
            <th scope="col" className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Picked on</th>
            <th scope="col" className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 bg-white">
          {rows?.length > 0 ? (
            rows.map((c) => (
            <tr key={c.id} className="hover:bg-gray-50/50">
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{c.id}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">
                {c.type}
              </td>
              <td className="whitespace-nowrap px-4 py-3">
                <span className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-gray-200 ${c.statusColor}`}>
                  {c.status}
                </span>
              </td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{c.typologyId}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-900">{c.score}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{c.createdOn}</td>
              <td className="whitespace-nowrap px-4 py-3 text-sm text-gray-700">{c.pickedOn}</td>
              <td className="whitespace-nowrap px-4 py-3">
                <div className="flex justify-end gap-2">
                  <button
                    onClick={() => onView(c)}
                    className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <EyeIcon className="h-3 w-3" />
                    View
                  </button>
                  
                  {c.action === 'Complete' && (
                    <button
                      onClick={() => onComplete(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <CheckIcon className="h-3 w-3" />
                      Complete
                    </button>
                  )}
                  
                  {}
                  {onCloseCase && (
                    c.status === 'STATUS_20_IN_PROGRESS' ||
                    c.status.includes('IN PROGRESS')
                  ) && (
                    <button
                      onClick={() => onCloseCase(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <XCircleIcon className="h-3 w-3" />
                      Complete Case
                    </button>
                  )}
                  
                  {}
                  {onApproveCase && (
                    c.status === 'STATUS_22_PENDING_FINAL_APPROVAL' ||
                    c.status.includes('PENDING FINAL APPROVAL')
                  ) && (
                    <button
                      onClick={() => onApproveCase(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <CheckIcon className="h-3 w-3" />
                      Approve
                    </button>
                  )}
                  
                  {}
                  {onReturnForReview && (
                    c.status === 'STATUS_22_PENDING_FINAL_APPROVAL' ||
                    c.status.includes('PENDING FINAL APPROVAL')
                  ) && (
                    <button
                      onClick={() => onReturnForReview(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <ArrowPathIcon className="h-3 w-3" />
                      Return
                    </button>
                  )}
                  
                  {}
                  {onApproveCaseCreation && (
                    c.status === 'STATUS_01_PENDING_CASE_CREATION_APPROVAL' ||
                    c.status.includes('PENDING CASE CREATION APPROVAL')
                  ) && (
                    <button
                      onClick={() => onApproveCaseCreation(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <CheckIcon className="h-3 w-3" />
                      Approve
                    </button>
                  )}
                  
                  {}
                  {onApproveCaseReopen && (
                    c.status === 'STATUS_31_PENDING_CASE_REOPENING_APPROVAL' ||
                    c.status.includes('PENDING CASE REOPENING APPROVAL')
                  ) && (
                    <button
                      onClick={() => onApproveCaseReopen(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <CheckIcon className="h-3 w-3" />
                      Approve Reopen
                    </button>
                  )}
                  
                  {}
                  {onRejectCaseReopen && (
                    c.status === 'STATUS_31_PENDING_CASE_REOPENING_APPROVAL' ||
                    c.status.includes('PENDING CASE REOPENING APPROVAL')
                  ) && (
                    <button
                      onClick={() => onRejectCaseReopen(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <XCircleIcon className="h-3 w-3" />
                      Reject Reopen
                    </button>
                  )}
                  
                  {}
                  {onRejectCaseCreation && (
                    c.status === 'STATUS_01_PENDING_CASE_CREATION_APPROVAL' ||
                    c.status.includes('PENDING CASE CREATION APPROVAL')
                  ) && (
                    <button
                      onClick={() => onRejectCaseCreation(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <XCircleIcon className="h-3 w-3" />
                      Reject
                    </button>
                  )}
                  
                  {}
                  {onReopenCase && (
                    c.status === 'STATUS_81_CLOSED_REFUTED' ||
                    c.status === 'STATUS_82_CLOSED_CONFIRMED' ||
                    c.status === 'STATUS_83_CLOSED_INCONCLUSIVE' ||
                    c.status.includes('CLOSED')
                  ) && (
                    <button
                      onClick={() => onReopenCase(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <PlayIcon className="h-3 w-3" />
                      Reopen
                    </button>
                  )}
                  
                  {}
                  {onAbandonCase && (
                    c.status === 'STATUS_00_DRAFT'
                  ) && (
                    <button
                      onClick={() => onAbandonCase(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <TrashIcon className="h-3 w-3" />
                      Abandon
                    </button>
                  )}
                  
                  {}
                  {onSuspendCase && (
                    c.status === 'STATUS_20_IN_PROGRESS' ||
                    c.status.includes('IN PROGRESS')
                  ) && (
                    <button
                      onClick={() => onSuspendCase(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-yellow-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500"
                    >
                      <PauseIcon className="h-3 w-3" />
                      Suspend
                    </button>
                  )}
                  
                  {}
                  {onResumeCase && (
                    c.status === 'STATUS_21_SUSPENDED' ||
                    c.status.includes('SUSPENDED')
                  ) && (
                    <button
                      onClick={() => onResumeCase(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500"
                    >
                      <PlayIcon className="h-3 w-3" />
                      Resume
                    </button>
                  )}
                  
                  {}
                  {onRejectCase && (
                    c.status === 'STATUS_22_PENDING_FINAL_APPROVAL' ||
                    c.status.includes('PENDING FINAL APPROVAL')
                  ) && (
                    <button
                      onClick={() => onRejectCase(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
                    >
                      <XCircleIcon className="h-3 w-3" />
                      Reject
                    </button>
                  )}
                </div>
              </td>
            </tr>
          ))
          ) : (
            <tr>
              <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                <div className="flex flex-col items-center">
                  <svg className="w-12 h-12 text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <p className="text-sm font-medium text-gray-900 mb-1">No cases found</p>
                  <p className="text-sm text-gray-500">Try adjusting your filters or search criteria.</p>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default CasesTable;