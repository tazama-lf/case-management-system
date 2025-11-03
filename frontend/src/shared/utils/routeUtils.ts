import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useMemo } from 'react';

/**
 * Custom hook for handling dynamic route parameters
 */
export const useDynamicRoute = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  return {
    params,
    navigate,
    location,
    // Helper functions for common navigation patterns
    goToCaseDetail: (caseId: string) => navigate(`/cases/${caseId}`),
    goToAlertDetail: (alertId: string) => navigate(`/alerts/${alertId}`),
    goToWorkQueueTask: (taskId: string) => navigate(`/work-queue/${taskId}`),
    goToReport: (reportType: string) => navigate(`/reports/${reportType}`),
    goBack: () => navigate(-1),
    // Helper to get current route info
    getCurrentRoute: () => ({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      state: location.state
    })
  };
};

/**
 * Custom hook for managing URL search parameters
 */
export const useUrlParams = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(() => {
    return new URLSearchParams(location.search);
  }, [location.search]);

  const updateParams = (newParams: Record<string, string | null>) => {
    const updatedParams = new URLSearchParams(searchParams);
    
    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null) {
        updatedParams.delete(key);
      } else {
        updatedParams.set(key, value);
      }
    });

    navigate({
      pathname: location.pathname,
      search: updatedParams.toString()
    }, { replace: true });
  };

  const getParam = (key: string): string | null => {
    return searchParams.get(key);
  };

  const setParam = (key: string, value: string | null) => {
    updateParams({ [key]: value });
  };

  const removeParam = (key: string) => {
    updateParams({ [key]: null });
  };

  return {
    searchParams,
    getParam,
    setParam,
    removeParam,
    updateParams,
    // Helper to get all params as object
    getAllParams: () => Object.fromEntries(searchParams.entries())
  };
};

/**
 * Route path constants for type safety
 */
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  CASES: '/cases',
  CASE_DETAIL: '/cases/:caseId',
  ALERTS: '/alerts',
  ALERT_DETAIL: '/alerts/:alertId',
  WORK_QUEUE: '/work-queue',
  WORK_QUEUE_TASK: '/work-queue/:taskId',
  REPORTS: '/reports',
  REPORT_DETAIL: '/reports/:reportType',
  ADMIN: '/admin'
} as const;

/**
 * Helper function to build dynamic routes with parameters
 */
export const buildRoute = (route: string, params: Record<string, string>): string => {
  let builtRoute = route;
  Object.entries(params).forEach(([key, value]) => {
    builtRoute = builtRoute.replace(`:${key}`, value);
  });
  return builtRoute;
};

/**
 * Helper function to check if current route matches a pattern
 */
export const matchesRoute = (pathname: string, route: string): boolean => {
  const routePattern = route.replace(/:[^/]+/g, '[^/]+');
  const regex = new RegExp(`^${routePattern}$`);
  return regex.test(pathname);
};

export default {
  useDynamicRoute,
  useUrlParams,
  ROUTES,
  buildRoute,
  matchesRoute
};