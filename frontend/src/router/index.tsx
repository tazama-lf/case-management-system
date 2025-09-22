import { createBrowserRouter, Navigate } from 'react-router-dom';
import LayoutWithProvider from '../shared/components/layout/LayoutWithProvider';
import ProtectedRoute from '../features/auth/components/ProtectedRoute';
import RoleBasedRedirect from '../shared/components/navigation/RoleBasedRedirect';
import Login from '../features/auth/pages/Login';
import AlertsDashboard from '../features/alerts/pages/AlertsDashboard';
import CasesDashboard from '../features/cases/pages/CasesDashboard';
import SupervisorDashboard from '../features/supervisor/pages/SupervisorDashboard';
import AdminDashboard from '../features/admin/pages/AdminDashboard';
import WorkQueueDashboard from '../features/workqueue/pages/WorkQueueDashboard';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
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
        path: 'alerts',
        element: (
          <ProtectedRoute requireAdmin>
            <AlertsDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'cases',
        element: (
          <ProtectedRoute requireInvestigator>
            <CasesDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'supervisor',
        element: (
          <ProtectedRoute requireSupervisor>
            <SupervisorDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'work-queue',
        element: (
          <ProtectedRoute requireSupervisor>
            <WorkQueueDashboard />
          </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
          <ProtectedRoute requireAdmin>
            <AdminDashboard />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/alerts" replace />,
  },
]);
