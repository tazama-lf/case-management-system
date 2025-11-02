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

  const hasAccess = (
    (!requireAdmin || hasAdminRole()) &&
    (!requireSupervisor || hasSupervisorRole() || hasAdminRole()) &&
    (!requireInvestigator || hasInvestigatorRole() || hasAdminRole()) &&
    (!requireBackendClaim || hasBackendClaim(requireBackendClaim)) &&
    (requiredRoles.length === 0 || (requireAll ? hasAllRoles(requiredRoles) : hasAnyRole(requiredRoles)))
  );

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

export default RoleGuard;