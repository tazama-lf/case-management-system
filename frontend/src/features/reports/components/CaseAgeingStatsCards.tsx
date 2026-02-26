import React from 'react';
import {
  CalendarDaysIcon,
  ClockIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import StatsCard from '../../dashboard/components/StatsCard';
import type { CaseAgeingStats } from '../types/reports.types';

interface CaseAgeingStatsCardsProps {
  stats: CaseAgeingStats;
}

const DaysStatsCard: React.FC<{
  title: string;
  days: number | null | undefined;
  subtitle: string;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'yellow' | 'green';
}> = ({ title, days, subtitle, icon, color }) => {
  const formatDays = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return '0 days';
    }
    return `${Math.round(value)} days`;
  };

  const colorClasses = {
    blue: 'bg-blue-500 text-white shadow-blue-100',
    red: 'bg-red-500 text-white shadow-red-100',
    yellow: 'bg-yellow-500 text-white shadow-yellow-100',
    green: 'bg-green-500 text-white shadow-green-100',
  };

  const bgColorClasses = {
    blue: 'hover:bg-blue-50',
    red: 'hover:bg-red-50',
    yellow: 'hover:bg-yellow-50',
    green: 'hover:bg-green-50',
  };

  return (
    <div
      className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-500 hover:shadow-md hover:scale-105 cursor-pointer ${bgColorClasses[color]}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{formatDays(days)}</p>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div
          className={`p-3 rounded-lg ${colorClasses[color]} shadow-lg transition-transform duration-300 hover:scale-110`}
        >
          {icon}
        </div>
      </div>

      <div className="mt-4 h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full bg-${color}-500 transition-all duration-1000 ease-out`}
          style={{ width: '100%' }}
        />
      </div>
    </div>
  );
};

const CaseAgeingStatsCards: React.FC<CaseAgeingStatsCardsProps> = ({
  stats,
}) => {
  const formatCount = (value: number | null | undefined): number => {
    if (value === null || value === undefined || isNaN(value)) {
      return 0;
    }
    return Math.round(value);
  };

  return (
    <div className="grid grid-cols-4 gap-6 mb-8">
      <DaysStatsCard
        title="Avg. Case Age"
        days={stats.avgCaseAge}
        subtitle=""
        icon={<CalendarDaysIcon className="h-6 w-6" />}
        color="blue"
      />
      <DaysStatsCard
        title="Avg. Resolution Time"
        days={stats.avgResolutionTime}
        subtitle=""
        icon={<ClockIcon className="h-6 w-6" />}
        color="green"
      />
      <StatsCard
        title="Cases > 15 Days"
        value={formatCount(stats.casesOver15Days)}
        subtitle=""
        icon={<ExclamationTriangleIcon className="h-6 w-6" />}
        color="yellow"
      />
      <StatsCard
        title="Cases > 30 Days"
        value={formatCount(stats.casesOver30Days)}
        subtitle=""
        icon={<ExclamationCircleIcon className="h-6 w-6" />}
        color="red"
      />
    </div>
  );
};

export default CaseAgeingStatsCards;
