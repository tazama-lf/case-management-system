import React from 'react';
import {
  UserGroupIcon,
  ChartBarIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import StatsCard from '../../dashboard/components/StatsCard';
import type { InvestigatorStats } from '../types/reports.types';

interface InvestigatorStatsCardsProps {
  stats: InvestigatorStats;
}

const InvestigatorStatsCards: React.FC<InvestigatorStatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      <StatsCard
        title="Total Investigators"
        value={stats.totalInvestigators}
        subtitle="Active in last 30 days"
        icon={<UserGroupIcon className="h-6 w-6" />}
        color="blue"
      />
      <StatsCard
        title="Avg. Cases per Investigator"
        value={stats.avgCasesPerInvestigator}
        subtitle="0.6 from previous period"
        icon={<ChartBarIcon className="h-6 w-6" />}
        color="green"
      />
      <StatsCard
        title="Avg. Resolution Time"
        value={`${stats.avgResolutionTime} days`}
        subtitle="1.8 days from previous period"
        icon={<ClockIcon className="h-6 w-6" />}
        color="yellow"
      />
      <StatsCard
        title="Case Closure Rate"
        value={`${stats.caseClosureRate}%`}
        subtitle="-3.7% from previous period"
        icon={<CheckCircleIcon className="h-6 w-6" />}
        color="purple"
      />
    </div>
  );
};

export default InvestigatorStatsCards;
