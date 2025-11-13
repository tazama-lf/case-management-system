import React from 'react';
import {
  ExclamationTriangleIcon,
  FolderOpenIcon,
  ChartBarIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import StatsCard from './StatsCard.tsx';
import type { AdminDashboardStats } from '../types/admindashboard.types';

interface StatsCardsProps {
  stats: AdminDashboardStats;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      <StatsCard
        title="Active Work Queues"
        value={stats.activeWorkQueues}
        icon={<ExclamationTriangleIcon className="h-6 w-6" />}
        color="blue"
      />
      <StatsCard
        title="User Accounts"
        value={stats.userAccounts}
        icon={<ExclamationCircleIcon className="h-6 w-6" />}
        color="red"
      />
      <StatsCard
        title="System Roles"
        value={stats.systemRoles}
        icon={<FolderOpenIcon className="h-6 w-6" />}
        color="yellow"
      />
      <StatsCard
        title="Pending Approvals"
        value={stats.pendingApprovals}
        icon={<ChartBarIcon className="h-6 w-6" />}
        color="green"
      />
    </div>
  );
};

export default StatsCards;
