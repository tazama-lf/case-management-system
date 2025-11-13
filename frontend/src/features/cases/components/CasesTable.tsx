import React from 'react';
import {
  EyeIcon,
  CheckIcon,
  XCircleIcon,
  PlayIcon,
  PauseIcon,
  TrashIcon,
} from '@heroicons/react/24/outline';
import type { CaseRow } from './casesTable.utils';
import { getScoreColor } from './casesTable.utils';

interface PaginationInfo {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}

interface CasesTableProps {
  rows: CaseRow[];
  onView: (row: CaseRow) => void;
  onComplete: (row: CaseRow) => void;
  onCloseCase?: (row: CaseRow) => void;
  onReopenCase?: (row: CaseRow) => void;
  onAbandonCase?: (row: CaseRow) => void;
  onSuspendCase?: (row: CaseRow) => void;
  onResumeCase?: (row: CaseRow) => void;
  onApproveCase?: (row: CaseRow) => void;
  onApproveCaseReopen?: (row: CaseRow) => void;
  onRejectCaseReopen?: (row: CaseRow) => void;
  onApproveCaseCreation?: (row: CaseRow) => void;
  onRejectCaseCreation?: (row: CaseRow) => void;
  pagination?: PaginationInfo;
  canManageSupervisorActions: boolean;
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
  onApproveCase,
  onApproveCaseReopen,
  onRejectCaseReopen,
  onApproveCaseCreation,
  onRejectCaseCreation,
  pagination,
  canManageSupervisorActions,
}) => {
  const showSupervisorControls = canManageSupervisorActions;

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <span className="hidden sm:inline">Case ID</span>
                <span className="sm:hidden">ID</span>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <span className="hidden lg:inline">Case Type</span>
                <span className="lg:hidden">Type</span>
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Status
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                <span className="hidden sm:inline">Score</span>
                <span className="sm:hidden">%</span>
              </th>
              <th
                scope="col"
                className="hidden md:table-cell px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Created
              </th>
              <th
                scope="col"
                className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider"
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {rows.map((c) => (
              <tr key={c.id} className="hover:bg-gray-50">
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900 font-mono" title={c.id}>
                    {c.id}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="text-sm text-gray-900" title={c.type}>
                    {c.type || 'N/A'}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset ${c.statusColor}`}
                  >
                    {c.status}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span
                    className={`inline-flex px-3 py-1 text-xs font-bold rounded-full ${getScoreColor(c.score)}`}
                  >
                    {c.score}%
                  </span>
                </td>
                <td className="hidden md:table-cell px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                  <div title={c.createdOn}>{c.createdOn}</div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 flex-wrap">
                    <button
                      onClick={() => onView(c)}
                      className="inline-flex items-center gap-1 rounded-md bg-blue-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 whitespace-nowrap"
                      title="View case details"
                    >
                      <EyeIcon className="h-4 w-4" />
                      <span className="hidden sm:inline">View</span>
                    </button>

                    {c.action === 'Complete' && (
                      <button
                        onClick={() => onComplete(c)}
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 whitespace-nowrap"
                        title="Complete case"
                      >
                        <CheckIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">Complete</span>
                      </button>
                    )}

                    {/* Close Case button - show for in-progress cases */}
                    {onCloseCase &&
                      (c.status === 'STATUS_20_IN_PROGRESS' ||
                        c.status.includes('IN PROGRESS')) && (
                        <button
                          onClick={() => onCloseCase(c)}
                          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 whitespace-nowrap"
                          title="Close case"
                        >
                          <XCircleIcon className="h-4 w-4" />
                          <span className="hidden lg:inline">Close Case</span>
                          <span className="lg:hidden">Close</span>
                        </button>
                      )}

                    {/* Case Closure Decision button - show for cases pending final approval */}
                    {showSupervisorControls &&
                      onApproveCase &&
                      (c.status === 'STATUS_22_PENDING_FINAL_APPROVAL' ||
                        c.status.includes('PENDING FINAL APPROVAL')) && (
                        <button
                          onClick={() => onApproveCase(c)}
                          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 whitespace-nowrap"
                          title="Review case closure"
                        >
                          <CheckIcon className="h-4 w-4" />
                          <span className="hidden xl:inline">
                            Review Case Closure
                          </span>
                          <span className="xl:hidden">Review</span>
                        </button>
                      )}

                    {/* Approve Case Creation button - show for cases pending creation approval */}
                    {showSupervisorControls &&
                      onApproveCaseCreation &&
                      (c.status ===
                        'STATUS_01_PENDING_CASE_CREATION_APPROVAL' ||
                        c.status.includes(
                          'PENDING CASE CREATION APPROVAL',
                        )) && (
                        <button
                          onClick={() => onApproveCaseCreation(c)}
                          className="inline-flex items-center gap-0.5 rounded bg-green-600 px-1.5 py-0.5 text-xs font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-1 focus:ring-green-500 whitespace-nowrap"
                        >
                          <CheckIcon className="h-2.5 w-2.5" />
                          <span className="hidden sm:inline">Approve</span>
                        </button>
                      )}

                    {/* Reject Case Creation button - show for cases pending creation approval */}
                    {showSupervisorControls &&
                      onRejectCaseCreation &&
                      (c.status ===
                        'STATUS_01_PENDING_CASE_CREATION_APPROVAL' ||
                        c.status.includes(
                          'PENDING CASE CREATION APPROVAL',
                        )) && (
                        <button
                          onClick={() => onRejectCaseCreation(c)}
                          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 whitespace-nowrap"
                          title="Reject case creation"
                        >
                          <XCircleIcon className="h-4 w-4" />
                          <span className="hidden sm:inline">Reject</span>
                        </button>
                      )}

                    {/* Approve Case Reopening button - show for cases pending reopening approval */}
                    {showSupervisorControls &&
                      onApproveCaseReopen &&
                      (c.status ===
                        'STATUS_31_PENDING_CASE_REOPENING_APPROVAL' ||
                        c.status.includes(
                          'PENDING CASE REOPENING APPROVAL',
                        )) && (
                        <button
                          onClick={() => onApproveCaseReopen(c)}
                          className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 whitespace-nowrap"
                          title="Approve case reopening"
                        >
                          <CheckIcon className="h-4 w-4" />
                          <span className="hidden lg:inline">
                            Approve Reopen
                          </span>
                          <span className="lg:hidden">Approve</span>
                        </button>
                      )}

                    {/* Reject Case Reopening button - show for cases pending reopening approval */}
                    {showSupervisorControls &&
                      onRejectCaseReopen &&
                      (c.status ===
                        'STATUS_31_PENDING_CASE_REOPENING_APPROVAL' ||
                        c.status.includes(
                          'PENDING CASE REOPENING APPROVAL',
                        )) && (
                        <button
                          onClick={() => onRejectCaseReopen(c)}
                          className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 whitespace-nowrap"
                          title="Reject case reopening"
                        >
                          <XCircleIcon className="h-4 w-4" />
                          <span className="hidden lg:inline">
                            Reject Reopen
                          </span>
                          <span className="lg:hidden">Reject</span>
                        </button>
                      )}

                    {/* Reopen Case button - show for closed cases */}
                    {onReopenCase &&
                      (c.status === 'STATUS_81_CLOSED_REFUTED' ||
                        c.status === 'STATUS_82_CLOSED_CONFIRMED' ||
                        c.status === 'STATUS_83_CLOSED_INCONCLUSIVE' ||
                        c.status.includes('CLOSED')) && (
                        <button
                          onClick={() => onReopenCase(c)}
                          className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 whitespace-nowrap"
                          title="Reopen case"
                        >
                          <PlayIcon className="h-4 w-4" />
                          <span className="hidden sm:inline">Reopen</span>
                        </button>
                      )}

                    {/* Abandon Case button - show for draft cases only */}
                    {onAbandonCase && c.status === 'STATUS_00_DRAFT' && (
                      <button
                        onClick={() => onAbandonCase(c)}
                        className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 whitespace-nowrap"
                        title="Abandon case"
                      >
                        <TrashIcon className="h-4 w-4" />
                        <span className="hidden sm:inline">Abandon</span>
                      </button>
                    )}

                    {/* Suspend Case button - show for in-progress cases */}
                    {onSuspendCase &&
                      (c.status === 'STATUS_20_IN_PROGRESS' ||
                        c.status.includes('IN PROGRESS')) && (
                        <button
                          onClick={() => onSuspendCase(c)}
                          className="inline-flex items-center gap-1 rounded-md bg-yellow-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-yellow-700 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2 whitespace-nowrap"
                          title="Suspend case"
                        >
                          <PauseIcon className="h-4 w-4" />
                          <span className="hidden sm:inline">Suspend</span>
                        </button>
                      )}

                    {/* Resume Case button - show for suspended cases */}
                    {onResumeCase &&
                      (c.status === 'STATUS_21_SUSPENDED' ||
                        c.status.includes('SUSPENDED')) && (
                        <button
                          onClick={() => onResumeCase(c)}
                          className="inline-flex items-center gap-1 rounded-md bg-green-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 whitespace-nowrap"
                          title="Resume case"
                        >
                          <PlayIcon className="h-4 w-4" />
                          <span className="hidden sm:inline">Resume</span>
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pagination && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700">
                Showing{' '}
                <span className="font-medium">
                  {Math.min(
                    (pagination.currentPage - 1) * pagination.pageSize + 1,
                    pagination.totalItems,
                  )}
                </span>{' '}
                to{' '}
                <span className="font-medium">
                  {Math.min(
                    pagination.currentPage * pagination.pageSize,
                    pagination.totalItems,
                  )}
                </span>{' '}
                of <span className="font-medium">{pagination.totalItems}</span>{' '}
                results
              </p>
            </div>
            <div>
              <nav
                className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                aria-label="Pagination"
              >
                <button
                  onClick={() =>
                    pagination.onPageChange(
                      Math.max(1, pagination.currentPage - 1),
                    )
                  }
                  disabled={pagination.currentPage <= 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                {}
                {(() => {
                  const { currentPage, totalPages } = pagination;
                  const pages: (number | 'ellipsis')[] = [];
                  const windowSize = 5;
                  const half = Math.floor(windowSize / 2);

                  const addPage = (p: number) => pages.push(p);
                  const addEllipsis = () => pages.push('ellipsis');

                  if (totalPages <= windowSize + 2) {
                    for (let p = 1; p <= totalPages; p++) addPage(p);
                  } else {
                    const start = Math.max(2, currentPage - half);
                    const end = Math.min(totalPages - 1, currentPage + half);

                    addPage(1);
                    if (start > 2) addEllipsis();
                    for (let p = start; p <= end; p++) addPage(p);
                    if (end < totalPages - 1) addEllipsis();
                    addPage(totalPages);
                  }

                  return pages.map((p, idx) =>
                    p === 'ellipsis' ? (
                      <span
                        key={`ellipsis-${idx}`}
                        className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-400 select-none"
                      >
                        …
                      </span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => pagination.onPageChange(p)}
                        className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                          pagination.currentPage === p
                            ? 'z-10 bg-blue-50 border-blue-500 text-blue-600'
                            : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                        }`}
                        aria-current={
                          pagination.currentPage === p ? 'page' : undefined
                        }
                      >
                        {p}
                      </button>
                    ),
                  );
                })()}
                <button
                  onClick={() =>
                    pagination.onPageChange(
                      Math.min(
                        pagination.totalPages,
                        pagination.currentPage + 1,
                      ),
                    )
                  }
                  disabled={pagination.currentPage >= pagination.totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CasesTable;
