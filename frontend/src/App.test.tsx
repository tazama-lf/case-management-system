import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import { vi } from 'vitest';

vi.mock('react-router-dom', async () => {
  const actual =
    await vi.importActual<typeof import('react-router-dom')>(
      'react-router-dom',
    );
  return {
    ...actual,
    RouterProvider: () => <div data-testid="router-provider" />,
  };
});

describe('App', () => {
  it('renders skip to main content button', () => {
    render(<App />);
    expect(
      screen.getByRole('button', { name: /skip to main content/i }),
    ).toBeInTheDocument();
  });
});
