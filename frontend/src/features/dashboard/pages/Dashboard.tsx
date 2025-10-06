import React from 'react';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { PageContainer } from '../../../shared/components/ui';
import StatsCards from '../components/StatsCards';
import DashboardSection from '../components/DashboardSection';
import AlertSummaryItem from '../components/AlertSummaryItem';
import CaseSummaryItem from '../components/CaseSummaryItem';
import { useDashboard } from '../hooks/useDashboard';

const Dashboard: React.FC = () => {
  const { data: dashboardData, isLoading, error } = useDashboard();

  if (isLoading) {
    return (
      <PageContainer
        title="Dashboard"
        subtitle="Welcome to the Fraud Case Management System"
      >
        <div className="animate-pulse">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-gray-200 h-32 rounded-lg"></div>
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-gray-200 h-64 rounded-lg"></div>
            <div className="bg-gray-200 h-64 rounded-lg"></div>
          </div>
        </div>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer
        title="Dashboard"
        subtitle="Welcome to the Fraud Case Management System"
      >
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center">
            <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
            <p className="text-red-700">Failed to load dashboard data. Please try again.</p>
          </div>
        </div>
      </PageContainer>
    );
  }

  const { stats, recentAlerts, activeCases } = dashboardData || {
    stats: { totalAlerts: 0, highPriorityAlerts: 0, openCases: 0, casesResolvedThisWeek: 0 },
    recentAlerts: [],
    activeCases: []
  };

  return (
    <PageContainer
      title="Dashboard"
      subtitle="Welcome to the Fraud Case Management System"
    >
      <StatsCards stats={stats} />

      <div className="grid grid-cols-2 gap-8">
        <DashboardSection
          title="Recent Alerts"
          subtitle="Latest alerts requiring your attention"
          viewAllHref="/alerts"
        >
          {recentAlerts.length > 0 ? (
            recentAlerts.map((alert, index) => (
              <AlertSummaryItem key={index} alert={alert} />
            ))
          ) : (
            <p className="text-gray-500 text-sm">No recent alerts</p>
          )}
        </DashboardSection>

        <DashboardSection
          title="Active Cases"
          subtitle="Cases currently in progress"
          viewAllHref="/cases"
        >
          {activeCases.length > 0 ? (
            activeCases.map((caseItem, index) => (
              <CaseSummaryItem key={index} case={caseItem} />
            ))
          ) : (
            <p className="text-gray-500 text-sm">No active cases</p>
          )}
        </DashboardSection>
      </div>
    </PageContainer>
  );
};

export default Dashboard;
