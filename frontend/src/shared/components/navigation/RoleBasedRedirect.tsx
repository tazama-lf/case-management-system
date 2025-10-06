import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/components/AuthContext';

const RoleBasedRedirect: React.FC = () => {
  const { hasAdminRole, hasInvestigatorRole, hasSupervisorRole, loading, user } = useAuth();

  const adminRole = hasAdminRole();
  const investigatorRole = hasInvestigatorRole();
  const supervisorRole = hasSupervisorRole();

  console.log('RoleBasedRedirect Debug:', {
    loading,
    user: user ? {
      username: user.username,
      backendClaims: user.backendClaims,
      roles: user.roles
    } : null,
    roleChecks: {
      hasAdminRole: adminRole,
      hasInvestigatorRole: investigatorRole,
      hasSupervisorRole: supervisorRole
    },
    redirectDecision: supervisorRole ? 'supervisor' : investigatorRole ? 'cases' : adminRole ? 'alerts' : user ? 'dashboard' : 'login'
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (supervisorRole) {
    console.log('Redirecting to /supervisor (supervisor role)');
    return <Navigate to="/supervisor" replace />;
  } else if (investigatorRole) {
    console.log('Redirecting to /cases (investigator role)');
    return <Navigate to="/cases" replace />;
  } else if (adminRole) {
    console.log('Redirecting to /alerts (admin role)');
    return <Navigate to="/alerts" replace />;
  } else if (user) {
    console.log('Redirecting to /dashboard (authenticated user)');
    return <Navigate to="/dashboard" replace />;
  } else {
    console.log('No authenticated user, redirecting to /login');
    return <Navigate to="/login" replace />;
  }
};

export default RoleBasedRedirect;