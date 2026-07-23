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

const MAX_VISIBLE_SUMMARY_ITEMS = 3;

const Dashboard: React.FC = () => {
  const { data: dashboardData, isLoading, error } = useDashboard();
  const [isAnimated, setIsAnimated] = useState(false);
  const [showAllRecentCases, setShowAllRecentCases] = useState(false);
  const [showAllActiveCases, setShowAllActiveCases] = useState(false);

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
        subtitle="Welcome to the Fraud Case Management System."
      >
        <LoadingState
          loading={true}
          loadingComponent={
            <div className="animate-pulse">
              <div className="grid grid-cols-5 gap-4 mb-6">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="bg-gray-200 h-32 rounded-xl"></div>
                ))}
              </div>
              <div className="grid grid-cols-2 gap-6">
                <div className="bg-gray-200 h-64 rounded-xl"></div>
                <div className="bg-gray-200 h-64 rounded-xl"></div>
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

  const { stats, recentCases, activeCases } = dashboardData ?? {
    stats: {
      totalAlerts: 0,
      highPriorityAlerts: 0,
      openCases: 0,
      casesResolvedThisWeek: 0,
      availableCases: 0,
      openAssignedCases: 0,
      resolvedThisMonth: 0,
      overdueCases: 0,
    },
    recentCases: [],
    activeCases: [],
  };

  const maxRecentCaseCount = recentCases.reduce(
    (max, item) => Math.max(max, item.count),
    0,
  );
  const maxActiveCaseCount = activeCases.reduce(
    (max, item) => Math.max(max, item.count),
    0,
  );

  const visibleRecentCases = showAllRecentCases
    ? recentCases
    : recentCases.slice(0, MAX_VISIBLE_SUMMARY_ITEMS);
  const hiddenRecentCaseCount = showAllRecentCases
    ? 0
    : Math.max(0, recentCases.length - MAX_VISIBLE_SUMMARY_ITEMS);
  const visibleActiveCases = showAllActiveCases
    ? activeCases
    : activeCases.slice(0, MAX_VISIBLE_SUMMARY_ITEMS);
  const hiddenActiveCaseCount = showAllActiveCases
    ? 0
    : Math.max(0, activeCases.length - MAX_VISIBLE_SUMMARY_ITEMS);

  return (
    <PageContainer
      title="Dashboard"
      subtitle="Welcome to the Fraud Case Management System."
    >
      <div
        className={`transition-all duration-700 ${isAnimated ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-4'}`}
      >
        <StatsCards stats={stats} />

        <div className="grid grid-cols-2 gap-6">
          <div
            className={`transition-all duration-500 delay-300 ${isAnimated ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform -translate-x-4'}`}
          >
            <DashboardSection
              title="Open Cases by Priority"
              subtitle="All open cases by priority"
              viewAllHref="/cases"
            >
              {recentCases.length > 0 ? (
                <>
                  {visibleRecentCases.map((cases, index) => (
                    <div
                      key={index}
                      className={`transition-all duration-300 ${isAnimated ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-2'}`}
                      style={{ transitionDelay: `${600 + index * 100}ms` }}
                    >
                      <a
                        href={`/cases?priority=${encodeURIComponent(cases.priority.toUpperCase())}`}
                        aria-label={`View open ${cases.priority.toLowerCase()} priority cases`}
                        className="block rounded-md hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <AlertSummaryItem
                          summary={cases}
                          maxCount={maxRecentCaseCount}
                        />
                      </a>
                    </div>
                  ))}
                  {hiddenRecentCaseCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllRecentCases(true)}
                      className="block w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 pt-2.5"
                    >
                      +{hiddenRecentCaseCount} more
                    </button>
                  )}
                  {showAllRecentCases &&
                    recentCases.length > MAX_VISIBLE_SUMMARY_ITEMS && (
                      <button
                        type="button"
                        onClick={() => setShowAllRecentCases(false)}
                        className="block w-full text-center text-sm font-medium text-gray-500 hover:text-gray-700 pt-2.5"
                      >
                        Show less
                      </button>
                    )}
                </>
              ) : (
                <p className="text-gray-500 text-sm">
                  No open cases by priority
                </p>
              )}
            </DashboardSection>
          </div>

          <div
            className={`transition-all duration-500 delay-500 ${isAnimated ? 'opacity-100 transform translate-x-0' : 'opacity-0 transform translate-x-4'}`}
          >
            <DashboardSection
              title="Open Cases by Status"
              subtitle="All open cases by status"
              viewAllHref="/cases"
            >
              {activeCases.length > 0 ? (
                <>
                  {visibleActiveCases.map((caseItem, index) => (
                    <div
                      key={index}
                      className={`transition-all duration-300 ${isAnimated ? 'opacity-100 transform translate-y-0' : 'opacity-0 transform translate-y-2'}`}
                      style={{ transitionDelay: `${800 + index * 100}ms` }}
                    >
                      <a
                        href={`/cases?status=${encodeURIComponent(caseItem.status)}`}
                        aria-label={`View open cases with status ${caseItem.status}`}
                        className="block rounded-md hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <CaseSummaryItem
                          case={caseItem}
                          maxCount={maxActiveCaseCount}
                        />
                      </a>
                    </div>
                  ))}
                  {hiddenActiveCaseCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAllActiveCases(true)}
                      className="block w-full text-center text-sm font-medium text-blue-600 hover:text-blue-700 pt-2.5"
                    >
                      +{hiddenActiveCaseCount} more
                    </button>
                  )}
                  {showAllActiveCases &&
                    activeCases.length > MAX_VISIBLE_SUMMARY_ITEMS && (
                      <button
                        type="button"
                        onClick={() => setShowAllActiveCases(false)}
                        className="block w-full text-center text-sm font-medium text-gray-500 hover:text-gray-700 pt-2.5"
                      >
                        Show less
                      </button>
                    )}
                </>
              ) : (
                <p className="text-gray-500 text-sm">No open cases by status</p>
              )}
            </DashboardSection>
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default Dashboard;
