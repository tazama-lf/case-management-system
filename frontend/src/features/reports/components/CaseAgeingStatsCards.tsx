import React from 'react';
import { 
  CalendarDaysIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import StatsCard from '../../dashboard/components/StatsCard';
import type { CaseAgeingStats } from '../types/reports.types';

interface CaseAgeingStatsCardsProps {
  stats: CaseAgeingStats;
}

const CaseAgeingStatsCards: React.FC<CaseAgeingStatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      <StatsCard
        title="Avg. Case Age"
        value={`${stats.avgCaseAge} days`}
        subtitle="-2.3 days from previous period"
        icon={<CalendarDaysIcon className="h-6 w-6" />}
        color="blue"
      />
      <StatsCard
        title="Avg. Resolution Time"
        value={`${stats.avgResolutionTime} days`}
        subtitle="-1.5 days from previous period"
        icon={<ClockIcon className="h-6 w-6" />}
        color="green"
      />
      <StatsCard
        title="Cases > 15 Days"
        value={stats.casesOver15Days}
        subtitle="14.7% of all open cases"
        icon={<ExclamationTriangleIcon className="h-6 w-6" />}
        color="yellow"
      />
      <StatsCard
        title="Cases > 30 Days"
        value={stats.casesOver30Days}
        subtitle="2.9% of all open cases"
        icon={<ExclamationCircleIcon className="h-6 w-6" />}
        color="red"
      />
    </div>
  );
};

export default CaseAgeingStatsCards;
