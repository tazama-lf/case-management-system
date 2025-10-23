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

// Helper function to safely format numeric values
const safeFormatNumber = (value: number | null | undefined, unit?: string, decimals = 0): string => {
  const safeValue = value === null || value === undefined || isNaN(value) || !isFinite(value) ? 0 : value;
  const formatted = decimals > 0 ? safeValue.toFixed(decimals) : Math.round(safeValue).toString();
  return unit ? `${formatted}${unit}` : formatted;
};

const InvestigatorStatsCards: React.FC<InvestigatorStatsCardsProps> = ({ stats }) => {
  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      <StatsCard
        title="Total Investigators"
        value={safeFormatNumber(stats.totalInvestigators)}
        subtitle="Active in last 30 days"
        icon={<UserGroupIcon className="h-6 w-6" />}
        color="blue"
      />
      <StatsCard
        title="Avg. Cases per Investigator"
        value={safeFormatNumber(stats.avgCasesPerInvestigator, '', 1)}
        subtitle="0.6 from previous period"
        icon={<ChartBarIcon className="h-6 w-6" />}
        color="green"
      />
      <StatsCard
        title="Avg. Resolution Time"
        value={safeFormatNumber(stats.avgResolutionTime, ' days', 1)}
        subtitle="1.8 days from previous period"
        icon={<ClockIcon className="h-6 w-6" />}
        color="yellow"
      />
      <StatsCard
        title="Case Closure Rate"
        value={safeFormatNumber(stats.caseClosureRate, '%', 1)}
        subtitle="-3.7% from previous period"
        icon={<CheckCircleIcon className="h-6 w-6" />}
        color="purple"
      />
    </div>
  );
};

export default InvestigatorStatsCards;
