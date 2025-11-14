import React from 'react';
import type { CaseRow } from '../casesTable.utils';
import type { TaskForSupervisor } from '../../services/taskService';

interface CaseDetailsTabProps {
  row: CaseRow;
  tasks?: TaskForSupervisor[];
  loadingTasks?: boolean;
}

const SectionCard: React.FC<{ title?: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
    {title ? (
      <div className="mb-2 text-sm font-semibold text-gray-700">{title}</div>
    ) : null}
    <div className="text-sm text-gray-900">{children}</div>
  </div>
);

const getPriorityColor = (priority: string): string => {
  const priorityColors: Record<string, string> = {
    NEW: 'bg-blue-50 text-blue-700 ring-blue-200',
    URGENT: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
    CRITICAL: 'bg-orange-50 text-orange-700 ring-orange-200',
    BREACH: 'bg-red-50 text-red-700 ring-red-200',
  };
  return priorityColors[priority] || 'bg-gray-50 text-gray-700 ring-gray-200';
};

const CaseDetailsTab: React.FC<CaseDetailsTabProps> = ({ row, tasks = [], loadingTasks = false }) => {
  const getTaskStatusColor = (status: string): string => {
    const statusColors: Record<string, string> = {
      STATUS_01_UNASSIGNED: 'bg-gray-50 text-gray-700 ring-gray-200',
      STATUS_10_ASSIGNED: 'bg-blue-50 text-blue-700 ring-blue-200',
      STATUS_20_IN_PROGRESS: 'bg-yellow-50 text-yellow-700 ring-yellow-200',
      STATUS_21_BLOCKED: 'bg-orange-50 text-orange-700 ring-orange-200',
      STATUS_30_COMPLETED: 'bg-green-50 text-green-700 ring-green-200',
    };
    return statusColors[status] || 'bg-gray-50 text-gray-700 ring-gray-200';
  };

  const formatTaskStatus = (status: string): string => {
    const statusLabels: Record<string, string> = {
      STATUS_01_UNASSIGNED: 'Unassigned',
      STATUS_10_ASSIGNED: 'Assigned',
      STATUS_20_IN_PROGRESS: 'In Progress',
      STATUS_21_BLOCKED: 'Blocked',
      STATUS_30_COMPLETED: 'Completed',
    };
    return statusLabels[status] || status;
  };

  const getTaskPriority = (task: TaskForSupervisor): string => {
    // Try to get priority from task's case, fallback to case priority, then default to 'Medium'
    if (task.case?.priority) {
      return task.case.priority;
    }
    return row.priority || 'Medium';
  };

  const formatTaskId = (taskId: string): string => {
    // Format as TASK-INV-XXX where XXX is first 3 chars of UUID
    const shortId = taskId.substring(0, 8).replace(/-/g, '').substring(0, 3).toUpperCase();
    return `TASK-INV-${shortId}`;
  };

  return (
    <div className="space-y-4">
      {/* Tasks Information */}
      <div className="space-y-3">
        <div className="text-sm font-semibold text-gray-700">
          Task Information
        </div>
        {loadingTasks ? (
          <SectionCard>
            <div className="text-sm text-gray-500 text-center py-4">
              Loading tasks...
            </div>
          </SectionCard>
        ) : tasks.length === 0 ? (
          <SectionCard>
            <div className="text-sm text-gray-500 text-center py-4">
              No tasks found for this case
            </div>
          </SectionCard>
        ) : (
          <div className="space-y-3">
            {tasks.map((task) => (
              <SectionCard key={task.task_id}>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                    {/* Task ID */}
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Task ID
                      </div>
                      <div className="font-medium text-gray-900">
                        {formatTaskId(task.task_id)}
                      </div>
                    </div>

                    {/* Title */}
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Title
                      </div>
                      <div className="font-medium text-gray-900">
                        {task.name || 'Unnamed Task'}
                      </div>
                    </div>

                    {/* Status */}
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Status
                      </div>
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${getTaskStatusColor(task.status)}`}
                      >
                        {formatTaskStatus(task.status).toUpperCase()}
                      </span>
                    </div>

                    {/* Priority */}
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Priority
                      </div>
                      <span
                        className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${getPriorityColor(getTaskPriority(task))}`}
                      >
                        {getTaskPriority(task)}
                      </span>
                    </div>

                    {/* Created On */}
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Created On
                      </div>
                      <div className="font-medium text-gray-900">
                        {new Date(task.created_at).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: '2-digit',
                          year: 'numeric',
                        })}
                      </div>
                    </div>

                    {/* Assigned To */}
                    <div>
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Assigned To
                      </div>
                      <div className="font-medium text-gray-900">
                        {task.assignedUser?.username || 'Unassigned'}
                      </div>
                    </div>

                    {/* Description - Full Width */}
                    <div className="col-span-2">
                      <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                        Description
                      </div>
                      <div className="text-sm text-gray-700">
                        {task.description || 'No description provided'}
                      </div>
                    </div>
                  </div>

                  {/* Related Case Section */}
                  <div className="mt-6 pt-4 border-t border-gray-200">
                    <div className="text-xs font-semibold text-gray-700 uppercase mb-3">
                      Related Case
                    </div>
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      {/* Case ID */}
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                          Case ID
                        </div>
                        <div className="font-medium text-gray-900">
                          {row.id.substring(0, 8)}
                        </div>
                      </div>

                      {/* Case Type */}
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                          Case Type
                        </div>
                        <span
                          className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${row.typeColor}`}
                        >
                          {row.type || 'N/A'}
                        </span>
                      </div>

                      {/* Status */}
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                          Status
                        </div>
                        <span
                          className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ring-gray-200 ${row.statusColor}`}
                        >
                          {row.status}
                        </span>
                      </div>

                      {/* Priority */}
                      <div>
                        <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                          Priority
                        </div>
                        <span
                          className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${getPriorityColor(row.priority)}`}
                        >
                          {row.priority}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </SectionCard>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default CaseDetailsTab;
