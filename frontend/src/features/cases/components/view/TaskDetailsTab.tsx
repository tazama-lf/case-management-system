import React from 'react';
import type { CaseRow } from '../casesTable.utils';
import type { TaskForSupervisor } from '../../services/taskService';
import { formatDate } from '../../../../shared/utils/dateUtils';
import userService, { type UserDetails } from '../../services/userService';

interface TaskDetailsTabProps {
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

const TaskDetailsTab: React.FC<TaskDetailsTabProps> = ({
  row,
  tasks = [],
  loadingTasks = false,
}) => {
  const task = tasks.length > 0 ? tasks[0] : null;
  const [assignedUser, setAssignedUser] = React.useState<UserDetails | null>(
    null,
  );
  const [loadingUser, setLoadingUser] = React.useState(false);

  React.useEffect(() => {
    const fetchUserDetails = async () => {
      if (task?.assigned_user_id) {
        setLoadingUser(true);
        try {
          const userDetails = await userService.getUserDetailsById(
            task.assigned_user_id,
          );
          setAssignedUser(userDetails);
        } catch (error) {
          console.error('Failed to fetch user details:', error);
          setAssignedUser(null);
        } finally {
          setLoadingUser(false);
        }
      } else {
        setAssignedUser(null);
      }
    };

    fetchUserDetails();
  }, [task?.assigned_user_id]);

  const getTaskStatusColor = (status: string): string => {
    const statusConfig: Record<string, string> = {
      STATUS_01_UNASSIGNED: 'bg-gray-100 text-gray-800 ring-gray-200',
      STATUS_10_ASSIGNED: 'bg-blue-100 text-blue-800 ring-blue-200',
      STATUS_20_IN_PROGRESS: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
      STATUS_21_BLOCKED: 'bg-red-100 text-red-800 ring-red-200',
      STATUS_30_COMPLETED: 'bg-green-100 text-green-800 ring-green-200',

      UNASSIGNED: 'bg-gray-100 text-gray-800 ring-gray-200',
      ASSIGNED: 'bg-blue-100 text-blue-800 ring-blue-200',
      IN_PROGRESS: 'bg-yellow-100 text-yellow-800 ring-yellow-200',
      SUSPENDED: 'bg-red-100 text-red-800 ring-red-200',
      COMPLETED: 'bg-green-100 text-green-800 ring-green-200',
    };
    return statusConfig[status] || 'bg-gray-100 text-gray-800 ring-gray-200';
  };

  const formatTaskStatus = (status: string): string => {
    const statusLabels: Record<string, string> = {
      STATUS_01_UNASSIGNED: '01_UNASSIGNED',
      STATUS_10_ASSIGNED: '10_ASSIGNED',
      STATUS_20_IN_PROGRESS: '20_IN_PROGRESS',
      STATUS_21_BLOCKED: '21_BLOCKED',
      STATUS_30_COMPLETED: '30_COMPLETED',

      UNASSIGNED: 'UNASSIGNED',
      ASSIGNED: 'ASSIGNED',
      IN_PROGRESS: 'IN_PROGRESS',
      SUSPENDED: 'SUSPENDED',
      COMPLETED: 'COMPLETED',
    };
    return statusLabels[status] || status;
  };

  const getTaskPriority = (): string => {
    if (task?.case?.priority) {
      return task.case.priority;
    }
    return row.priority || 'NEW';
  };

  const formatTaskId = (taskId: number): any => taskId || 'No ID';

  const getCaseType = (): string => {
    if (task?.case?.case_type) {
      return task.case.case_type;
    }
    return row.type || 'N/A';
  };

  return (
    <div className="space-y-4">
      {/* Task Information */}
      <div className="space-y-3">
        <div className="text-sm font-semibold text-gray-700">
          Task Information
        </div>
        {loadingTasks ? (
          <SectionCard>
            <div className="text-sm text-gray-500 text-center py-4">
              Loading task...
            </div>
          </SectionCard>
        ) : !task ? (
          <SectionCard>
            <div className="text-sm text-gray-500 text-center py-4">
              No task information available
            </div>
          </SectionCard>
        ) : (
          <SectionCard>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                {/* Task ID */}
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Task ID
                  </div>
                  <div className="font-medium text-gray-900 font-mono text-sm">
                    {`TASK-${formatTaskId(task.task_id)}`}
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
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTaskStatusColor(task.status)}`}
                  >
                    {formatTaskStatus(task.status)}
                  </span>
                </div>

                {/* Priority */}
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Priority
                  </div>
                  <span
                    className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${getPriorityColor(getTaskPriority())}`}
                  >
                    {getTaskPriority()}
                  </span>
                </div>

                {/* Queue/Candidate Group */}
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Queue
                  </div>
                  <div className="font-medium text-gray-900">
                    {task.candidateGroup || '-'}
                  </div>
                </div>

                {/* Created On */}
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Created On
                  </div>
                  <div className="font-medium text-gray-900">
                    {formatDate(task.created_at)}
                  </div>
                </div>

                {/* Assigned To */}
                <div>
                  <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                    Assigned To
                  </div>
                  <div className="font-medium text-gray-900">
                    {loadingUser ? (
                      <span className="text-gray-400">Loading...</span>
                    ) : assignedUser ? (
                      `${assignedUser.firstName} ${assignedUser.lastName}`.trim() ||
                      assignedUser.username ||
                      'Unknown'
                    ) : task.assigned_user_id ? (
                      task.assigned_user_id.substring(0, 8)
                    ) : (
                      'Unassigned'
                    )}
                  </div>
                </div>
              </div>
            </div>
          </SectionCard>
        )}
      </div>

      {/* Related Case */}
      {task && (
        <div className="space-y-3">
          <div className="text-sm font-semibold text-gray-700">
            Related Case
          </div>
          <SectionCard>
            <div className="grid grid-cols-2 gap-x-8 gap-y-4">
              {/* Case ID */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                  Case ID
                </div>
                <div className="font-medium text-gray-900">
                  {`CASE-${task.case_id || row.id}`}
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
                  {getCaseType()}
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
                  {formatTaskStatus(row.status)}
                </span>
              </div>

              {/* Priority */}
              <div>
                <div className="text-xs font-semibold text-gray-500 uppercase mb-1">
                  Priority
                </div>
                <span
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-xs font-medium ring-1 ${getPriorityColor(getTaskPriority())}`}
                >
                  {getTaskPriority()}
                </span>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
};

export default TaskDetailsTab;
