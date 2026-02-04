import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useMemo } from 'react';

export const useDynamicRoute = () => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  return {
    params,
    navigate,
    location,

    goToCaseDetail: (caseId: number) => navigate(`/cases/${caseId}`),
    goToAlertDetail: (alertId: number) => navigate(`/alerts/${alertId}`),
    goToReport: (reportType: string) => navigate(`/reports/${reportType}`),
    goBack: () => navigate(-1),

    getCurrentRoute: () => ({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      state: location.state
    })
  };
};


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

    getAllParams: () => Object.fromEntries(searchParams.entries())
  };
};

export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  DASHBOARD: '/dashboard',
  CASES: '/cases',
  CASE_DETAIL: '/cases/:caseId',
  ALERTS: '/alerts',
  ALERT_DETAIL: '/alerts/:alertId',
  REPORTS: '/reports',
  REPORT_DETAIL: '/reports/:reportType',
  ADMIN: '/admin',
  REFERENCE_ID: '/reference_id'
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