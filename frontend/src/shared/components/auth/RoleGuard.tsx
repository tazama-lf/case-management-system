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

  // Check all access requirements in a single condition
  const hasAccess = (() => {
    // Check specific role requirements
    if (requireSupervisor && !hasSupervisorRole() && !hasAdminRole()) {
      return false;
    }

    if (requireInvestigator && !hasInvestigatorRole() && !hasAdminRole()) {
      return false;
    }

    if (requireAdmin && !hasAdminRole()) {
      return false;
    }

    // Check backend claim requirement
    if (requireBackendClaim && !hasBackendClaim(requireBackendClaim)) {
      return false;
    }

    // Check general role requirements
    if (requiredRoles.length > 0) {
      const hasPermission = requireAll
        ? hasAllRoles(requiredRoles)
        : hasAnyRole(requiredRoles);

      if (!hasPermission) {
        return false;
      }
    }

    return true;
  })();

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

export default RoleGuard;