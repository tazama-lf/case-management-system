import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/components/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';

/**
 * Redirects authenticated users to their default landing page.
 * All users now route to /dashboard on initial login.
 */
const RoleBasedRedirect: React.FC = () => {
  const { loading, user } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  // All authenticated users route to dashboard
  if (user) {
    return <Navigate to="/dashboard" replace />;
  } else {
    return <Navigate to="/login" replace />;
  }
};

export default RoleBasedRedirect;