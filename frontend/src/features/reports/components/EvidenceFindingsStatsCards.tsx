import React, { Suspense } from 'react';
import {
  FolderIcon,
  CheckCircleIcon,
  XCircleIcon,
  DocumentTextIcon
} from '@heroicons/react/24/outline';
import type { EvidenceFindingsStats } from '../types/reports.types';

const StatsCard = React.lazy(() => import('../../dashboard/components/StatsCard'));

interface EvidenceFindingsStatsCardsProps {
  stats: EvidenceFindingsStats;
}

const EvidenceFindingsStatsCards: React.FC<EvidenceFindingsStatsCardsProps> = ({ stats }) => {
  const statsCardsConfig = [
    {
      title: "Total Findings",
      value: stats.totalFindings,
      icon: <DocumentTextIcon className="h-6 w-6" />,
      color: "blue" as const,
    },
    {
      title: "Evidence Items",
      value: stats.evidenceItems,
      icon: <FolderIcon className="h-6 w-6" />,
      color: "green" as const,
    },
    {
      title: "Confirmed",
      value: stats.confirmedFindings,
      icon: <CheckCircleIcon className="h-6 w-6" />,
      color: "purple" as const,
    },
    {
      title: "Refuted",
      value: stats.refutedFindings,
      icon: <XCircleIcon className="h-6 w-6" />,
      color: "red" as const,
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-8 mb-8">
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

export default EvidenceFindingsStatsCards;
