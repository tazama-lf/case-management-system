import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import ProtectedRoute from '../ProtectedRoute';
import { useAuth } from '../AuthContext';
import authService from '../../services/authService';

vi.mock('../AuthContext');
vi.mock('../../services/authService');
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Navigate: ({ to }: { to: string }) => (
      <div data-testid="navigate" data-to={to}>
        Navigate to {to}
      </div>
    ),
  };
});
// Don't mock LoadingSpinner - use the actual component

const mockUseAuth = useAuth as vi.Mock;
const mockAuthService = authService as unknown as {
  validateBackendAccess: vi.Mock;
  hasAlertTriageRole: vi.Mock;
  hasCMSTestRole: vi.Mock;
  hasInvestigatorRole: vi.Mock;
  hasSupervisorRole: vi.Mock;
  hasCMSComplianceOfficerRole: vi.Mock;
  hasBackendClaim: vi.Mock;
};

const TestChild = () => <div>Protected Content</div>;

const renderWithRouter = (component: React.ReactElement) => {
  return render(<MemoryRouter>{component}</MemoryRouter>);
};

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (mockAuthService.validateBackendAccess as vi.Mock).mockReturnValue(true);
    (mockAuthService.hasAlertTriageRole as vi.Mock).mockReturnValue(false);
    (mockAuthService.hasCMSTestRole as vi.Mock).mockReturnValue(false);
    (mockAuthService.hasInvestigatorRole as vi.Mock).mockReturnValue(false);
    (mockAuthService.hasSupervisorRole as vi.Mock).mockReturnValue(false);
    (mockAuthService.hasCMSComplianceOfficerRole as vi.Mock).mockReturnValue(
      false,
    );
    (mockAuthService.hasBackendClaim as vi.Mock).mockReturnValue(false);
  });

  it('shows loading spinner when auth is loading', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: true,
      hasInvestigatorRole: () => false,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });

    renderWithRouter(
      <ProtectedRoute>
        <TestChild />
      </ProtectedRoute>,
    );

    expect(screen.getByRole('status', { name: 'Loading' })).toBeInTheDocument();
  });

  it('redirects to login when not authenticated', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: false,
      user: null,
      loading: false,
      hasInvestigatorRole: () => false,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });

    renderWithRouter(
      <ProtectedRoute>
        <TestChild />
      </ProtectedRoute>,
    );

    // Navigate component should redirect
    expect(screen.getByTestId('navigate')).toBeInTheDocument();
    expect(screen.getByTestId('navigate')).toHaveAttribute('data-to', '/login');
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders children when authenticated with no requirements', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test',
        validatedClaims: {},
      },
      loading: false,
      hasInvestigatorRole: () => false,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });

    renderWithRouter(
      <ProtectedRoute>
        <TestChild />
      </ProtectedRoute>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows backend access required message when requireBackendAccess is true and user lacks access', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test',
        validatedClaims: {},
      },
      loading: false,
      hasInvestigatorRole: () => false,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });
    (mockAuthService.validateBackendAccess as vi.Mock).mockReturnValue(false);

    renderWithRouter(
      <ProtectedRoute requireBackendAccess={true}>
        <TestChild />
      </ProtectedRoute>,
    );

    expect(screen.getByText('Backend Access Required')).toBeInTheDocument();
    expect(
      screen.getByText(
        /Your account doesn't have the required claims to access the backend services/i,
      ),
    ).toBeInTheDocument();
  });

  it('shows investigator access required message when requireInvestigator is true and user lacks role', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test',
        validatedClaims: {},
      },
      loading: false,
      hasInvestigatorRole: () => false,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });

    renderWithRouter(
      <ProtectedRoute requireInvestigator={true}>
        <TestChild />
      </ProtectedRoute>,
    );

    expect(
      screen.getByText('Investigator Access Required'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/You need CMS_INVESTIGATOR role to access this page/i),
    ).toBeInTheDocument();
  });

  it('shows supervisor access required message when requireSupervisor is true and user lacks role', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test',
        validatedClaims: {},
      },
      loading: false,
      hasInvestigatorRole: () => false,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });

    renderWithRouter(
      <ProtectedRoute requireSupervisor={true}>
        <TestChild />
      </ProtectedRoute>,
    );

    expect(screen.getByText('Supervisor Access Required')).toBeInTheDocument();
    expect(
      screen.getByText(/You need CMS_SUPERVISOR role to access this page/i),
    ).toBeInTheDocument();
  });

  it('shows admin access required message when requireAdmin is true and user lacks role', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test',
        validatedClaims: {},
      },
      loading: false,
      hasInvestigatorRole: () => false,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });

    renderWithRouter(
      <ProtectedRoute requireAdmin={true}>
        <TestChild />
      </ProtectedRoute>,
    );

    expect(screen.getByText('Admin Access Required')).toBeInTheDocument();
    expect(
      screen.getByText(
        /You need alert-triage or admin role to access this page/i,
      ),
    ).toBeInTheDocument();
  });

  it('renders children when user has required investigator role', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test',
        validatedClaims: {},
      },
      loading: false,
      hasInvestigatorRole: () => true,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });

    renderWithRouter(
      <ProtectedRoute requireInvestigator={true}>
        <TestChild />
      </ProtectedRoute>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('shows access denied when requiredRoles are specified and user lacks all roles', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test',
        validatedClaims: {},
      },
      loading: false,
      hasInvestigatorRole: () => false,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });
    (mockAuthService.hasBackendClaim as vi.Mock).mockReturnValue(false);

    renderWithRouter(
      <ProtectedRoute requiredRoles={['CMS_ADMIN', 'CMS_SUPERVISOR']}>
        <TestChild />
      </ProtectedRoute>,
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(
      screen.getByText(/You don't have the required role to access this page/i),
    ).toBeInTheDocument();
  });

  it('renders children when user has at least one required role', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test',
        validatedClaims: {},
      },
      loading: false,
      hasInvestigatorRole: () => false,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });
    (mockAuthService.hasBackendClaim as vi.Mock).mockImplementation(
      (claim) => claim === 'CMS_ADMIN',
    );

    renderWithRouter(
      <ProtectedRoute requiredRoles={['CMS_ADMIN', 'CMS_SUPERVISOR']}>
        <TestChild />
      </ProtectedRoute>,
    );

    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('displays backend access status correctly', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test',
        validatedClaims: {},
      },
      loading: false,
      hasInvestigatorRole: () => false,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });
    (mockAuthService.validateBackendAccess as vi.Mock).mockReturnValue(false);
    (mockAuthService.hasAlertTriageRole as vi.Mock).mockReturnValue(true);
    (mockAuthService.hasCMSTestRole as vi.Mock).mockReturnValue(false);
    (mockAuthService.hasInvestigatorRole as vi.Mock).mockReturnValue(true);
    (mockAuthService.hasSupervisorRole as vi.Mock).mockReturnValue(false);
    (mockAuthService.hasCMSComplianceOfficerRole as vi.Mock).mockReturnValue(
      false,
    );

    renderWithRouter(
      <ProtectedRoute requireBackendAccess={true}>
        <TestChild />
      </ProtectedRoute>,
    );

    expect(
      screen.getByText(/alert-triage \(Admin\): ✓ Available/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/CMS_INVESTIGATOR: ✓ Available/i),
    ).toBeInTheDocument();
  });

  it('displays required roles status correctly', () => {
    mockUseAuth.mockReturnValue({
      isAuthenticated: true,
      user: {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test',
        validatedClaims: {},
      },
      loading: false,
      hasInvestigatorRole: () => false,
      hasSupervisorRole: () => false,
      hasAdminRole: () => false,
    });
    (mockAuthService.hasBackendClaim as vi.Mock).mockImplementation(
      (claim) => claim === 'CMS_ADMIN',
    );

    renderWithRouter(
      <ProtectedRoute requiredRoles={['CMS_ADMIN', 'CMS_SUPERVISOR']}>
        <TestChild />
      </ProtectedRoute>,
    );

    // User has CMS_ADMIN, so should render children
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
