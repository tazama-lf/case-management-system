import React from 'react';
import {
  ExclamationTriangleIcon,
  FolderOpenIcon,
  ChartBarIcon,
  ExclamationCircleIcon
} from '@heroicons/react/24/outline';
import StatsCard from './StatsCard';
import type { DashboardStats } from '../types/dashboard.types';

interface StatsCardsProps {
  stats: DashboardStats;
}

const StatsCards: React.FC<StatsCardsProps> = ({ stats }) => {
  const cardsData = [
    {
      title: "Total Cases",
      value: stats.totalAlerts,
      icon: <ExclamationTriangleIcon className="h-6 w-6" />,
      color: "blue" as const,
      subtitle: "All cases in system"
    },
    {
      title: "High Priority Cases",
      value: stats.highPriorityAlerts,
      icon: <ExclamationCircleIcon className="h-6 w-6" />,
      color: "red" as const,
      subtitle: "Requiring immediate attention"
    },
    {
      title: "Open Cases",
      value: stats.openCases,
      icon: <FolderOpenIcon className="h-6 w-6" />,
      color: "yellow" as const,
      subtitle: "Currently being investigated"
    },
    {
      title: "Resolved This Month",
      value: stats.casesResolvedThisWeek,
      icon: <ChartBarIcon className="h-6 w-6" />,
      color: "green" as const,
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
            key={card.title}
            className="transform transition-all duration-500 opacity-0 animate-fade-in-up"
            style={{
              animationDelay: `${index * 150}ms`,
              animationFillMode: 'forwards'
            }}
          >
            <StatsCard {...card} />
          </div>
        ))}
      </div>
    </>
  );
};

export default StatsCards;
