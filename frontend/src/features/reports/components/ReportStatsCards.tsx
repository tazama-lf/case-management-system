import React from 'react';
import {
  FolderIcon,
  FolderOpenIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import StatsCard from '../../dashboard/components/StatsCard';
import type { CaseStatusStats } from '../types/reports.types';

interface ReportStatsCardsProps {
  stats: CaseStatusStats;
}

const ReportStatsCards: React.FC<ReportStatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      <StatsCard
        title="Total Cases"
        value={stats.totalCases}
        icon={<FolderIcon className="h-6 w-6" />}
        color="blue"
      />
      <StatsCard
        title="Closed Cases"
        value={stats.closedCases}
        icon={<CheckCircleIcon className="h-6 w-6" />}
        color="green"
      />
      <StatsCard
        title="Open Cases"
        value={stats.openCases}
        icon={<FolderOpenIcon className="h-6 w-6" />}
        color="yellow"
      />
      <StatsCard
        title="Avg Resolution Time"
        value={stats.avgResolutionTime}
        icon={<ClockIcon className="h-6 w-6" />}
        color="red"
      />
    </div>
  );
};

export default ReportStatsCards;
