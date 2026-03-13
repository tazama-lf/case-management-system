import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ErrorState from '../ErrorState';

describe('ErrorState (ui)', () => {
  it('renders with default props', () => {
    render(<ErrorState />);
    expect(screen.getByText('Error Loading Data')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred')).toBeInTheDocument();
  });

  it('renders custom title and message', () => {
    render(<ErrorState title="Oops" message="Something broke" />);
    expect(screen.getByText('Oops')).toBeInTheDocument();
    expect(screen.getByText('Something broke')).toBeInTheDocument();
  });

  it('renders retry button when showRetry and onRetry are set', () => {
    render(<ErrorState showRetry onRetry={vi.fn()} />);
    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
  });

  it('does not render retry button when showRetry is false', () => {
    render(<ErrorState showRetry={false} onRetry={vi.fn()} />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState showRetry />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState showRetry onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: /Try Again/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('applies small size classes', () => {
    const { container } = render(<ErrorState size="small" />);
    expect(container.firstChild).toHaveClass('p-4');
  });

  it('applies medium size classes (default)', () => {
    const { container } = render(<ErrorState />);
    expect(container.firstChild).toHaveClass('p-6');
  });

  it('applies large size classes', () => {
    const { container } = render(<ErrorState size="large" />);
    expect(container.firstChild).toHaveClass('p-8');
  });

  it('applies error severity classes (default)', () => {
    const { container } = render(<ErrorState />);
    expect(container.firstChild).toHaveClass('bg-red-50');
  });

  it('applies warning severity classes', () => {
    const { container } = render(<ErrorState severity="warning" />);
    expect(container.firstChild).toHaveClass('bg-yellow-50');
  });

  it('applies info severity classes', () => {
    const { container } = render(<ErrorState severity="info" />);
    expect(container.firstChild).toHaveClass('bg-blue-50');
  });

  it('applies custom className', () => {
    const { container } = render(<ErrorState className="extra" />);
    expect(container.firstChild).toHaveClass('extra');
  });

  it('renders icon', () => {
    const { container } = render(<ErrorState />);
    expect(container.querySelector('svg')).toBeInTheDocument();
  });
});
