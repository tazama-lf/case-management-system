import React from 'react';
import { EyeIcon, CheckIcon, XCircleIcon, PlayIcon, PauseIcon, TrashIcon } from '@heroicons/react/24/outline';
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

export const getStatusColor = (status: string): string => {
  const statusColors: Record<string, string> = {
    'STATUS_00_DRAFT': 'bg-gray-100 text-gray-700',
    'STATUS_02_READY_FOR_ASSIGNMENT': 'bg-indigo-50 text-indigo-700',
    'STATUS_10_ASSIGNED': 'bg-blue-50 text-blue-700',
    'STATUS_20_IN_PROGRESS': 'bg-yellow-50 text-yellow-700',
    'STATUS_22_PENDING_FINAL_APPROVAL': 'bg-purple-50 text-purple-700',
    'STATUS_31_REOPENED': 'bg-orange-50 text-orange-700',
    'STATUS_81_CLOSED_REFUTED': 'bg-red-50 text-red-700',
    'STATUS_82_CLOSED_CONFIRMED': 'bg-green-50 text-green-700',
    'STATUS_83_CLOSED_INCONCLUSIVE': 'bg-gray-50 text-gray-700',
  };
  return statusColors[status] || 'bg-gray-100 text-gray-700';
};

export const getTypeColor = (caseType: string): string => {
  const typeColors: Record<string, string> = {
    'FRAUD': 'bg-red-50 text-red-700 ring-red-200',
    'AML': 'bg-purple-50 text-purple-700 ring-purple-200',
    'FRAUD_AND_AML': 'bg-indigo-50 text-indigo-700 ring-indigo-200',
  };
  return typeColors[caseType] || 'bg-gray-50 text-gray-700 ring-gray-200';
};

export const getPriorityColor = (priority: string): string => {
  const priorityColors: Record<string, string> = {
    'NEW': 'bg-blue-50 text-blue-700 ring-blue-200',
    'URGENT': 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    'CRITICAL': 'bg-orange-50 text-orange-700 ring-orange-200',
    'BREACH': 'bg-red-50 text-red-700 ring-red-200',
  };
  return priorityColors[priority] || 'bg-gray-50 text-gray-700 ring-gray-200';
};

export const formatStatus = (status: string): string => {
  
  return status;
};

export const transformBackendCaseToUI = (backendCase: CaseWithTasksDto): CaseRow => {
  return {
    id: backendCase.case_id,
    type: backendCase.case_type,
    typeColor: getTypeColor(backendCase.case_type),
    status: formatStatus(backendCase.status),
    statusColor: getStatusColor(backendCase.status),
    typologyId: backendCase.alert?.alert_id?.substring(0, 8) || 'N/A',
    score: backendCase.alert?.confidence_per || 0,
    createdOn: new Date(backendCase.created_at).toLocaleDateString('en-GB'),
    pickedOn: backendCase.user_role === 'owner' ? new Date(backendCase.updated_at).toLocaleDateString('en-GB') : '-',
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
  onRejectCase
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
          {rows.map((c) => (
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
                  
                  {/* Close Case button - show for in-progress cases */}
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
                  
                  
                  {/* Reopen Case button - show for closed cases */}
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
                  
                  {/* Abandon Case button - show for draft cases only */}
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
                  
                  {/* Suspend Case button - show for in-progress cases */}
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
                  
                  {/* Resume Case button - show for suspended cases */}
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
                  
                  {/* Reject Case button - show for cases pending final approval */}
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
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default CasesTable;
