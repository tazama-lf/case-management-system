import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  SupervisorOnly,
  InvestigatorOnly,
  AdminOnly,
  SupervisorOrAdmin,
  AuthenticatedOnly,
} from '../RoleComponents';
import RoleGuard from '../RoleGuard';

vi.mock('../RoleGuard', () => ({
  default: ({
    children,
    requireSupervisor,
    requireInvestigator,
    requireAdmin,
    requireBackendClaim,
    fallback,
  }: any) => (
    <div data-testid="role-guard">
      {requireSupervisor && (
        <span data-testid="require-supervisor">supervisor</span>
      )}
      {requireInvestigator && (
        <span data-testid="require-investigator">investigator</span>
      )}
      {requireAdmin && <span data-testid="require-admin">admin</span>}
      {requireBackendClaim && (
        <span data-testid="require-backend-claim">{requireBackendClaim}</span>
      )}
      {fallback && <span data-testid="fallback">fallback</span>}
      {children}
    </div>
  ),
}));

describe('RoleComponents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('SupervisorOnly renders RoleGuard with requireSupervisor', () => {
    render(
      <SupervisorOnly>
        <div>Content</div>
      </SupervisorOnly>,
    );

    expect(screen.getByTestId('role-guard')).toBeInTheDocument();
    expect(screen.getByTestId('require-supervisor')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('SupervisorOnly renders fallback when provided', () => {
    render(
      <SupervisorOnly fallback={<div>No Access</div>}>
        <div>Content</div>
      </SupervisorOnly>,
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });

  it('InvestigatorOnly renders RoleGuard with requireInvestigator', () => {
    render(
      <InvestigatorOnly>
        <div>Content</div>
      </InvestigatorOnly>,
    );

    expect(screen.getByTestId('role-guard')).toBeInTheDocument();
    expect(screen.getByTestId('require-investigator')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('InvestigatorOnly renders fallback when provided', () => {
    render(
      <InvestigatorOnly fallback={<div>No Access</div>}>
        <div>Content</div>
      </InvestigatorOnly>,
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });

  it('AdminOnly renders RoleGuard with requireAdmin', () => {
    render(
      <AdminOnly>
        <div>Content</div>
      </AdminOnly>,
    );

    expect(screen.getByTestId('role-guard')).toBeInTheDocument();
    expect(screen.getByTestId('require-admin')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('AdminOnly renders fallback when provided', () => {
    render(
      <AdminOnly fallback={<div>No Access</div>}>
        <div>Content</div>
      </AdminOnly>,
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });

  it('SupervisorOrAdmin renders RoleGuard with requireSupervisor', () => {
    render(
      <SupervisorOrAdmin>
        <div>Content</div>
      </SupervisorOrAdmin>,
    );

    expect(screen.getByTestId('role-guard')).toBeInTheDocument();
    expect(screen.getByTestId('require-supervisor')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('SupervisorOrAdmin renders fallback when provided', () => {
    render(
      <SupervisorOrAdmin fallback={<div>No Access</div>}>
        <div>Content</div>
      </SupervisorOrAdmin>,
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });

  it('AuthenticatedOnly renders RoleGuard with requireBackendClaim', () => {
    render(
      <AuthenticatedOnly>
        <div>Content</div>
      </AuthenticatedOnly>,
    );

    expect(screen.getByTestId('role-guard')).toBeInTheDocument();
    expect(screen.getByTestId('require-backend-claim')).toBeInTheDocument();
    expect(screen.getByText('alert-triage')).toBeInTheDocument();
    expect(screen.getByText('Content')).toBeInTheDocument();
  });

  it('AuthenticatedOnly renders fallback when provided', () => {
    render(
      <AuthenticatedOnly fallback={<div>No Access</div>}>
        <div>Content</div>
      </AuthenticatedOnly>,
    );

    expect(screen.getByTestId('fallback')).toBeInTheDocument();
  });
});
