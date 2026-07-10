import React from 'react';
import {
  ExclamationTriangleIcon,
  FolderOpenIcon,
  ChartBarIcon,
  InboxIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';
import StatsCard from './StatsCard';
import type { DashboardStats } from '../types/dashboard.types';

const STATS_CARD_COLORS = {
  TOTAL_CASES: 'blue',
  AVAILABLE: 'indigo',
  OPEN_CASES: 'purple',
  RESOLVED: 'green',
  OVERDUE: 'red',
} as const;

interface StatsCardsProps {
  stats: DashboardStats;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const safeStats = {
    totalAlerts: stats?.totalAlerts ?? 0,
    highPriorityAlerts: stats?.highPriorityAlerts ?? 0,
    openCases: stats?.openCases ?? 0,
    casesResolvedThisWeek: stats?.casesResolvedThisWeek ?? 0,
    availableCases: stats?.availableCases ?? 0,
    openAssignedCases: stats?.openAssignedCases ?? stats?.openCases ?? 0,
    resolvedThisMonth:
      stats?.resolvedThisMonth ?? stats?.casesResolvedThisWeek ?? 0,
    overdueCases: stats?.overdueCases ?? 0,
  };

  const cardsData = [
    {
      title: 'Total Cases',
      value: safeStats.totalAlerts,
      icon: <ExclamationTriangleIcon className="h-6 w-6" />,
      color: STATS_CARD_COLORS.TOTAL_CASES,
      subtitle: 'Total count of cases in system',
    },
    {
      title: 'Available Cases',
      value: safeStats.availableCases,
      icon: <InboxIcon className="h-6 w-6" />,
      color: STATS_CARD_COLORS.AVAILABLE,
      subtitle: 'Cases requiring assignment',
    },
    {
      title: 'Open & Assigned Cases',
      value: safeStats.openAssignedCases,
      icon: <FolderOpenIcon className="h-6 w-6" />,
      color: STATS_CARD_COLORS.OPEN_CASES,
      subtitle: 'Currently being investigated',
    },
    {
      title: 'Overdue Cases',
      value: safeStats.overdueCases,
      icon: <ClockIcon className="h-6 w-6" />,
      color: STATS_CARD_COLORS.OVERDUE,
      subtitle: 'Open breached cases count',
    },
    {
      title: 'Resolved This Month',
      value: safeStats.resolvedThisMonth,
      icon: <ChartBarIcon className="h-6 w-6" />,
      color: STATS_CARD_COLORS.RESOLVED,
      subtitle: 'Successfully closed cases (MTD)',
    },
  ];

  return (
    <>
      <style>{`
        @keyframes fade-in-up {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fade-in-up {
          animation: fade-in-up 0.6s ease-out forwards;
        }
      `}</style>

      <div className="grid grid-cols-5 gap-4 mb-6">
        {cardsData.map((card, index) => (
          <div
            key={card.title || `stats-card-${index}`}
            className="transform transition-all duration-500 opacity-0 animate-fade-in-up"
            style={{
              animationDelay: `${index * 100}ms`,
              animationFillMode: 'forwards',
            }}
          >
            <StatsCard {...card} title={card.title || 'Stats Card'} />
          </div>
        ))}
      </div>
    </>
  );
};

export default StatsCards;
