import React from 'react';
import { useAuth } from '../../../features/auth/components/AuthContext';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requireAll?: boolean;
  fallback?: React.ReactNode;
  requireBackendClaim?: string;
  requireSupervisor?: boolean;
  requireInvestigator?: boolean;
  requireAdmin?: boolean;
}


const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  requiredRoles = [],
  requireAll = false,
  fallback = null,
  requireBackendClaim,
  requireSupervisor = false,
  requireInvestigator = false,
  requireAdmin = false,
}) => {
  const {
    hasAnyRole,
    hasAllRoles,
    hasBackendClaim,
    hasSupervisorRole,
    hasInvestigatorRole,
    hasAdminRole
  } = useAuth();

  if (requireSupervisor && !hasSupervisorRole() && !hasAdminRole()) {
    return <>{fallback}</>;
  }

  if (requireInvestigator && !hasInvestigatorRole() && !hasAdminRole()) {
    return <>{fallback}</>;
  }

  if (requireAdmin && !hasAdminRole()) {
    return <>{fallback}</>;
  }

  if (requireBackendClaim && !hasBackendClaim(requireBackendClaim)) {
    return <>{fallback}</>;
  }

  if (requiredRoles.length > 0) {
    const hasPermission = requireAll
      ? hasAllRoles(requiredRoles)
      : hasAnyRole(requiredRoles);

    if (!hasPermission) {
      return <>{fallback}</>;
    }
  }

  return <>{children}</>;
};

export default RoleGuard;