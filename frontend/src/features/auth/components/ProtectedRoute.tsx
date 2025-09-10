import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import authService from '../services/authService';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requireBackendAccess?: boolean; // New prop to validate backend claims
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
  requireBackendAccess = true, // Default to true since most routes need backend access
}) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  console.log('🛡️ ProtectedRoute Debug:', {
    isAuthenticated,
    loading,
    requireBackendAccess,
    requiredRoles,
    userExists: !!user,
    path: location.pathname
  });

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    console.log('🚫 ProtectedRoute: User not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Check backend access if required
  if (requireBackendAccess && !authService.validateBackendAccess()) {
    console.log('🚫 ProtectedRoute: Backend access validation failed');
    const hasAlertTriage = authService.hasAlertTriageRole();
    const hasCMSTestRole = authService.hasCMSTestRole();
    
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Backend Access Required
          </h2>
          <p className="text-gray-600 mb-4">
            Your account doesn't have the required claims to access the backend services.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-2">Required Claims Status:</p>
              <ul className="list-disc list-inside space-y-1">
                <li className={hasAlertTriage ? 'text-green-600' : 'text-red-600'}>
                  alert-triage: {hasAlertTriage ? '✓ Available' : '✗ Missing'}
                </li>
                <li className={hasCMSTestRole ? 'text-green-600' : 'text-red-600'}>
                  CMS-TEST-ROLE: {hasCMSTestRole ? '✓ Available' : '✗ Missing'}
                </li>
              </ul>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Please contact your administrator to get the required claims added to your account.
          </p>
          <button
            onClick={() => window.history.back()}
            className="btn btn-primary"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check role permissions if required roles are specified
  if (requiredRoles.length > 0 && user) {
    const hasRequiredRole = requiredRoles.some(
      (role) => user.roles.includes(role) || user.roles.includes('admin'), // Admin has access to everything
    );

    if (!hasRequiredRole) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 mb-4">
              You don't have permission to access this page.
            </p>
            <button
              onClick={() => window.history.back()}
              className="btn btn-primary"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;
