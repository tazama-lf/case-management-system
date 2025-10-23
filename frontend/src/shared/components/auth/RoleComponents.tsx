import React from 'react';
import RoleGuard from './RoleGuard';

interface RoleSpecificProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
}


export const SupervisorOnly: React.FC<RoleSpecificProps> = ({ children, fallback }) => (
  <RoleGuard requireSupervisor fallback={fallback}>
    {children}
  </RoleGuard>
);


export const InvestigatorOnly: React.FC<RoleSpecificProps> = ({ children, fallback }) => (
  <RoleGuard requireInvestigator fallback={fallback}>
    {children}
  </RoleGuard>
);


export const AdminOnly: React.FC<RoleSpecificProps> = ({ children, fallback }) => (
  <RoleGuard requireAdmin fallback={fallback}>
    {children}
  </RoleGuard>
);


export const SupervisorOrAdmin: React.FC<RoleSpecificProps> = ({ children, fallback }) => (
  <RoleGuard requireSupervisor fallback={fallback}>
    {children}
  </RoleGuard>
);


export const AuthenticatedOnly: React.FC<RoleSpecificProps> = ({ children, fallback }) => (
  <RoleGuard requireBackendClaim="alert-triage" fallback={fallback}>
    {children}
  </RoleGuard>
);