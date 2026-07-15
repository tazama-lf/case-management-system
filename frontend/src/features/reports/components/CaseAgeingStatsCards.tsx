import React from 'react';
import {
  CalendarDaysIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';
import type { CaseAgeingStats } from '../types/reports.types';

export const DaysStatsCard: React.FC<{
  title: string;
  days: number | null | undefined;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'yellow' | 'green';
}> = ({ title, days, subtitle, icon, color }) => {
  const formatDays = (value: number | null | undefined): string => {
    if (value === null || value === undefined || isNaN(value)) {
      return 'N/A';
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

const CountStatsCard: React.FC<{
  title: string;
  value: number | null | undefined;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'red' | 'yellow' | 'green';
}> = ({ title, value, subtitle, icon, color }) => {
  const formatCount = (raw: number | null | undefined): number => {
    if (raw === null || raw === undefined || isNaN(raw)) {
      return 0;
    }
    return Math.round(raw);
  };

  const colorClasses = {
    blue: 'bg-blue-500 text-white shadow-blue-100',
    red: 'bg-red-500 text-white shadow-red-100',
    yellow: 'bg-yellow-500 text-white shadow-yellow-100',
    green: 'bg-green-500 text-white shadow-green-100',
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 transition-all duration-500 hover:shadow-md hover:scale-105 cursor-pointer">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">
            {formatCount(value)}
          </p>
          <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
        </div>
        <div
          className={`p-3 rounded-lg ${colorClasses[color]} shadow-lg transition-transform duration-300 hover:scale-110`}
        >
          {icon}
        </div>
      </div>
    </div>
  );
};

interface CaseAgeingStatsCardsProps {
  stats: CaseAgeingStats;
}

/**
 * Open-backlog stat tiles - a live, as-of-now snapshot of open cases only.
 * `avgCaseAge` is null with an empty open population (rendered as N/A, not 0).
 * The 15-30 / 30+ tiers are non-overlapping: a case counts in exactly one.
 */
const CaseAgeingStatsCards: React.FC<CaseAgeingStatsCardsProps> = ({
  stats,
}) => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 mb-8">
    <DaysStatsCard
      title="Avg. Case Age"
      subtitle="Open cases only"
      days={stats.avgCaseAge}
      icon={<CalendarDaysIcon className="h-6 w-6" />}
      color="blue"
    />
    <CountStatsCard
      title="Cases 15-30 Days"
      subtitle="Open cases only"
      value={stats.casesOver15Days}
      icon={<ExclamationTriangleIcon className="h-6 w-6" />}
      color="yellow"
    />
    <CountStatsCard
      title="Cases 30+ Days"
      subtitle="Open cases only"
      value={stats.casesOver30Days}
      icon={<ExclamationCircleIcon className="h-6 w-6" />}
      color="red"
    />
  </div>
);

export default CaseAgeingStatsCards;
