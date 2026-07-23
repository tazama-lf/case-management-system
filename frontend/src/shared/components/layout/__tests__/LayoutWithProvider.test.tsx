import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

vi.mock('react-router-dom', () => ({
  Outlet: () => <div data-testid="outlet">Outlet Content</div>,
}));

vi.mock('../Layout', () => ({
  default: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="layout">{children}</div>
  ),
}));

import LayoutWithProvider from '../LayoutWithProvider';

describe('LayoutWithProvider', () => {
  it('renders Layout wrapping Outlet', () => {
    render(<LayoutWithProvider />);
    expect(screen.getByTestId('layout')).toBeInTheDocument();
    expect(screen.getByTestId('outlet')).toBeInTheDocument();
  });

  it('Outlet is a child of Layout', () => {
    render(<LayoutWithProvider />);
    const layout = screen.getByTestId('layout');
    const outlet = screen.getByTestId('outlet');
    expect(layout).toContainElement(outlet);
  });
});
