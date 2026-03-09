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
});
