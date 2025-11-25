import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryProvider } from '../QueryProvider';
import { useQuery } from '@tanstack/react-query';

const TestComponent: React.FC = () => {
  const { data } = useQuery({ queryKey: ['test'], queryFn: async () => 'ok' });

  return <div>{data}</div>;
};

describe('QueryProvider', () => {
  it('provides react-query context to children', async () => {
    render(
      <QueryProvider>
        <TestComponent />
      </QueryProvider>,
    );

    await waitFor(() => expect(screen.getByText('ok')).toBeInTheDocument());
  });
});
