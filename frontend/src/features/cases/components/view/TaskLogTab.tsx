import React from 'react';
<<<<<<< HEAD
import { CogIcon } from '@heroicons/react/24/outline';
=======
>>>>>>> b610ca14c62be40a6b4464adec8d2995e9c999d7

const StatusBadge: React.FC<{ status: 'Complete' | 'In-Progress' | 'Pending' }>= ({ status }) => {
  const map = {
    Complete: 'bg-green-100 text-green-800',
    'In-Progress': 'bg-yellow-100 text-yellow-800',
    Pending: 'bg-gray-100 text-gray-700',
  } as const;
  return <span className={`rounded-full px-2 py-0.5 text-xs ${map[status]}`}>{status}</span>;
};

const TaskItem: React.FC<{
  title: string;
  assignee?: string;
  created: string;
  status: 'Complete' | 'In-Progress' | 'Pending';
  completedBy?: string;
}> = ({ title, assignee, created, status, completedBy }) => (
  <div className="rounded-md border border-gray-200 bg-white p-4">
    <div className="flex items-start justify-between">
      <div>
        <div className="text-sm font-medium text-gray-900">{title}</div>
        <div className="mt-1 text-xs text-gray-500">
          {assignee ? (
            <>
              Assigned to: {assignee}
            </>
          ) : (
            <>Unassigned</>
          )}
        </div>
        {completedBy && (
          <div className="mt-1 text-xs text-gray-500">Completed by {completedBy}</div>
        )}
      </div>
      <div className="text-right">
        <div>
          <StatusBadge status={status} />
        </div>
        <div className="mt-1 text-xs text-gray-500">Created: {created}</div>
      </div>
    </div>
  </div>
);

const TaskLogTab: React.FC = () => {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1">
          <input
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            placeholder="Search tasks..."
          />
        </div>
        <div>
          <button className="inline-flex items-center gap-2 rounded-md border px-3 py-2 text-sm text-gray-700 shadow-sm hover:bg-gray-50">
<<<<<<< HEAD
            <CogIcon className="h-4 w-4" />
=======
            <span>⚙️</span>
>>>>>>> b610ca14c62be40a6b4464adec8d2995e9c999d7
            <span>Status: All</span>
          </button>
        </div>
      </div>

      <div className="space-y-3">
        <TaskItem title="Alert Triage" status="Complete" created="9/5/2025, 9:06:49 AM" completedBy="System" />
        <TaskItem title="Investigate" status="In-Progress" created="9/5/2025, 9:06:49 AM" assignee="John Smith" />
      </div>
    </div>
  );
};

export default TaskLogTab;
