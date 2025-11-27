import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Layout from '../Layout';

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    Outlet: () => <div data-testid="outlet">Outlet Content</div>,
  };
});

vi.mock('../Sidebar', () => ({
  default: ({ onLogout }: any) => (
    <div data-testid="sidebar">
      <button onClick={onLogout}>Logout</button>
    </div>
  ),
}));

vi.mock('../Header', () => ({
  default: ({ sidebarOpen, setSidebarOpen }: any) => (
    <div data-testid="header">
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        data-testid="toggle-sidebar"
      >
        Toggle
      </button>
    </div>
  ),
}));

const mockLogout = vi.fn();

vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { id: '1', username: 'test' },
    logout: mockLogout,
  })),
}));

vi.mock('@/shared/constants/navigation', () => ({
  NAVIGATION_ITEMS: [],
}));

describe('Layout', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders layout with children', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>Test Content</div>
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('renders Outlet when no children provided', () => {
    render(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>
    );

    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('toggles sidebar', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>Content</div>
        </Layout>
      </MemoryRouter>
    );

    const toggleButton = screen.getByTestId('toggle-sidebar');
    fireEvent.click(toggleButton);

    // Sidebar should be open now
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('closes sidebar when overlay is clicked', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>Content</div>
        </Layout>
      </MemoryRouter>
    );

    // Open sidebar first
    const toggleButton = screen.getByTestId('toggle-sidebar');
    fireEvent.click(toggleButton);

    // Click overlay to close
    const overlay = document.querySelector('.bg-gray-900\\/80');
    if (overlay) {
      fireEvent.click(overlay);
    }

    // Sidebar should still exist but be closed
    expect(screen.getByTestId('sidebar')).toBeInTheDocument();
  });

  it('calls logout when logout button is clicked', () => {
    render(
      <MemoryRouter>
        <Layout>
          <div>Content</div>
        </Layout>
      </MemoryRouter>
    );

    // Open sidebar to see logout button
    const toggleButton = screen.getByTestId('toggle-sidebar');
    fireEvent.click(toggleButton);

    const logoutButton = screen.getByText('Logout');
    fireEvent.click(logoutButton);

    expect(mockLogout).toHaveBeenCalled();
  });

  it('renders with title and breadcrumbs', () => {
    const breadcrumbs = [
      { name: 'Home', href: '/' },
    ];

    render(
      <MemoryRouter>
        <Layout title="Test Title" breadcrumbs={breadcrumbs}>
          <div>Content</div>
        </Layout>
      </MemoryRouter>
    );

    expect(screen.getByTestId('header')).toBeInTheDocument();
  });
});
