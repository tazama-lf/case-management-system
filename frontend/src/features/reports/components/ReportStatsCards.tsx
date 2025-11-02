import React, { Suspense } from 'react';
import {
  FolderIcon,
  FolderOpenIcon,
  ClockIcon,
  CheckCircleIcon
} from '@heroicons/react/24/outline';
import type { CaseStatusStats } from '../types/reports.types';

const StatsCard = React.lazy(() => import('../../dashboard/components/StatsCard'));

interface ReportStatsCardsProps {
  stats: CaseStatusStats;
}

const ReportStatsCards: React.FC<ReportStatsCardsProps> = ({ stats }) => {
  const formatDays = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0 days';
    }
    return `${Math.round(value)} days`;
  };

  const statsCardsConfig = [
    {
      title: "Total Cases",
      value: stats.totalCases,
      icon: <FolderIcon className="h-6 w-6" />,
      color: "blue" as const,
    },
    {
      title: "Closed Cases",
      value: stats.closedCases,
      icon: <CheckCircleIcon className="h-6 w-6" />,
      color: "green" as const,
    },
    {
      title: "Open Cases",
      value: stats.openCases,
      icon: <FolderOpenIcon className="h-6 w-6" />,
      color: "yellow" as const,
    },
    {
      title: "Avg Resolution Time",
      value: formatDays(stats.avgResolutionTime),
      icon: <ClockIcon className="h-6 w-6" />,
      color: "red" as const,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      {statsCardsConfig.map((card) => (
        <Suspense key={card.title} fallback={<div className="bg-gray-200 h-32 rounded-lg animate-pulse"></div>}>
          <StatsCard
            title={card.title}
            value={card.value}
            icon={card.icon}
            color={card.color}
          />
        </Suspense>
      ))}
    </div>
  );
};

export default ReportStatsCards;
