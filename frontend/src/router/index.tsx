import { createBrowserRouter, Navigate } from 'react-router-dom';
import LayoutWithProvider from '../shared/components/layout/LayoutWithProvider';
import ProtectedRoute from '../features/auth/components/ProtectedRoute';
import Login from '../features/auth/pages/Login';
import AlertsDashboard from '../features/alerts/pages/AlertsDashboard';
import CasesDashboard from '../features/cases/pages/CasesDashboard';
import SupervisorDashboard from '../features/supervisor/pages/SupervisorDashboard';
import AdminDashboard from '../features/admin/pages/AdminDashboard';

export const router = createBrowserRouter([
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/',
    element: <Navigate to="/alerts" replace />,
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
        path: 'alerts',
        element: <AlertsDashboard />,
      },
      {
        path: 'cases',
        element: <CasesDashboard />,
      },
      {
        path: 'supervisor',
        element: <SupervisorDashboard />,
      },
      {
        path: 'admin',
        element: <AdminDashboard />,
      },
    ],
  },
  {
    path: '*',
    element: <Navigate to="/alerts" replace />,
  },
]);
