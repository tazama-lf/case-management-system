import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/components/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';

/**
 * Redirects authenticated users to their default landing page based on their role.
 * CMS_ADMIN users go to admin dashboard, others go to main dashboard.
 */
const RoleBasedRedirect: React.FC = () => {
  const { loading, user, hasCMSAdminRole } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (user) {
    // CMS_ADMIN users should only see admin dashboard
    if (hasCMSAdminRole()) {
      return <Navigate to="/admin" replace />;
    }
    // All other authenticated users route to dashboard
    return <Navigate to="/dashboard" replace />;
  } else {
    return <Navigate to="/login" replace />;
  }
};

export default RoleBasedRedirect;
