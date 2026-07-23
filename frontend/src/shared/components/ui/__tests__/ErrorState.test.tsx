import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { ErrorState } from '../../error/ErrorState';

describe('ErrorState', () => {
  it('renders with default props', () => {
    render(<ErrorState />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(
      screen.getByText(
        'We encountered an error while loading this content. Please try again.',
      ),
    ).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<ErrorState title="Custom Error Title" />);

    expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<ErrorState message="Custom error message" />);

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('renders retry button when onRetry is provided', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    expect(
      screen.getByRole('button', { name: /Try Again/i }),
    ).toBeInTheDocument();
  });

  it('does not render retry button when onRetry is not provided', () => {
    render(<ErrorState />);

    expect(
      screen.queryByRole('button', { name: /Try Again/i }),
    ).not.toBeInTheDocument();
  });

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /Try Again/i });
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('applies custom className', () => {
    const { container } = render(<ErrorState className="custom-class" />);

    const errorState = container.firstChild;
    expect(errorState).toHaveClass('custom-class');
  });

  it('renders icon', () => {
    const { container } = render(<ErrorState />);

    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('renders all props together', () => {
    const onRetry = vi.fn();
    render(
      <ErrorState
        title="Custom Error"
        message="Custom message"
        onRetry={onRetry}
        className="my-class"
      />,
    );

    expect(screen.getByText('Custom Error')).toBeInTheDocument();
    expect(screen.getByText('Custom message')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Try Again/i }),
    ).toBeInTheDocument();
  });
});
