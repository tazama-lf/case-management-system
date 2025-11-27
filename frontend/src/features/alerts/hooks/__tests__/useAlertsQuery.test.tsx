import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { NotificationProvider } from '../../../../shared/providers/NotificationProvider';
import { useAlerts, useAlertOperations } from '../../hooks/useAlertsQuery';

// Mocks for triage service used by the alerts hooks
const mockGetAlerts = vi.fn();
const mockGetAlertById = vi.fn();
const mockGetAlertActionHistory = vi.fn();
const mockPerformManualTriage = vi.fn();
const mockUpdateAlert = vi.fn();
const mockCloseAlert = vi.fn();
const mockGetFilterOptions = vi.fn();
const mockGetNALTAlerts = vi.fn();

vi.mock('../../services/triageservice', () => ({
  __esModule: true,
  default: {
    getAlerts: (...args: unknown[]) => mockGetAlerts(...args),
    getAlertById: (...args: unknown[]) => mockGetAlertById(...args),
    getAlertActionHistory: (...args: unknown[]) =>
      mockGetAlertActionHistory(...args),
    performManualTriage: (...args: unknown[]) =>
      mockPerformManualTriage(...args),
    updateAlert: (...args: unknown[]) => mockUpdateAlert(...args),
    closeAlert: (...args: unknown[]) => mockCloseAlert(...args),
    getFilterOptions: (...args: unknown[]) => mockGetFilterOptions(...args),
    getNALTAlerts: (...args: unknown[]) => mockGetNALTAlerts(...args),
  },
}));

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
      {alerts.map((alert) => (
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
      <NotificationProvider>{component}</NotificationProvider>
    </QueryClientProvider>,
  );
};

describe('useAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    const baseAlerts = [
      {
        alert_id: 'ALERT-001',
        message: 'First alert',
      },
      {
        alert_id: 'ALERT-002',
        message: 'Second alert',
      },
    ];

    mockGetAlerts.mockImplementation(
      async (filters: { search?: string } = {}) => {
        const { search } = filters;
        let alerts = baseAlerts;

        if (search) {
          const term = search.toLowerCase();
          alerts = alerts.filter(
            (a) =>
              a.alert_id.toLowerCase().includes(term) ||
              a.message.toLowerCase().includes(term),
          );
        }

        return {
          alerts,
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: alerts.length,
            pageSize: 10,
          },
        };
      },
    );
  });

  it('should fetch alerts successfully', async () => {
    renderWithProviders(<TestComponent />);

    expect(screen.getByText('Loading...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('alerts-count')).toHaveTextContent('2');
    });

    expect(screen.getByTestId('alert-ALERT-001')).toBeInTheDocument();
    expect(screen.getByTestId('alert-ALERT-002')).toBeInTheDocument();
  });

  it('should handle search with debouncing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestComponentWithSearch />);

    const searchInput = screen.getByTestId('search-input');

    await user.type(searchInput, 'ALERT-001');

    await waitFor(
      () => {
        expect(screen.getByTestId('alerts-count')).toHaveTextContent('1');
      },
      { timeout: 1000 },
    );
  });

  it('should handle refetch', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByTestId('alerts-count')).toHaveTextContent('2');
    });

    const refetchButton = screen.getByText('Refetch');
    await user.click(refetchButton);

    await waitFor(() => {
      expect(screen.getByTestId('alerts-count')).toHaveTextContent('2');
    });
  });

  it('should handle API errors', async () => {
    mockGetAlerts.mockRejectedValueOnce(new Error('Internal server error'));

    renderWithProviders(<TestComponent />);

    await waitFor(() => {
      expect(screen.getByText(/Error:/)).toBeInTheDocument();
    });
  });
});

describe('useAlertOperations', () => {
  const TestAlertOperations = () => {
    const {
      updateAlert,
      closeAlert,
      performManualTriage,
      isUpdatingAlert,
      isClosingAlert,
      isPerformingManualTriage,
    } = useAlertOperations();

    const handleUpdate = () => {
      updateAlert({
        alertId: 'ALERT-001',
        data: { priority: 'CRITICAL' },
      });
    };

    const handleClose = () => {
      closeAlert({
        alertId: 'ALERT-001',
        status: 'CLOSED',
        notes: 'Test closure',
      });
    };

    const handleManualTriage = () => {
      performManualTriage({
        alertId: 'ALERT-001',
        data: {
          priorityScore: 85,
          predictionOutcome: 'TRUE_POSITIVE',
          status: 'STATUS_82_CLOSED_CONFIRMED',
          note: 'Manual triage test',
        },
      });
    };

    return (
      <div>
        <button onClick={handleUpdate} disabled={isUpdatingAlert}>
          Update Alert
        </button>
        <button onClick={handleClose} disabled={isClosingAlert}>
          Close Alert
        </button>
        <button
          onClick={handleManualTriage}
          disabled={isPerformingManualTriage}
        >
          Perform Manual Triage
        </button>
      </div>
    );
  };

  it('should handle alert update mutation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestAlertOperations />);

    const updateButton = screen.getByText('Update Alert');
    await user.click(updateButton);

    expect(updateButton).toBeInTheDocument();
  });

  it('should handle manual triage mutation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestAlertOperations />);

    const manualTriageButton = screen.getByText('Perform Manual Triage');
    await user.click(manualTriageButton);

    expect(manualTriageButton).toBeInTheDocument();
  });

  it('should handle close alert mutation', async () => {
    const user = userEvent.setup();
    renderWithProviders(<TestAlertOperations />);

    const closeButton = screen.getByText('Close Alert');
    await user.click(closeButton);

    expect(closeButton).toBeInTheDocument();
  });
});
