import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/components/AuthContext';

const RoleBasedRedirect: React.FC = () => {
  const { hasAdminRole, hasInvestigatorRole, hasSupervisorRole, loading } = useAuth();

  // Show loading while auth state is being determined
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Redirect users to their appropriate dashboard based on their role
  // Priority: Admin > Supervisor > Investigator
  if (hasAdminRole()) {
    return <Navigate to="/alerts" replace />;
  } else if (hasSupervisorRole()) {
    return <Navigate to="/supervisor" replace />;
  } else if (hasInvestigatorRole()) {
    return <Navigate to="/cases" replace />;
  } else {
    // If user has no recognized role, redirect to login
    return <Navigate to="/login" replace />;
  }
};

export default RoleBasedRedirect;