import React from 'react';
import {
  UserPlusIcon,
  UserMinusIcon,
  CheckIcon,
  ClockIcon,
  ArrowPathIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import { formatDate } from '../../../../../shared/utils/dateUtils';
import { EmptyState } from '../../../../../shared/components/ui';
import type { UnifiedWorkQueueTask } from '../../../../workqueue/types/flowable.types';

interface TaskLogTableProps {
  tasks: UnifiedWorkQueueTask[];
  onAssign: (task: UnifiedWorkQueueTask) => void;
  onUnassign?: (task: UnifiedWorkQueueTask) => void;
  onReassign?: (task: UnifiedWorkQueueTask) => void;
  onComplete?: (task: UnifiedWorkQueueTask) => void;
  onUpdateStatus?: (task: UnifiedWorkQueueTask) => void;
  onCaseIdClick?: (caseId: string) => void;
  pagination?: {
    currentPage: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    onPageChange: (page: number) => void;
  };
  onTaskClick?: (task: UnifiedWorkQueueTask) => void;
}

const TaskLogTable: React.FC<TaskLogTableProps> = ({
  tasks,
  onAssign,
  onUnassign,
  onReassign,
  onComplete,
  onUpdateStatus,
  onCaseIdClick,
  onTaskClick,

  pagination,
}) => {
  const tableColumns = [
    { key: 'task', label: 'Task ID', width: 'w-80' },
    { key: 'title', label: 'Title', width: 'w-80' },
    { key: 'case', label: 'Case ID', width: 'w-72' },
    { key: 'queue', label: 'Queue', width: 'w-32' },
    { key: 'status', label: 'Status', width: 'w-32' },
    { key: 'created', label: 'Created', width: 'w-40' },
    { key: 'assignedTo', label: 'Assigned To', width: 'w-48' },
    { key: 'actions', label: 'Actions', width: 'w-40', align: 'right' },
  ];
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      UNASSIGNED: { color: 'bg-gray-100 text-gray-800', label: 'Unassigned' },
      ASSIGNED: { color: 'bg-blue-100 text-blue-800', label: 'Assigned' },
      IN_PROGRESS: {
        color: 'bg-yellow-100 text-yellow-800',
        label: 'In Progress',
      },
      COMPLETED: { color: 'bg-green-100 text-green-800', label: 'Completed' },
      SUSPENDED: { color: 'bg-red-100 text-red-800', label: 'Blocked' },
    };

    const config =
      statusConfig[status as keyof typeof statusConfig] ||
      statusConfig.UNASSIGNED;
    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}
      >
        {config.label}
      </span>
    );
  };

  const getAvailableActions = (task: UnifiedWorkQueueTask) => {
    const actions: React.ReactNode[] = [];

    // Don't show action buttons for completed tasks
    if (task.status === 'COMPLETED') {
      return actions;
    }

    if (task.status === 'IN_PROGRESS') {
      if (task.assignee && onComplete) {
        actions.push(
          <button
            key="complete"
            onClick={(event) => {
              event.stopPropagation();
              onComplete(task);
            }}
            className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-green-700 bg-green-100 hover:bg-green-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
            title="Mark complete"
          >
            <CheckIcon className="h-3 w-3 mr-1" />
            Complete
          </button>,
        );
      }
      return actions;
    }

    if (!task.assignee) {
      actions.push(
        <button
          key="assign"
          onClick={(event) => {
            event.stopPropagation();
            onAssign(task);
          }}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          title="Assign task"
        >
          <UserPlusIcon className="h-3 w-3 mr-1" />
          Assign
        </button>,
      );
    }

    if (task.assignee && onReassign) {
      actions.push(
        <button
          key="reassign"
          onClick={(event) => {
            event.stopPropagation();
            onReassign(task);
          }}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-purple-700 bg-purple-100 hover:bg-purple-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
          title="Reassign task"
        >
          <ArrowPathIcon className="h-3 w-3 mr-1" />
          Reassign
        </button>,
      );
    }

    if (task.assignee && onUnassign) {
      actions.push(
        <button
          key="unassign"
          onClick={(event) => {
            event.stopPropagation();
            onUnassign(task);
          }}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-orange-700 bg-orange-100 hover:bg-orange-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-orange-500"
          title="Unassign task"
        >
          <UserMinusIcon className="h-3 w-3 mr-1" />
          Unassign
        </button>,
      );
    }

    if (task.assignee && onUpdateStatus) {
      actions.push(
        <button
          key="update-status"
          onClick={(event) => {
            event.stopPropagation();
            onUpdateStatus(task);
          }}
          className="inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded text-gray-700 bg-gray-100 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
          title="Update status"
        >
          <Cog6ToothIcon className="h-3 w-3 mr-1" />
          Status
        </button>,
      );
    }

    return actions;
  };

  const handleRowKeyDown = (
    event: React.KeyboardEvent<HTMLTableRowElement>,
    task: UnifiedWorkQueueTask,
  ) => {
    if (!onTaskClick) return;

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onTaskClick(task);
    }
  };

  return (
    <div className="bg-white shadow rounded-lg">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200 table-fixed">
          <colgroup>
            {tableColumns.map((col) => (
              <col key={col.key} className={col.width} />
            ))}
          </colgroup>
          <thead className="bg-gray-50">
            <tr>
              {tableColumns.map((col) => (
                <th
                  key={col.key}
                  className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${
                    col.align === 'right' ? 'text-right' : 'text-left'
                  }`}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {tasks.map((task, index) => (
              <tr
                key={task.id || `task-${index}`}
                className={`hover:bg-gray-50 ${onTaskClick ? 'cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2' : ''}`}
                onClick={() => onTaskClick?.(task)}
                onKeyDown={(event) => handleRowKeyDown(event, task)}
                role={onTaskClick ? 'button' : undefined}
                tabIndex={onTaskClick ? 0 : undefined}
              >
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <div
                      className="text-xs font-medium text-gray-900 font-mono truncate max-w-[10rem]"
                      title={task.id || 'No ID'}
                    >
                      {task.id || 'No ID'}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div
                    className={`text-xs break-words mt-1 ${onTaskClick ? 'text-blue-600 hover:underline' : 'text-gray-900'}`}
                    title={task.name || 'View task details'}
                  >
                    {task.name || 'Unnamed Task'}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div
                    className="text-xs text-gray-900 font-mono truncate max-w-[10rem]"
                    title={task.caseId || ''}
                  >
                    {task.caseId || ''}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900 break-words">
                    {task.candidateGroup || '-'}
                  </div>
                </td>
                <td className="px-4 py-3">{getStatusBadge(task.status)}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center text-sm text-gray-500">
                    <ClockIcon className="h-4 w-4 mr-1" />
                    {formatDate(task.createdAt)}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <div className="text-sm text-gray-900">
                    {task.assignee ? (
                      <span
                        className="text-blue-600 truncate max-w-[10rem] inline-block align-middle"
                        title={task.assigneeName || task.assignee}
                      >
                        {task.assigneeName || task.assignee}
                      </span>
                    ) : (
                      <span className="text-gray-400">Unassigned</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-sm font-medium">
                  <div className="flex justify-end space-x-2">
                    {getAvailableActions(task)}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tasks.length === 0 && (
        <EmptyState
          title="No tasks found"
          description="No tasks are currently available in this work queue"
          icon="folder"
        />
      )}

      {/* Pagination Controls */}
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
                tasks
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

export default TaskLogTable;
