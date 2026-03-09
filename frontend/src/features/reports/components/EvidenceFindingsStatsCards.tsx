import React, { Suspense } from 'react';
import {
  FolderIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon,
  EllipsisHorizontalCircleIcon,
  QuestionMarkCircleIcon,
} from '@heroicons/react/24/outline';
import type { EvidenceFindingsStats } from '../types/reports.types';

const StatsCard = React.lazy(
  async () => await import('../../dashboard/components/StatsCard'),
);

interface EvidenceFindingsStatsCardsProps {
  stats: EvidenceFindingsStats;
}

const EvidenceFindingsStatsCards: React.FC<EvidenceFindingsStatsCardsProps> = ({
  stats,
}) => {
  const statsCardsConfig = [
    {
      title: 'Findings',
      value: stats.totalFindings,
      icon: <DocumentTextIcon className="h-4 w-4" />,
      color: 'blue' as const,
    },
    {
      title: 'Evidences',
      value: stats.evidenceItems,
      icon: <FolderIcon className="h-4 w-4" />,
      color: 'green' as const,
    },
    {
      title: 'Confirmed',
      value: stats.confirmedFindings,
      icon: <CheckCircleIcon className="h-4 w-4" />,
      color: 'purple' as const,
    },
    {
      title: 'Refuted',
      value: stats.refutedFindings,
      icon: <XCircleIcon className="h-4 w-4" />,
      color: 'red' as const,
    },
    {
      title: 'Inconclusive',
      value: stats.inconclusiveFindings,
      icon: <QuestionMarkCircleIcon className="h-4 w-4" />,
      color: 'indigo' as const,
    },
    {
      title: 'In Progress',
      value: stats.inProgressFindings,
      icon: <EllipsisHorizontalCircleIcon className="h-4 w-4" />,
      color: 'yellow' as const,
    },
  ];

  return (
    <div className="grid grid-cols-6 gap-8 mb-8">
      {statsCardsConfig.map((card) => (
        <Suspense
          key={card.title}
          fallback={
            <div className="bg-gray-200 h-32 rounded-lg animate-pulse"></div>
          }
        >
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

export default EvidenceFindingsStatsCards;
