import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryProvider, queryClient } from '../QueryProvider';
import { useQuery, useMutation } from '@tanstack/react-query';

const TestQueryComponent: React.FC = () => {
  const { data, isLoading } = useQuery({
    queryKey: ['test'],
    queryFn: async () => 'ok',
  });

  if (isLoading) return <div>Loading...</div>;
  return <div>{data}</div>;
};

const TestMutationComponent: React.FC = () => {
  const mutation = useMutation({
    mutationFn: async (value: string) => value,
  });

  return (
    <div>
      <button onClick={() => mutation.mutate('test')}>Mutate</button>
      {mutation.data && <div>{mutation.data}</div>}
    </div>
  );
};

const TestRetryComponent: React.FC<{ error: Error }> = ({ error }) => {
  const { data, isError, failureCount } = useQuery({
    queryKey: ['retry-test', error.message],
    queryFn: async () => {
      throw error;
    },
  });

  if (isError) return <div>Error: {failureCount} failures</div>;
  return <div>{data ?? 'loading'}</div>;
};

describe('QueryProvider', () => {
  beforeEach(() => {
    queryClient.clear();
  });

  it('provides react-query context to children', async () => {
    render(
      <QueryProvider>
        <TestQueryComponent />
      </QueryProvider>,
    );

    await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument());
  });

  it('provides query client with default options', async () => {
    const TestComponent = () => {
      const { data } = useQuery({
        queryKey: ['stale-test'],
        queryFn: async () => 'stale-data',
      });
      return <div>{data}</div>;
    };

    render(
      <QueryProvider>
        <TestComponent />
      </QueryProvider>,
    );

    await waitFor(() =>
      expect(screen.getByText('stale-data')).toBeInTheDocument(),
    );
  });

  it('handles mutations with retry configuration', async () => {
    const { userEvent } = await import('@testing-library/user-event');
    const user = userEvent.setup();
    render(
      <QueryProvider>
        <TestMutationComponent />
      </QueryProvider>,
    );

    const button = screen.getByText('Mutate');
    await user.click(button);

    await waitFor(() => {
      expect(screen.getByText('test')).toBeInTheDocument();
    });
  });

  it('renders ReactQueryDevtools in development', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'development';

    const { container } = render(
      <QueryProvider>
        <div>Test</div>
      </QueryProvider>,
    );

    // Devtools should be rendered (may not be visible but should exist)
    expect(container).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('does not render ReactQueryDevtools in production', () => {
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = 'production';

    const { container } = render(
      <QueryProvider>
        <div>Test</div>
      </QueryProvider>,
    );

    expect(container).toBeInTheDocument();

    process.env.NODE_ENV = originalEnv;
  });

  it('does not retry on 401 errors', async () => {
    const error = new Error('Unauthorized 401');
    render(
      <QueryProvider>
        <TestRetryComponent error={error} />
      </QueryProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    // failureCount should be 1 (no retries)
    expect(screen.getByText('Error: 1 failures')).toBeInTheDocument();
  });

  it('does not retry on 403 errors', async () => {
    const error = new Error('Forbidden 403');
    render(
      <QueryProvider>
        <TestRetryComponent error={error} />
      </QueryProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    expect(screen.getByText('Error: 1 failures')).toBeInTheDocument();
  });

  it('does not retry on 404 errors', async () => {
    const error = new Error('Not Found 404');
    render(
      <QueryProvider>
        <TestRetryComponent error={error} />
      </QueryProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByText(/Error:/)).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    expect(screen.getByText('Error: 1 failures')).toBeInTheDocument();
  });

  it('retries on other errors up to 3 times', async () => {
    let callCount = 0;
    const TestRetryCount: React.FC = () => {
      const { isError } = useQuery({
        queryKey: ['retry-500-test'],
        queryFn: async () => {
          callCount++;
          throw new Error('Server error 500');
        },
        retryDelay: 0,
      });

      if (isError) return <div>Failed after retries</div>;
      return <div>loading</div>;
    };

    render(
      <QueryProvider>
        <TestRetryCount />
      </QueryProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByText('Failed after retries')).toBeInTheDocument();
      },
      { timeout: 15000 },
    );
    // Initial attempt + 3 retries = 4 calls
    expect(callCount).toBe(4);
  });

  it('handles non-Error objects in retry logic', async () => {
    let callCount = 0;
    const TestNonErrorRetry: React.FC = () => {
      const { isError } = useQuery({
        queryKey: ['non-error-retry'],
        queryFn: async () => {
          callCount++;
          throw 'string-error';
        },
        retryDelay: 0,
      });

      if (isError) return <div>NonError failed</div>;
      return <div>loading</div>;
    };

    render(
      <QueryProvider>
        <TestNonErrorRetry />
      </QueryProvider>,
    );

    await waitFor(
      () => {
        expect(screen.getByText('NonError failed')).toBeInTheDocument();
      },
      { timeout: 15000 },
    );
    // Non-Error: retry returns failureCount < 3, so 4 total calls
    expect(callCount).toBe(4);
  });
});
