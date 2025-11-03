import React from 'react';
import {
  DocumentTextIcon,
  FolderIcon,
  UserIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import StatsCard from '@/features/dashboard/components/StatsCard';
import { formatNumber } from '@/shared/utils/numberUtils';
import type { AuditLogsStats } from '../types/reports.types';

interface AuditLogsStatsCardsProps {
  stats: AuditLogsStats;
}

const AuditLogsStatsCards: React.FC<AuditLogsStatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      <StatsCard
        title="Total Audit Logs"
        value={formatNumber(stats.totalLogs)}
        subtitle="Last 30 days"
        icon={<DocumentTextIcon className="h-6 w-6" />}
        color="blue"
      />
      <StatsCard
        title="Case Actions"
        value={stats.caseActions}
        subtitle="43% of all actions"
        icon={<FolderIcon className="h-6 w-6" />}
        color="green"
      />
      <StatsCard
        title="User Sessions"
        value={stats.userSessions}
        subtitle="25% of all actions"
        icon={<UserIcon className="h-6 w-6" />}
        color="yellow"
      />
      <StatsCard
        title="System Warnings"
        value={stats.systemWarnings}
        subtitle="1% of all actions"
        icon={<ExclamationTriangleIcon className="h-6 w-6" />}
        color="red"
      />
    </div>
  );
};

export default AuditLogsStatsCards;
