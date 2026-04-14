import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useMemo } from 'react';

export const useDynamicRoute = (): {
  params: ReturnType<typeof useParams>;
  navigate: ReturnType<typeof useNavigate>;
  location: ReturnType<typeof useLocation>;
  goToCaseDetail: (caseId: number) => Promise<void>;
  goToAlertDetail: (alertId: number) => Promise<void>;
  goToReport: (reportType: string) => Promise<void>;
  goBack: () => Promise<void>;
  getCurrentRoute: () => {
    pathname: string;
    search: string;
    hash: string;
    state: unknown;
  };
} => {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();

  return {
    params,
    navigate,
    location,

    goToCaseDetail: async (caseId: number) => {
      await navigate(`/cases/${caseId}`);
    },
    goToAlertDetail: async (alertId: number) => {
      await navigate(`/alerts/${alertId}`);
    },
    goToReport: async (reportType: string) => {
      await navigate(`/reports/${reportType}`);
    },
    goBack: async () => {
      await navigate(-1);
    },

    getCurrentRoute: () => ({
      pathname: location.pathname,
      search: location.search,
      hash: location.hash,
      state: location.state,
    }),
  };
};

export const useUrlParams = (): {
  searchParams: URLSearchParams;
  getParam: (key: string) => string | null;
  setParam: (key: string, value: string | null) => void;
  removeParam: (key: string) => void;
  updateParams: (newParams: Record<string, string | null>) => void;
  getAllParams: () => Record<string, string>;
} => {
  const location = useLocation();
  const navigate = useNavigate();

  const searchParams = useMemo(
    () => new URLSearchParams(location.search),
    [location.search],
  );

  const updateParams = (newParams: Record<string, string | null>): void => {
    const updatedParams = new URLSearchParams(searchParams);

    Object.entries(newParams).forEach(([key, value]) => {
      if (value === null) {
        updatedParams.delete(key);
      } else {
        updatedParams.set(key, value);
      }
    });

    navigate(
      {
        pathname: location.pathname,
        search: updatedParams.toString(),
      },
      { replace: true },
    );
  };

  const getParam = (key: string): string | null => searchParams.get(key);

  const setParam = (key: string, value: string | null): void => {
    updateParams({ [key]: value });
  };

  const removeParam = (key: string): void => {
    updateParams({ [key]: null });
  };

  return {
    searchParams,
    getParam,
    setParam,
    removeParam,
    updateParams,

    getAllParams: () => Object.fromEntries(searchParams.entries()),
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
  REFERENCE_ID: '/reference_id',
} as const;

/**
 * Helper function to build dynamic routes with parameters
 */
export const buildRoute = (
  route: string,
  params: Record<string, string>,
): string => {
  let builtRoute = route;
  Object.entries(params).forEach(([key, value]) => {
    builtRoute = builtRoute.replace(`:${key}`, value);
  });
  return builtRoute;
};

export const matchesRoute = (pathname: string, route: string): boolean => {
  const routePattern = route.replace(/:[^/]+/gu, '[^/]+');
  const regex = new RegExp(`^${routePattern}$`, 'u');
  return regex.test(pathname);
};

export default {
  useDynamicRoute,
  useUrlParams,
  ROUTES,
  buildRoute,
  matchesRoute,
};
