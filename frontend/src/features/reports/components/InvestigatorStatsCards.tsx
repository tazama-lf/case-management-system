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

const safeFormatNumber = (value: number | string | undefined, unit = '', decimals = 0): string => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  const safeValue = numValue === null || numValue === undefined || isNaN(numValue) || !isFinite(numValue) ? 0 : numValue;
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
        subtitle=""
        icon={<ChartBarIcon className="h-6 w-6" />}
        color="green"
      />
      <StatsCard
        title="Avg. Resolution Time"
        value={safeFormatNumber(stats.avgResolutionTime, ' days', 0)}
        subtitle=""
        icon={<ClockIcon className="h-6 w-6" />}
        color="yellow"
      />
      <StatsCard
        title="Case Closure Rate"
        value={safeFormatNumber(stats.caseClosureRate, '%', 0)}
        subtitle=""
        icon={<CheckCircleIcon className="h-6 w-6" />}
        color="purple"
      />
    </div>
  );
};

export default InvestigatorStatsCards;
