import React, { Suspense } from 'react';
import {
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import type { CaseAgeingStats } from '../types/reports.types';

const StatsCard = React.lazy(
  async () => await import('../../dashboard/components/StatsCard'),
);

interface CaseAgeingStatsCardsProps {
  stats: CaseAgeingStats;
}

const formatDays = (value: number | null | undefined): string => {
  if (value === null || value === undefined || isNaN(value)) {
    return 'N/A';
  }
  return `${Math.round(value)} days`;
};

const formatCount = (value: number | null | undefined): number => {
  if (value === null || value === undefined || isNaN(value)) {
    return 0;
  }
  return Math.round(value);
};

/**
 * Open-backlog stat tiles - a live, as-of-now snapshot of open cases only.
 * `avgCaseAge` is null with an empty open population (rendered as N/A, not 0).
 * The 16-29 / 30+ tiers are non-overlapping: a case counts in exactly one.
 * Uses the same shared StatsCard as the Case Status Report (ReportStatsCards)
 * so the two reports' stat tiles look and animate identically.
 */
const CaseAgeingStatsCards: React.FC<CaseAgeingStatsCardsProps> = ({
  stats,
}) => {
  const statsCardsConfig = [
    {
      title: 'Avg. Case Age',
      subtitle: 'Open cases only',
      value: formatDays(stats.avgCaseAge),
      icon: <CalendarDaysIcon className="h-6 w-6" />,
      color: 'blue' as const,
    },
    {
      title: 'Cases 16-29 Days',
      subtitle: 'Open cases only',
      value: formatCount(stats.casesOver15Days),
      icon: <ExclamationTriangleIcon className="h-6 w-6" />,
      color: 'yellow' as const,
    },
    {
      title: 'Cases 30+ Days',
      subtitle: 'Open cases only',
      value: formatCount(stats.casesOver30Days),
      icon: <ExclamationCircleIcon className="h-6 w-6" />,
      color: 'red' as const,
    },
    {
      title: 'Avg. Resolution Time',
      subtitle: 'Closed cases only',
      value: formatDays(stats.avgResolutionTime),
      icon: <ClockIcon className="h-6 w-6" />,
      color: 'green' as const,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      {statsCardsConfig.map((card) => (
        <Suspense
          key={card.title}
          fallback={
            <div className="bg-gray-200 h-32 rounded-lg animate-pulse"></div>
          }
        >
          <StatsCard
            title={card.title}
            subtitle={card.subtitle}
            value={card.value}
            icon={card.icon}
            color={card.color}
          />
        </Suspense>
      ))}
    </div>
  );
};

export default CaseAgeingStatsCards;
