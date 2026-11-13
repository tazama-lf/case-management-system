import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import NotFoundRedirect from '../NotFoundRedirect';

const errorToast = vi.fn();

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ error: errorToast }),
}));

describe('NotFoundRedirect', () => {
  beforeEach(() => {
    errorToast.mockClear();
  });

  it('shows one error toast and sends the user to the target page', () => {
    render(
      <MemoryRouter initialEntries={['/made/up/path']}>
        <Routes>
          <Route
            path="*"
            element={
              <NotFoundRedirect
                to="/dashboard"
                title="Page not found"
                message="The address you opened does not exist."
              />
            }
          />
          <Route path="/dashboard" element={<div>dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('dashboard')).toBeInTheDocument();
    expect(errorToast).toHaveBeenCalledTimes(1);
    expect(errorToast).toHaveBeenCalledWith(
      'Page not found',
      'The address you opened does not exist.',
    );
  });

  it('works without a message', () => {
    render(
      <MemoryRouter initialEntries={['/x']}>
        <Routes>
          <Route
            path="/x"
            element={<NotFoundRedirect to="/home" title="Gone" />}
          />
          <Route path="/home" element={<div>home</div>} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText('home')).toBeInTheDocument();
    expect(errorToast).toHaveBeenCalledWith('Gone', undefined);
  });
});
