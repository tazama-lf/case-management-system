import React from 'react';
import {
  ClipboardDocumentListIcon,
  ChartBarIcon,
  ClockIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import StatsCard from '../../dashboard/components/StatsCard';
import type { TaskStats } from '../types/reports.types';

interface TaskStatsCardsProps {
  stats: TaskStats;
}

const TaskStatsCards: React.FC<TaskStatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      <StatsCard
        title="Total Tasks"
        value={stats.totalTasks}
        subtitle="+4% from previous period"
        icon={<ClipboardDocumentListIcon className="h-6 w-6" />}
        color="blue"
      />
      <StatsCard
        title="Completion Rate"
        value={`${stats.completionRate}%`}
        subtitle="+3.2% from previous period"
        icon={<ChartBarIcon className="h-6 w-6" />}
        color="green"
      />
      <StatsCard
        title="Avg. Completion Time"
        value={`${stats.avgCompletionTime} days`}
        subtitle="-0.5 days from previous period"
        icon={<ClockIcon className="h-6 w-6" />}
        color="orange"
      />
      <StatsCard
        title="Overdue Tasks"
        value={stats.overdueTasks}
        subtitle="+2 from previous period"
        icon={<ExclamationTriangleIcon className="h-6 w-6" />}
        color="red"
      />
    </div>
  );
};

export default TaskStatsCards;
