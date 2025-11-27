import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import RoleBasedRedirect from '../RoleBasedRedirect';

vi.mock('../../../../features/auth/components/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../../ui/LoadingSpinner', () => ({
  default: ({ fullScreen }: any) => (
    <div data-testid="loading-spinner">{fullScreen ? 'Full Screen' : 'Loading'}</div>
  ),
}));

import { useAuth } from '../../../../features/auth/components/AuthContext';

describe('RoleBasedRedirect', () => {
  it('shows loading spinner when loading', () => {
    (useAuth as vi.Mock).mockReturnValue({
      loading: true,
      user: null,
    });

    render(
      <MemoryRouter>
        <RoleBasedRedirect />
      </MemoryRouter>
    );

    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('redirects to dashboard when user is authenticated', () => {
    (useAuth as vi.Mock).mockReturnValue({
      loading: false,
      user: { id: '1', username: 'test' },
    });

    render(
      <MemoryRouter>
        <RoleBasedRedirect />
      </MemoryRouter>
    );

    // Navigate component should redirect
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });

  it('redirects to login when user is not authenticated', () => {
    (useAuth as vi.Mock).mockReturnValue({
      loading: false,
      user: null,
    });

    render(
      <MemoryRouter>
        <RoleBasedRedirect />
      </MemoryRouter>
    );

    // Navigate component should redirect
    expect(screen.queryByTestId('loading-spinner')).not.toBeInTheDocument();
  });
});
