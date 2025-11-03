import React from 'react';
import {
  ExclamationTriangleIcon,
  FolderOpenIcon,
  ChartBarIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import StatsCard from './StatsCard';
import type { DashboardStats } from '../types/dashboard.types';

const STATS_CARD_COLORS = {
  TOTAL_CASES: 'blue',
  HIGH_PRIORITY: 'red', 
  OPEN_CASES: 'yellow',
  RESOLVED: 'green'
} as const;

interface StatsCardsProps {
  stats: DashboardStats;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
 
  const safeStats = {
    totalAlerts: stats?.totalAlerts ?? 0,
    highPriorityAlerts: stats?.highPriorityAlerts ?? 0,
    openCases: stats?.openCases ?? 0,
    casesResolvedThisWeek: stats?.casesResolvedThisWeek ?? 0
  };

  const cardsData = [
    {
      title: "Total Cases",
      value: safeStats.totalAlerts,
      icon: <ExclamationTriangleIcon className="h-6 w-6" />,
      color: STATS_CARD_COLORS.TOTAL_CASES,
      subtitle: "All cases in system"
    },
    {
      title: "High Priority Cases", 
      value: safeStats.highPriorityAlerts,
      icon: <ExclamationCircleIcon className="h-6 w-6" />,
      color: STATS_CARD_COLORS.HIGH_PRIORITY,
      subtitle: "Requiring immediate attention"
    },
    {
      title: "Open Cases",
      value: safeStats.openCases,
      icon: <FolderOpenIcon className="h-6 w-6" />,
      color: STATS_CARD_COLORS.OPEN_CASES,
      subtitle: "Currently being investigated"
    },
    {
      title: "Resolved This Month",
      value: safeStats.casesResolvedThisWeek,
      icon: <ChartBarIcon className="h-6 w-6" />,
      color: STATS_CARD_COLORS.RESOLVED,
      subtitle: "Successfully closed cases"
    }
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

      <div className="grid grid-cols-4 gap-6 mb-8">
        {cardsData.map((card, index) => (
          <div
            key={card.title || `stats-card-${index}`}
            className="transform transition-all duration-500 opacity-0 animate-fade-in-up"
            style={{
              animationDelay: `${index * 150}ms`,
              animationFillMode: 'forwards'
            }}
          >
            <StatsCard 
              {...card} 
              title={card.title || 'Stats Card'}
            />
          </div>
        ))}
      </div>
    </>
  );
};

export default StatsCards;
