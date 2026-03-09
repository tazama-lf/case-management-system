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
    hasAdminRole,
  } = useAuth();

  const hasAccess =
    // Supervisor check
    (!requireSupervisor || hasSupervisorRole() || hasAdminRole()) &&
    // Investigator check
    (!requireInvestigator || hasInvestigatorRole() || hasAdminRole()) &&
    // Admin check - use legacy hasAdminRole for general admin access (includes alert-triage)
    (!requireAdmin || hasAdminRole()) &&
    // Backend claim check
    (!requireBackendClaim || hasBackendClaim(requireBackendClaim)) &&
    // Required roles check
    (!requiredRoles.length ||
      (requireAll ? hasAllRoles(requiredRoles) : hasAnyRole(requiredRoles)));

  return hasAccess ? <>{children}</> : <>{fallback}</>;
};

export default RoleGuard;
