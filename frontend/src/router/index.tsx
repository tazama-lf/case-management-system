import { createBrowserRouter, Navigate } from 'react-router-dom';
import LayoutWithProvider from '../components/layout/LayoutWithProvider';
import ProtectedRoute from '../components/auth/ProtectedRoute';
import Login from '../pages/Login';
import AlertsDashboard from '../pages/AlertsDashboard';
import CasesDashboard from '../pages/CasesDashboard';
import SupervisorDashboard from '../pages/SupervisorDashboard';
import AdminDashboard from '../pages/AdminDashboard';

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
        element: (
            <ProtectedRoute requiredRoles={['supervisor', 'admin']}>
              <SupervisorDashboard />
            </ProtectedRoute>
        ),
      },
      {
        path: 'admin',
        element: (
            <ProtectedRoute requiredRoles={['admin']}>
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