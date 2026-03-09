import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Sidebar from '../Sidebar';

const mockNavigation = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: () => <span>Icon</span>,
  },
  {
    name: 'Cases',
    href: '/cases',
    icon: () => <span>Icon</span>,
    roles: ['CMS_ADMIN'],
  },
];

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: () => ({
      pathname: '/dashboard',
    }),
  };
});

vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    hasAdminRole: () => true,
    hasInvestigatorRole: () => false,
    hasSupervisorRole: () => false,
    hasComplianceOfficerRole: () => false,
    hasBackendClaim: () => false,
  })),
}));

describe('Sidebar', () => {
  it('renders sidebar with navigation items', () => {
    render(
      <MemoryRouter>
        <Sidebar navigation={mockNavigation} />
      </MemoryRouter>,
    );

    expect(screen.getByText('Investigation Platform')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('filters navigation items based on user roles', () => {
    render(
      <MemoryRouter>
        <Sidebar navigation={mockNavigation} />
      </MemoryRouter>,
    );

    // Admin should see Cases
    expect(screen.getByText('Cases')).toBeInTheDocument();
  });

  it('highlights active navigation item', () => {
    render(
      <MemoryRouter>
        <Sidebar navigation={mockNavigation} />
      </MemoryRouter>,
    );

    const dashboardLink = screen.getByText('Dashboard').closest('a');
    expect(dashboardLink).toHaveClass('bg-blue-50');
  });

  it('toggles expanded state for items with children', () => {
    const navigationWithChildren = [
      {
        name: 'Parent',
        href: '/parent',
        icon: () => <span>Icon</span>,
        children: [
          {
            name: 'Child',
            href: '/parent/child',
            icon: () => <span>Icon</span>,
          },
        ],
      },
    ];

    render(
      <MemoryRouter>
        <Sidebar navigation={navigationWithChildren} />
      </MemoryRouter>,
    );

    const parentButton = screen.getByText('Parent').closest('button');
    if (parentButton) {
      fireEvent.click(parentButton);
      expect(screen.getByText('Child')).toBeInTheDocument();
    }
  });

  it('calls onLogout when logout button is clicked', () => {
    const onLogout = vi.fn();
    render(
      <MemoryRouter>
        <Sidebar navigation={mockNavigation} onLogout={onLogout} />
      </MemoryRouter>,
    );

    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);

    expect(onLogout).toHaveBeenCalled();
  });

  it('does not render logout button when onLogout is not provided', () => {
    render(
      <MemoryRouter>
        <Sidebar navigation={mockNavigation} />
      </MemoryRouter>,
    );

    expect(screen.queryByText('Logout')).not.toBeInTheDocument();
  });

  it('renders badge when item has badge', () => {
    const navigationWithBadge = [
      {
        name: 'Alerts',
        href: '/alerts',
        icon: () => <span>Icon</span>,
        badge: '5',
      },
    ];

    render(
      <MemoryRouter>
        <Sidebar navigation={navigationWithBadge} />
      </MemoryRouter>,
    );

    expect(screen.getByText('5')).toBeInTheDocument();
  });
});
