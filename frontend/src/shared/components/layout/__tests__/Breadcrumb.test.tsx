import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Breadcrumb from '../Breadcrumb';

const mockUseLocation = vi.fn();

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useLocation: () => mockUseLocation(),
  };
});

describe('Breadcrumb', () => {
  beforeEach(() => {
    mockUseLocation.mockReturnValue({
      pathname: '/cases/123',
    });
  });

  it('renders breadcrumbs from location pathname', () => {
    render(
      <MemoryRouter>
        <Breadcrumb />
      </MemoryRouter>
    );

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Cases')).toBeInTheDocument();
    expect(screen.getByText('123')).toBeInTheDocument();
  });

  it('renders custom breadcrumb items when provided', () => {
    const items = [
      { name: 'Home', href: '/' },
      { name: 'Cases', href: '/cases' },
      { name: 'Case Details', current: true },
    ];

    render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    expect(screen.getByText('Home')).toBeInTheDocument();
    expect(screen.getByText('Cases')).toBeInTheDocument();
    expect(screen.getByText('Case Details')).toBeInTheDocument();
  });

  it('returns null when breadcrumb items length is 1 or less', () => {
    const { container } = render(
      <MemoryRouter>
        <Breadcrumb items={[{ name: 'Dashboard', href: '/' }]} />
      </MemoryRouter>
    );

    expect(container.firstChild).toBeNull();
  });

  it('renders links for non-current items', () => {
    const items = [
      { name: 'Home', href: '/' },
      { name: 'Cases', href: '/cases' },
      { name: 'Details', current: true },
    ];

    render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    const homeLink = screen.getByText('Home').closest('a');
    expect(homeLink).toHaveAttribute('href', '/');
  });

  it('renders span for current item', () => {
    const items = [
      { name: 'Home', href: '/' },
      { name: 'Current', current: true },
    ];

    render(
      <MemoryRouter>
        <Breadcrumb items={items} />
      </MemoryRouter>
    );

    const currentItem = screen.getByText('Current');
    expect(currentItem.tagName).toBe('SPAN');
    expect(currentItem).toHaveAttribute('aria-current', 'page');
  });

  it('applies custom className', () => {
    const { container } = render(
      <MemoryRouter>
        <Breadcrumb className="custom-class" />
      </MemoryRouter>
    );

    const nav = container.querySelector('nav');
    expect(nav).toHaveClass('custom-class');
  });

  it('formats path segments correctly', () => {
    mockUseLocation.mockReturnValue({
      pathname: '/case-management/details',
    });

    render(
      <MemoryRouter>
        <Breadcrumb />
      </MemoryRouter>
    );

    expect(screen.getByText('Case management')).toBeInTheDocument();
    expect(screen.getByText('Details')).toBeInTheDocument();
  });
});
