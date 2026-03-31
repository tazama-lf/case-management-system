import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/components/AuthContext';
import LoadingSpinner from '../ui/LoadingSpinner';

const RoleBasedRedirect: React.FC = () => {
  const { loading, user, hasCMSAdminRole, hasComplianceOfficerRole } =
    useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen />;
  }

  if (user) {
    // CMS_ADMIN users should only see admin dashboard
    if (hasCMSAdminRole()) {
      return <Navigate to="/admin" replace />;
    }
    // Compliance officers can only see cases
    if (hasComplianceOfficerRole()) {
      return <Navigate to="/cases" replace />;
    }
    // All other authenticated users route to dashboard
    return <Navigate to="/dashboard" replace />;
  } else {
    return <Navigate to="/login" replace />;
  }
};

export default RoleBasedRedirect;
