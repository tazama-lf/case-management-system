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