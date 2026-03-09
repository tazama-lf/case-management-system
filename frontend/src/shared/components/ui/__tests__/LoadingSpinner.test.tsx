import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import LoadingSpinner from '../LoadingSpinner';

describe('LoadingSpinner', () => {
  it('should render loading spinner with default props', () => {
    render(<LoadingSpinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).toBeInTheDocument();
    expect(spinner).toHaveAttribute('aria-label', 'Loading');

    const srText = screen.getByText('Loading...');
    expect(srText).toBeInTheDocument();
    expect(srText).toHaveClass('sr-only');
  });

  it('should render small size spinner', () => {
    render(<LoadingSpinner size="sm" />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('h-4', 'w-4');
  });

  it('should render medium size spinner (default)', () => {
    render(<LoadingSpinner size="md" />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('h-8', 'w-8');
  });

  it('should render large size spinner', () => {
    render(<LoadingSpinner size="lg" />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('h-12', 'w-12');
  });

  it('should apply custom className', () => {
    render(<LoadingSpinner className="custom-class" />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('custom-class');
  });

  it('should render in fullscreen mode', () => {
    const { container } = render(<LoadingSpinner fullScreen />);

    const fullscreenContainer = container.querySelector('.min-h-screen');
    expect(fullscreenContainer).toBeInTheDocument();
    expect(fullscreenContainer).toHaveClass(
      'flex',
      'items-center',
      'justify-center',
    );
  });

  it('should render normally when fullScreen is false', () => {
    const { container } = render(<LoadingSpinner fullScreen={false} />);

    const fullscreenContainer = container.querySelector('.min-h-screen');
    expect(fullscreenContainer).not.toBeInTheDocument();
  });

  it('should have spin animation class', () => {
    render(<LoadingSpinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass('animate-spin');
  });

  it('should have proper styling classes', () => {
    render(<LoadingSpinner />);

    const spinner = screen.getByRole('status');
    expect(spinner).toHaveClass(
      'rounded-full',
      'border-b-2',
      'border-blue-600',
    );
  });
});
