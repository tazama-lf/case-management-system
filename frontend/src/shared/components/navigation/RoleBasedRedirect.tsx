import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/components/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';

const RoleBasedRedirect: React.FC = () => {
  const { hasAdminRole, hasInvestigatorRole, hasSupervisorRole, loading, user } = useAuth();

  const adminRole = hasAdminRole();
  const investigatorRole = hasInvestigatorRole();
  const supervisorRole = hasSupervisorRole();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  // Priority-based redirecting:
  // 1. Triage (admin role) - can access everything, redirect to alerts
  // 2. Supervisor - can access all except admin, redirect to cases
  // 3. Investigator - can access all except admin, redirect to cases
  // 4. Regular authenticated user - redirect to dashboard
  // 5. Unauthenticated - redirect to login

  if (adminRole) {
    return <Navigate to="/alerts" replace />;
  } else if (supervisorRole) {
    return <Navigate to="/cases" replace />;
  } else if (investigatorRole) {
    return <Navigate to="/cases" replace />;
  } else if (user) {
    return <Navigate to="/dashboard" replace />;
  } else {
    return <Navigate to="/login" replace />;
  }
};

export default RoleBasedRedirect;