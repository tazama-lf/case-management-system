import { createBrowserRouter, Navigate } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import LayoutWithProvider from '@/shared/components/layout/LayoutWithProvider';
import ProtectedRoute from '@/features/auth/components/ProtectedRoute';
import RoleBasedRedirect from '@/shared/components/navigation/RoleBasedRedirect';

// Dynamic imports for route-level code splitting
const Login = lazy(() => import('@/features/auth/pages/Login'));
const Dashboard = lazy(() => import('@/features/dashboard/pages/Dashboard'));
const Reports = lazy(() => import('@/features/reports/pages/CaseStatusReport'));
const AlertsDashboard = lazy(
  () => import('@/features/alerts/pages/AlertsDashboard'),
);
const CasesDashboard = lazy(
  () => import('@/features/cases/pages/CasesDashboard'),
);
const AdminDashboard = lazy(
  () => import('@/features/admin/pages/AdminDashboard'),
);
const ReferenceIdDashboard = lazy(
  () => import('@/features/admin/pages/ReferenceIdDashboard'),
);
const WorkQueueDashboard = lazy(
  () => import('@/features/workqueue/pages/WorkQueueDashboard'),
);

// Loading fallback component
const PageLoadingFallback = () => (
  <div className="flex items-center justify-center min-h-screen">
    <div className="text-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
      <p className="text-gray-600">Loading page...</p>
    </div>
  </div>
);

export const router = createBrowserRouter([
  {
    path: '/login',
    element: (
      <Suspense fallback={<PageLoadingFallback />}>
        <Login />
      </Suspense>
    ),
  },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <LayoutWithProvider />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <RoleBasedRedirect />,
      },
      {
        path: 'dashboard',
        element: (
          <ProtectedRoute>
            <Suspense fallback={<PageLoadingFallback />}>
              <Dashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports',
        element: (
          <ProtectedRoute
            requireBackendAccess
            requiredRoles={['CMS_SUPERVISOR', 'CMS_INVESTIGATOR']}
          >
            <Suspense fallback={<PageLoadingFallback />}>
              <Reports />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'alerts',
        element: (
          <ProtectedRoute
            requireBackendAccess
            requiredRoles={['CMS_SUPERVISOR', 'CMS_INVESTIGATOR']}
          >
            <Suspense fallback={<PageLoadingFallback />}>
              <AlertsDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'cases',
        element: (
          <ProtectedRoute
            requireBackendAccess
            requiredRoles={['CMS_SUPERVISOR', 'CMS_INVESTIGATOR', 'CMS_COMPLIANCE_OFFICER']}
          >
            <Suspense fallback={<PageLoadingFallback />}>
              <CasesDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'cases/:caseId',
        element: (
          <ProtectedRoute
            requireBackendAccess
            requiredRoles={['CMS_SUPERVISOR', 'CMS_INVESTIGATOR', 'CMS_COMPLIANCE_OFFICER']}
          >
            <Suspense fallback={<PageLoadingFallback />}>
              <CasesDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'alerts/:alertId',
        element: (
          <ProtectedRoute
            requireBackendAccess
            requiredRoles={['CMS_SUPERVISOR', 'CMS_INVESTIGATOR']}
          >
            <Suspense fallback={<PageLoadingFallback />}>
              <AlertsDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'work-queue/:taskId?',
        element: (
          <ProtectedRoute
            requireBackendAccess
            requiredRoles={['CMS_SUPERVISOR', 'CMS_INVESTIGATOR', 'CMS_COMPLIANCE_OFFICER']}
          >
            <Suspense fallback={<PageLoadingFallback />}>
              <WorkQueueDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'reports/:reportType?',
        element: (
          <ProtectedRoute
            requireBackendAccess
            requiredRoles={['CMS_SUPERVISOR', 'CMS_INVESTIGATOR']}
          >
            <Suspense fallback={<PageLoadingFallback />}>
              <Reports />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'work-queue',
        element: (
          <ProtectedRoute
            requireBackendAccess
            requiredRoles={['CMS_SUPERVISOR', 'CMS_INVESTIGATOR', 'CMS_COMPLIANCE_OFFICER']}
          >
            <Suspense fallback={<PageLoadingFallback />}>
              <WorkQueueDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute requireBackendAccess
            requiredRoles={['CMS_ADMIN']}>
            <Suspense fallback={<PageLoadingFallback />}>
              <AdminDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
      {
        path: 'reference_id',
        element: (
          <ProtectedRoute requireBackendAccess
            requiredRoles={['CMS_ADMIN']}>
            <Suspense fallback={<PageLoadingFallback />}>
              <ReferenceIdDashboard />
            </Suspense>
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
