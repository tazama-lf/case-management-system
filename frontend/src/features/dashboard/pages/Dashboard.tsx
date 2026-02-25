import React, { useEffect, useState } from 'react';
import {
  PageContainer,
  LoadingState,
  ErrorState,
} from '@/shared/components/ui';
import StatsCards from '@/features/dashboard/components/StatsCards';
import DashboardSection from '@/features/dashboard/components/DashboardSection';
import AlertSummaryItem from '@/features/dashboard/components/AlertSummaryItem';
import CaseSummaryItem from '@/features/dashboard/components/CaseSummaryItem';
import { useDashboard } from '@/features/dashboard/hooks/useDashboard';

const Dashboard: React.FC = () => {
  const { data: dashboardData, isLoading, error } = useDashboard();
  const [isAnimated, setIsAnimated] = useState(false);

  useEffect(() => {
    if (dashboardData && !isLoading) {
      const timer = setTimeout(() => {
        setIsAnimated(true);
      }, 100);
      return () => {
        clearTimeout(timer);
      };
    }
  }, [dashboardData, isLoading]);

  if (isLoading) {
    return (
      <PageContainer
        title="Dashboard"
        subtitle="Welcome to the Fraud Case Management System"
      >
        <LoadingState
          loading={true}
          loadingComponent={
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
          }
        >
          <div /> {/* Empty children required by LoadingState */}
        </LoadingState>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer
        title="Dashboard"
        subtitle="Welcome to the Fraud Case Management System"
      >
        <ErrorState
          title="Dashboard Error"
          message="Failed to load dashboard data. Please try again."
          showRetry={true}
          onRetry={() => {
            window.location.reload();
          }}
          severity="error"
        />
      </PageContainer>
    );
  }

  const { stats, recentAlerts, activeCases } = dashboardData || {
    stats: {
      totalAlerts: 0,
      highPriorityAlerts: 0,
      openCases: 0,
      casesResolvedThisWeek: 0,
    },
    recentAlerts: [],
    activeCases: [],
  };

  return (
    <PageContainer
      title="Dashboard"
      subtitle="Welcome to the Fraud Case Management System"
    >
      <div
        className={`transition-all duration-700 ${isAnimated ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'}`}
      >
        <StatsCards stats={stats} />

        <div className="grid grid-cols-2 gap-8">
          <div
            className={`transition-all duration-500 delay-300 ${isAnimated ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform -translate-x-4'}`}
          >
            <DashboardSection
              title="Recent Alerts"
              subtitle="Latest alerts requiring your attention"
              viewAllHref="/alerts"
            >
              {recentAlerts.length > 0 ? (
                recentAlerts.map((alert, index) => (
                  <div
                    key={index}
                    className={`transition-all duration-300 ${isAnimated ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-2'}`}
                    style={{ transitionDelay: `${600 + index * 100}ms` }}
                  >
                    <AlertSummaryItem alert={alert} />
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No recent alerts</p>
              )}
            </DashboardSection>
          </div>

          <div
            className={`transition-all duration-500 delay-500 ${isAnimated ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform translate-x-4'}`}
          >
            <DashboardSection
              title="Active Cases"
              subtitle="Cases currently in progress"
              viewAllHref="/cases"
            >
              {activeCases.length > 0 ? (
                activeCases.map((caseItem, index) => (
                  <div
                    key={index}
                    className={`transition-all duration-300 ${isAnimated ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-2'}`}
                    style={{ transitionDelay: `${800 + index * 100}ms` }}
                  >
                    <CaseSummaryItem case={caseItem} />
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-sm">No active cases</p>
              )}
            </DashboardSection>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default Dashboard;
