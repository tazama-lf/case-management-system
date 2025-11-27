import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import ErrorFallback from '../ErrorFallback';

describe('ErrorFallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders with default props', () => {
    render(<ErrorFallback />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByText('An unexpected error occurred. Please try again.')).toBeInTheDocument();
  });

  it('renders custom title', () => {
    render(<ErrorFallback title="Custom Error Title" />);

    expect(screen.getByText('Custom Error Title')).toBeInTheDocument();
  });

  it('renders custom message', () => {
    render(<ErrorFallback message="Custom error message" />);

    expect(screen.getByText('Custom error message')).toBeInTheDocument();
  });

  it('displays error message from error object', () => {
    const error = new Error('Test error message');
    render(<ErrorFallback error={error} />);

    expect(screen.getByText('Test error message')).toBeInTheDocument();
  });

  it('displays network error message', () => {
    const error = new Error('Network Error');
    render(<ErrorFallback error={error} />);

    expect(screen.getByText(/Unable to connect to the server/i)).toBeInTheDocument();
  });

  it('displays fetch error message', () => {
    const error = new Error('fetch failed');
    render(<ErrorFallback error={error} />);

    expect(screen.getByText(/Unable to connect to the server/i)).toBeInTheDocument();
  });

  it('displays 401 unauthorized error message', () => {
    const error = new Error('401 Unauthorized');
    render(<ErrorFallback error={error} />);

    expect(screen.getByText(/Your session has expired/i)).toBeInTheDocument();
  });

  it('displays 403 forbidden error message', () => {
    const error = new Error('403 Forbidden');
    render(<ErrorFallback error={error} />);

    expect(screen.getByText(/You don't have permission/i)).toBeInTheDocument();
  });

  it('displays 404 not found error message', () => {
    const error = new Error('404 Not Found');
    render(<ErrorFallback error={error} />);

    expect(screen.getByText(/The requested resource was not found/i)).toBeInTheDocument();
  });

  it('displays 500 server error message', () => {
    const error = new Error('500 Internal Server Error');
    render(<ErrorFallback error={error} />);

    expect(screen.getByText(/A server error occurred/i)).toBeInTheDocument();
  });

  it('shows retry button when showRetry is true and resetError is provided', () => {
    const resetError = vi.fn();
    render(<ErrorFallback resetError={resetError} showRetry={true} />);

    expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
  });

  it('does not show retry button when showRetry is false', () => {
    const resetError = vi.fn();
    render(<ErrorFallback resetError={resetError} showRetry={false} />);

    expect(screen.queryByRole('button', { name: /Try Again/i })).not.toBeInTheDocument();
  });

  it('does not show retry button when resetError is not provided', () => {
    render(<ErrorFallback showRetry={true} />);

    expect(screen.queryByRole('button', { name: /Try Again/i })).not.toBeInTheDocument();
  });

  it('calls resetError when retry button is clicked', async () => {
    const user = userEvent.setup();
    const resetError = vi.fn();
    render(<ErrorFallback resetError={resetError} showRetry={true} />);

    const retryButton = screen.getByRole('button', { name: /Try Again/i });
    await user.click(retryButton);

    expect(resetError).toHaveBeenCalledTimes(1);
  });

  it('shows error stack in development mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at test.js:1:1';

    render(<ErrorFallback error={error} />);

    expect(screen.getByText(/Show Error Details/i)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('does not show error stack in production mode', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at test.js:1:1';

    render(<ErrorFallback error={error} />);

    expect(screen.queryByText(/Show Error Details/i)).not.toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('displays error stack when details are expanded', async () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const user = userEvent.setup();
    const error = new Error('Test error');
    error.stack = 'Error: Test error\n    at test.js:1:1';

    render(<ErrorFallback error={error} />);

    const detailsButton = screen.getByText(/Show Error Details/i);
    await user.click(detailsButton);

    expect(screen.getByText(/Error: Test error/i)).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });
});

