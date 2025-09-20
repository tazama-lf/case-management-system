import React from 'react';
import { useAuth } from '../../../features/auth/components/AuthContext';

interface RoleGuardProps {
  children: React.ReactNode;
  requiredRoles?: string[];
  requireAll?: boolean; // If true, user must have ALL roles; if false, user needs ANY role
  fallback?: React.ReactNode;
  requireBackendClaim?: string;
  requireSupervisor?: boolean;
  requireInvestigator?: boolean;
  requireAdmin?: boolean;
}

/**
 * RoleGuard component for conditional rendering based on user roles and permissions
 * 
 * @param children - Content to render if user has required permissions
 * @param requiredRoles - Array of roles required to view content
 * @param requireAll - Whether user needs ALL roles (true) or ANY role (false)
 * @param fallback - Content to render if user doesn't have permissions
 * @param requireBackendClaim - Specific backend claim required
 * @param requireSupervisor - Shortcut to require supervisor role
 * @param requireInvestigator - Shortcut to require investigator role
 * @param requireAdmin - Shortcut to require admin role
 */
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

  // Check specific role shortcuts
  // Note: Admin users (alert-triage, CMS-TEST-ROLE) have access to all areas
  if (requireSupervisor && !hasSupervisorRole() && !hasAdminRole()) {
    return <>{fallback}</>;
  }

  if (requireInvestigator && !hasInvestigatorRole() && !hasAdminRole()) {
    return <>{fallback}</>;
  }

  if (requireAdmin && !hasAdminRole()) {
    return <>{fallback}</>;
  }

  // Check specific backend claim
  if (requireBackendClaim && !hasBackendClaim(requireBackendClaim)) {
    return <>{fallback}</>;
  }

  // Check role array requirements
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