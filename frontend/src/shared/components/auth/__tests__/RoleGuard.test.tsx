import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import RoleGuard from '../RoleGuard';
import { useAuth } from '../../../../features/auth/components/AuthContext';

vi.mock('../../../../features/auth/components/AuthContext', () => ({
  useAuth: vi.fn(),
}));

describe('RoleGuard', () => {
  const mockUseAuth = vi.mocked(useAuth);

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseAuth.mockReturnValue({
      hasAnyRole: vi.fn().mockReturnValue(false),
      hasAllRoles: vi.fn().mockReturnValue(false),
      hasBackendClaim: vi.fn().mockReturnValue(false),
      hasSupervisorRole: vi.fn().mockReturnValue(false),
      hasInvestigatorRole: vi.fn().mockReturnValue(false),
      hasAdminRole: vi.fn().mockReturnValue(false),
    } as any);
  });

  it('renders children when no restrictions are set', () => {
    render(
      <RoleGuard>
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders children when user has supervisor role and requireSupervisor is true', () => {
    mockUseAuth.mockReturnValue({
      hasSupervisorRole: vi.fn().mockReturnValue(true),
      hasAdminRole: vi.fn().mockReturnValue(false),
    } as any);

    render(
      <RoleGuard requireSupervisor>
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders fallback when user does not have supervisor role', () => {
    mockUseAuth.mockReturnValue({
      hasSupervisorRole: vi.fn().mockReturnValue(false),
      hasAdminRole: vi.fn().mockReturnValue(false),
    } as any);

    render(
      <RoleGuard requireSupervisor fallback={<div>No Access</div>}>
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('No Access')).toBeInTheDocument();
    expect(screen.queryByText('Content')).not.toBeInTheDocument();
  });

  it('renders children when user has admin role and requireSupervisor is true', () => {
    mockUseAuth.mockReturnValue({
      hasSupervisorRole: vi.fn().mockReturnValue(false),
      hasAdminRole: vi.fn().mockReturnValue(true),
    } as any);

    render(
      <RoleGuard requireSupervisor>
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders children when user has investigator role and requireInvestigator is true', () => {
    mockUseAuth.mockReturnValue({
      hasInvestigatorRole: vi.fn().mockReturnValue(true),
      hasAdminRole: vi.fn().mockReturnValue(false),
    } as any);

    render(
      <RoleGuard requireInvestigator>
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders fallback when user does not have investigator role', () => {
    mockUseAuth.mockReturnValue({
      hasInvestigatorRole: vi.fn().mockReturnValue(false),
      hasAdminRole: vi.fn().mockReturnValue(false),
    } as any);

    render(
      <RoleGuard requireInvestigator fallback={<div>No Access</div>}>
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('No Access')).toBeInTheDocument();
  });

  it('renders children when user has admin role and requireAdmin is true', () => {
    mockUseAuth.mockReturnValue({
      hasAdminRole: vi.fn().mockReturnValue(true),
    } as any);

    render(
      <RoleGuard requireAdmin>
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders fallback when user does not have admin role', () => {
    mockUseAuth.mockReturnValue({
      hasAdminRole: vi.fn().mockReturnValue(false),
    } as any);

    render(
      <RoleGuard requireAdmin fallback={<div>No Access</div>}>
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('No Access')).toBeInTheDocument();
  });

  it('renders children when user has backend claim and requireBackendClaim is set', () => {
    mockUseAuth.mockReturnValue({
      hasBackendClaim: vi.fn().mockReturnValue(true),
    } as any);

    render(
      <RoleGuard requireBackendClaim="alert-triage">
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders fallback when user does not have backend claim', () => {
    mockUseAuth.mockReturnValue({
      hasBackendClaim: vi.fn().mockReturnValue(false),
    } as any);

    render(
      <RoleGuard
        requireBackendClaim="alert-triage"
        fallback={<div>No Access</div>}
      >
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('No Access')).toBeInTheDocument();
  });

  it('renders children when user has any of the required roles', () => {
    mockUseAuth.mockReturnValue({
      hasAnyRole: vi.fn().mockReturnValue(true),
    } as any);

    render(
      <RoleGuard requiredRoles={['CMS_ADMIN', 'CMS_SUPERVISOR']}>
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders fallback when user does not have any of the required roles', () => {
    mockUseAuth.mockReturnValue({
      hasAnyRole: vi.fn().mockReturnValue(false),
    } as any);

    render(
      <RoleGuard requiredRoles={['CMS_ADMIN']} fallback={<div>No Access</div>}>
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('No Access')).toBeInTheDocument();
  });

  it('renders children when user has all required roles and requireAll is true', () => {
    mockUseAuth.mockReturnValue({
      hasAllRoles: vi.fn().mockReturnValue(true),
    } as any);

    render(
      <RoleGuard requiredRoles={['CMS_ADMIN', 'CMS_SUPERVISOR']} requireAll>
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('renders fallback when user does not have all required roles and requireAll is true', () => {
    mockUseAuth.mockReturnValue({
      hasAllRoles: vi.fn().mockReturnValue(false),
    } as any);

    render(
      <RoleGuard
        requiredRoles={['CMS_ADMIN', 'CMS_SUPERVISOR']}
        requireAll
        fallback={<div>No Access</div>}
      >
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('No Access')).toBeInTheDocument();
  });

  it('renders null fallback when no fallback is provided', () => {
    mockUseAuth.mockReturnValue({
      hasAdminRole: vi.fn().mockReturnValue(false),
    } as any);

    const { container } = render(
      <RoleGuard requireAdmin>
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.queryByText('Content')).not.toBeInTheDocument();
    // When fallback is null, React renders an empty fragment, so container should be empty or have minimal content
    expect(container.textContent).toBe('');
  });

  it('handles multiple restrictions correctly', () => {
    mockUseAuth.mockReturnValue({
      hasSupervisorRole: vi.fn().mockReturnValue(true),
      hasAdminRole: vi.fn().mockReturnValue(false),
      hasBackendClaim: vi.fn().mockReturnValue(true),
    } as any);

    render(
      <RoleGuard requireSupervisor requireBackendClaim="alert-triage">
        <div>Content</div>
      </RoleGuard>,
    );

    expect(screen.getByText('Content')).toBeInTheDocument();
  });
});
