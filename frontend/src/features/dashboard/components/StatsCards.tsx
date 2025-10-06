import React from 'react';
import { 
  ExclamationTriangleIcon, 
  FolderOpenIcon, 
  ChartBarIcon,
  ExclamationCircleIcon 
} from '@heroicons/react/24/outline';
import StatsCard from './StatsCard';
import type { DashboardStats } from '../types/dashboard.types';

interface StatsCardsProps {
  stats: DashboardStats;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      <StatsCard
        title="Total Alerts"
        value={stats.totalAlerts}
        icon={<ExclamationTriangleIcon className="h-6 w-6" />}
        color="blue"
      />
      <StatsCard
        title="High Priority Alerts"
        value={stats.highPriorityAlerts}
        icon={<ExclamationCircleIcon className="h-6 w-6" />}
        color="red"
      />
      <StatsCard
        title="Open Cases"
        value={stats.openCases}
        icon={<FolderOpenIcon className="h-6 w-6" />}
        color="yellow"
      />
      <StatsCard
        title="Cases Resolved (This Week)"
        value={stats.casesResolvedThisWeek}
        icon={<ChartBarIcon className="h-6 w-6" />}
        color="green"
      />
    </div>
  );
};

export default StatsCards;
