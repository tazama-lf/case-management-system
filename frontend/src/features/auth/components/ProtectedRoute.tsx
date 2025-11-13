import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../components/AuthContext';
import authService from '../services/authService';
import LoadingSpinner from '../../../shared/components/ui/LoadingSpinner';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requireBackendAccess?: boolean;
  requireInvestigator?: boolean;
  requireSupervisor?: boolean;
  requireAdmin?: boolean;
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
  requireBackendAccess = true,
  requireInvestigator = false,
  requireSupervisor = false,
  requireAdmin = false,
}) => {
  const {
    isAuthenticated,
    user,
    loading,
    hasInvestigatorRole,
    hasSupervisorRole,
    hasAdminRole,
  } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (requireBackendAccess && !authService.validateBackendAccess()) {
    const hasAlertTriage = authService.hasAlertTriageRole();
    const hasCMSTestRole = authService.hasCMSTestRole();
    const hasInvestigator = authService.hasInvestigatorRole();
    const hasSupervisor = authService.hasSupervisorRole();

    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center max-w-md">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Backend Access Required
          </h2>
          <p className="text-gray-600 mb-4">
            Your account doesn't have the required claims to access the backend
            services.
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4">
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-2">Required Claims Status:</p>
              <ul className="list-disc list-inside space-y-1">
                <li
                  className={hasAlertTriage ? 'text-green-600' : 'text-red-600'}
                >
                  alert-triage (Admin):{' '}
                  {hasAlertTriage ? '✓ Available' : '✗ Missing'}
                </li>
                <li
                  className={hasCMSTestRole ? 'text-green-600' : 'text-red-600'}
                >
                  CMS-TEST-ROLE (Legacy):{' '}
                  {hasCMSTestRole ? '✓ Available' : '✗ Missing'}
                </li>
                <li
                  className={
                    hasInvestigator ? 'text-green-600' : 'text-red-600'
                  }
                >
                  CMS_INVESTIGATOR:{' '}
                  {hasInvestigator ? '✓ Available' : '✗ Missing'}
                </li>
                <li
                  className={hasSupervisor ? 'text-green-600' : 'text-red-600'}
                >
                  CMS_SUPERVISOR: {hasSupervisor ? '✓ Available' : '✗ Missing'}
                </li>
              </ul>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-4">
            Please contact your administrator to get the required claims added
            to your account.
          </p>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (requireInvestigator && !hasInvestigatorRole()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Investigator Access Required
          </h2>
          <p className="text-gray-600 mb-4">
            You need CMS_INVESTIGATOR role to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (requireSupervisor && !hasSupervisorRole()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Supervisor Access Required
          </h2>
          <p className="text-gray-600 mb-4">
            You need CMS_SUPERVISOR role to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (requireAdmin && !hasAdminRole()) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Admin Access Required
          </h2>
          <p className="text-gray-600 mb-4">
            You need alert-triage or admin role to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (requiredRoles.length > 0 && user) {
    // Check if user has any of the required roles using backend claims
    const hasRequiredRole = requiredRoles.some((role) =>
      authService.hasBackendClaim(role),
    );

    if (!hasRequiredRole) {
      return (
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center max-w-md">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Access Denied
            </h2>
            <p className="text-gray-600 mb-4">
              You don't have the required role to access this page.
            </p>
            <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
              <div className="text-sm text-red-800">
                <p className="font-medium mb-2">Required Roles:</p>
                <ul className="list-disc list-inside space-y-1">
                  {requiredRoles.map((role) => (
                    <li key={role}>
                      {role}:{' '}
                      {authService.hasBackendClaim(role)
                        ? '✓ Available'
                        : '✗ Missing'}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-4">
              Please contact your administrator to get the required roles added
              to your account.
            </p>
            <button
              onClick={() => window.history.back()}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
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
