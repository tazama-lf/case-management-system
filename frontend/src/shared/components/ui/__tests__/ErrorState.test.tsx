import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import ErrorState from '../ErrorState';

describe('ErrorState', () => {
  it('should render with default props', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    expect(screen.getByText('Error Loading Data')).toBeInTheDocument();
    expect(
      screen.getByText('An unexpected error occurred'),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /try again/i }),
    ).toBeInTheDocument();
  });

  it('should render with custom title and message', () => {
    render(
      <ErrorState
        title="Custom Error"
        message="This is a custom error message"
      />,
    );

    expect(screen.getByText('Custom Error')).toBeInTheDocument();
    expect(
      screen.getByText('This is a custom error message'),
    ).toBeInTheDocument();
  });

  it('should call onRetry when retry button is clicked', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    render(<ErrorState onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /try again/i });
    await user.click(retryButton);

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('should not show retry button when showRetry is false', () => {
    render(<ErrorState showRetry={false} />);

    expect(
      screen.queryByRole('button', { name: /try again/i }),
    ).not.toBeInTheDocument();
  });

  it('should not show retry button when onRetry is not provided', () => {
    render(<ErrorState showRetry={true} onRetry={undefined} />);

    expect(
      screen.queryByRole('button', { name: /try again/i }),
    ).not.toBeInTheDocument();
  });

  describe('Size variants', () => {
    it('should render small size', () => {
      const { container } = render(<ErrorState size="small" />);

      const errorContainer = container.firstChild;
      expect(errorContainer).toHaveClass('p-4');
    });

    it('should render medium size (default)', () => {
      const { container } = render(<ErrorState size="medium" />);

      const errorContainer = container.firstChild;
      expect(errorContainer).toHaveClass('p-6');
    });

    it('should render large size', () => {
      const { container } = render(<ErrorState size="large" />);

      const errorContainer = container.firstChild;
      expect(errorContainer).toHaveClass('p-8');
    });
  });

  describe('Severity variants', () => {
    it('should render error severity (default)', () => {
      const { container } = render(<ErrorState severity="error" />);

      const errorContainer = container.firstChild;
      expect(errorContainer).toHaveClass('bg-red-50', 'border-red-200');
    });

    it('should render warning severity', () => {
      const { container } = render(<ErrorState severity="warning" />);

      const errorContainer = container.firstChild;
      expect(errorContainer).toHaveClass('bg-yellow-50', 'border-yellow-200');
    });

    it('should render info severity', () => {
      const { container } = render(<ErrorState severity="info" />);

      const errorContainer = container.firstChild;
      expect(errorContainer).toHaveClass('bg-blue-50', 'border-blue-200');
    });
  });

  it('should apply custom className', () => {
    const { container } = render(<ErrorState className="custom-error-class" />);

    const errorContainer = container.firstChild;
    expect(errorContainer).toHaveClass('custom-error-class');
  });

  it('should have proper ARIA attributes', () => {
    const onRetry = vi.fn();
    render(<ErrorState onRetry={onRetry} />);

    const retryButton = screen.getByRole('button', { name: /try again/i });
    expect(retryButton).toBeInTheDocument();
  });

  it('should render icon', () => {
    const { container } = render(<ErrorState />);

    // ExclamationCircleIcon should be rendered
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });
});
