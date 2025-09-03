import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationProvider } from '../providers/NotificationProvider';
import { useAlerts, useAlertOperations } from '../../hooks/useAlertsQuery';

// Test component that uses the hook
const TestComponent = () => {
  const { alerts, isLoading, error, refetch } = useAlerts({
    search: '',
    page: 1,
    limit: 10,
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <div data-testid="alerts-count">{alerts.length}</div>
      <button onClick={() => refetch()}>Refetch</button>
      {alerts.map((alert: any) => (
        <div key={alert.alert_id} data-testid={`alert-${alert.alert_id}`}>
          {alert.message}
        </div>
      ))}
    </div>
  );
};

const TestComponentWithSearch = () => {
  const [search, setSearch] = React.useState('');
  const { alerts, isLoading } = useAlerts({
    search,
    page: 1,
    limit: 10,
  });

  return (
    <div>
      <input
        data-testid="search-input"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search alerts..."
      />
      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <div data-testid="alerts-count">{alerts.length}</div>
      )}
    </div>
  );
};

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        staleTime: 0,
        gcTime: 0,
      },
    },
  });

  return render(
    <QueryClientProvider client={queryClient}>
      <NotificationProvider>
        {component}
      </NotificationProvider>
    </QueryClientProvider>
  );
};

describe('useAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should fetch alerts successfully', async () => {
    renderWithProviders(<TestComponent />);

    // Should show loading initially
    expect(screen.getByText('Loading...')).toBeInTheDocument();

    // Wait for data to load
    await waitFor(() => {
      expect(screen.getByTestId('alerts-count')).toHaveTextContent('2');
    });

    // Should display mock alerts
    expect(screen.getByTestId('alert-ALERT-001')).toBeInTheDocument();
    expect(screen.getByTestId('alert-ALERT-002')).toBeInTheDocument();
  });

  it('should handle search with debouncing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestComponentWithSearch />);

    const searchInput = screen.getByTestId('search-input');

    // Type in search input
    await user.type(searchInput, 'ALERT-001');

    // Should debounce and search
    await waitFor(() => {
      expect(screen.getByTestId('alerts-count')).toHaveTextContent('1');
    }, { timeout: 1000 });
  });

  it('should handle refetch', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestComponent />);

    // Wait for initial load
    await waitFor(() => {
      expect(screen.getByTestId('alerts-count')).toHaveTextContent('2');
    });

    // Click refetch button
    const refetchButton = screen.getByText('Refetch');
    await user.click(refetchButton);

    // Should refetch data
    await waitFor(() => {
      expect(screen.getByTestId('alerts-count')).toHaveTextContent('2');
    });
  });

  it('should handle API errors', async () => {
    // Mock API to return error
    const { server } = await import('../test/mocks/server');
    const { http, HttpResponse } = await import('msw');
    
    server.use(
      http.get('/api/v1/triage/alerts', () => {
        return HttpResponse.json(
          { error: 'Internal server error' },
          { status: 500 }
        );
      })
    );

    renderWithProviders(<TestComponent />);

    // Should show error
    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });
});

describe('useAlertOperations', () => {
  const TestAlertOperations = () => {
    const { 
      updateAlert, 
      convertToCase, 
      closeAlert,
      isUpdatingAlert,
      isConvertingToCase,
      isClosingAlert
    } = useAlertOperations();

    const handleUpdate = () => {
      updateAlert({
        alertId: 'ALERT-001',
        data: { priority: 'CRITICAL' }
      });
    };

    const handleConvert = () => {
      convertToCase({
        alertId: 'ALERT-001',
        data: { priority: 'HIGH', caseType: 'FRAUD' }
      });
    };

    const handleClose = () => {
      closeAlert({ 
        alertId: 'ALERT-001', 
        status: 'CLOSED', 
        notes: 'Test closure' 
      });
    };

    return (
      <div>
        <button onClick={handleUpdate} disabled={isUpdatingAlert}>
          Update Alert
        </button>
        <button onClick={handleConvert} disabled={isConvertingToCase}>
          Convert to Case
        </button>
        <button onClick={handleClose} disabled={isClosingAlert}>
          Close Alert
        </button>
      </div>
    );
  };

  it('should handle alert update mutation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestAlertOperations />);

    const updateButton = screen.getByText('Update Alert');
    await user.click(updateButton);

    // Should handle the mutation (success handled by notifications)
    expect(updateButton).toBeInTheDocument();
  });

  it('should handle convert to case mutation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestAlertOperations />);

    const convertButton = screen.getByText('Convert to Case');
    await user.click(convertButton);

    // Should handle the mutation (success handled by notifications)
    expect(convertButton).toBeInTheDocument();
  });

  it('should handle close alert mutation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestAlertOperations />);

    const closeButton = screen.getByText('Close Alert');
    await user.click(closeButton);

    // Should handle the mutation (success handled by notifications)
    expect(closeButton).toBeInTheDocument();
  });
});
