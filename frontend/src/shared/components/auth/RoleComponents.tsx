import React from 'react';
import RoleGuard from './RoleGuard';

interface RoleSpecificProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

/**
 * SupervisorOnly - Only renders content for users with supervisor role or admin users
 * Admin users (alert-triage, CMS-TEST-ROLE) can access supervisor areas
 */
export const SupervisorOnly: React.FC<RoleSpecificProps> = ({ children, fallback }) => (
  <RoleGuard requireSupervisor fallback={fallback}>
    {children}
  </RoleGuard>
);

/**
 * InvestigatorOnly - Only renders content for users with investigator role or admin users
 * Admin users (alert-triage, CMS-TEST-ROLE) can access investigator areas
 */
export const InvestigatorOnly: React.FC<RoleSpecificProps> = ({ children, fallback }) => (
  <RoleGuard requireInvestigator fallback={fallback}>
    {children}
  </RoleGuard>
);

/**
 * AdminOnly - Only renders content for users with admin role (alert-triage, CMS-TEST-ROLE)
 */
export const AdminOnly: React.FC<RoleSpecificProps> = ({ children, fallback }) => (
  <RoleGuard requireAdmin fallback={fallback}>
    {children}
  </RoleGuard>
);

/**
 * SupervisorOrAdmin - Renders content for supervisors or admins
 */
export const SupervisorOrAdmin: React.FC<RoleSpecificProps> = ({ children, fallback }) => (
  <RoleGuard requireSupervisor fallback={fallback}>
    {children}
  </RoleGuard>
);

/**
 * AuthenticatedOnly - Renders content only for authenticated users (any role)
 */
export const AuthenticatedOnly: React.FC<RoleSpecificProps> = ({ children, fallback }) => (
  <RoleGuard requireBackendClaim="alert-triage" fallback={fallback}>
    {children}
  </RoleGuard>
);