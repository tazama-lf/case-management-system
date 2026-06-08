import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Dashboard from '../Dashboard';
import { useDashboard } from '../../hooks/useDashboard';

vi.mock('../../hooks/useDashboard', () => ({
  useDashboard: vi.fn(),
}));

vi.mock('@/features/dashboard/components/StatsCards', () => ({
  default: ({ stats }: any) => (
    <div data-testid="stats-cards">Stats: {stats.totalAlerts}</div>
  ),
}));

vi.mock('@/features/dashboard/components/DashboardSection', () => ({
  default: ({ title, children }: any) => (
    <div
      data-testid={`dashboard-section-${title.toLowerCase().replace(/\s+/g, '-')}`}
    >
      <h3>{title}</h3>
      {children}
    </div>
  ),
}));

vi.mock('@/features/dashboard/components/AlertSummaryItem', () => ({
  default: ({ summary }: any) => (
    <div data-testid="alert-summary">Alert: {summary.priority}</div>
  ),
}));

vi.mock('@/features/dashboard/components/CaseSummaryItem', () => ({
  default: ({ case: caseItem }: any) => (
    <div data-testid="case-summary">Case: {caseItem.status}</div>
  ),
}));

vi.mock('@/shared/components/ui', () => ({
  PageContainer: ({ title, subtitle, children }: any) => (
    <div data-testid="page-container">
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {children}
    </div>
  ),
  LoadingState: ({ loading, loadingComponent, children }: any) => (
    <div data-testid="loading-state">
      {loading ? loadingComponent : children}
    </div>
  ),
  ErrorState: ({ title, message, onRetry }: any) => (
    <div data-testid="error-state">
      <h2>{title}</h2>
      <p>{message}</p>
      {onRetry && <button onClick={onRetry}>Retry</button>}
    </div>
  ),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('Dashboard', () => {
  const mockUseDashboard = vi.mocked(useDashboard);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state', () => {
    mockUseDashboard.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    } as any);

    render(<Dashboard />, { wrapper: createWrapper() });

    expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });

  it('renders error state', () => {
    const error = new Error('Failed to load');
    mockUseDashboard.mockReturnValue({
      data: undefined,
      isLoading: false,
      error,
    } as any);

    render(<Dashboard />, { wrapper: createWrapper() });

    expect(screen.getByTestId('error-state')).toBeInTheDocument();
    expect(screen.getByText('Dashboard Error')).toBeInTheDocument();
  });

  it('renders dashboard with data', async () => {
    const mockData = {
      stats: {
        totalAlerts: 10,
        highPriorityAlerts: 5,
        openCases: 3,
        casesResolvedThisWeek: 7,
      },
      recentCases: [
        { priority: 'High', count: 5, description: 'High priority cases' },
      ],
      activeCases: [
        { status: 'assigned', count: 3, description: 'Assigned cases' },
      ],
    };

    mockUseDashboard.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    } as any);

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByTestId('stats-cards')).toBeInTheDocument();
    });

    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(
      screen.getByTestId('dashboard-section-recent-cases'),
    ).toBeInTheDocument();
    expect(
      screen.getByTestId('dashboard-section-active-cases'),
    ).toBeInTheDocument();
  });

  it('renders empty state when no alerts', async () => {
    const mockData = {
      stats: {
        totalAlerts: 0,
        highPriorityAlerts: 0,
        openCases: 0,
        casesResolvedThisWeek: 0,
      },
      recentCases: [],
      activeCases: [],
    };

    mockUseDashboard.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    } as any);

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      expect(screen.getByText('No recent cases')).toBeInTheDocument();
    });

    expect(screen.getByText('No active cases')).toBeInTheDocument();
  });

  it('renders alert summary items', async () => {
    const mockData = {
      stats: {
        totalAlerts: 10,
        highPriorityAlerts: 5,
        openCases: 3,
        casesResolvedThisWeek: 7,
      },
      recentCases: [
        { priority: 'High', count: 5, description: 'High priority' },
        { priority: 'Medium', count: 3, description: 'Medium priority' },
      ],
      activeCases: [],
    };

    mockUseDashboard.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    } as any);

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      const alertSummaries = screen.getAllByTestId('alert-summary');
      expect(alertSummaries.length).toBe(2);
    });
  });

  it('renders case summary items', async () => {
    const mockData = {
      stats: {
        totalAlerts: 10,
        highPriorityAlerts: 5,
        openCases: 3,
        casesResolvedThisWeek: 7,
      },
      recentCases: [],
      activeCases: [
        { status: 'assigned', count: 3, description: 'Assigned' },
        { status: 'pending', count: 2, description: 'Pending' },
      ],
    };

    mockUseDashboard.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    } as any);

    render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      const caseSummaries = screen.getAllByTestId('case-summary');
      expect(caseSummaries.length).toBe(2);
    });
  });

  it('applies animation classes when data is loaded', async () => {
    const mockData = {
      stats: {
        totalAlerts: 10,
        highPriorityAlerts: 5,
        openCases: 3,
        casesResolvedThisWeek: 7,
      },
      recentCases: [],
      activeCases: [],
    };

    mockUseDashboard.mockReturnValue({
      data: mockData,
      isLoading: false,
      error: null,
    } as any);

    const { container } = render(<Dashboard />, { wrapper: createWrapper() });

    await waitFor(() => {
      const animatedDiv = container.querySelector('.transition-all');
      expect(animatedDiv).toBeInTheDocument();
    });
  });

  it('handles error retry', () => {
    const originalReload = window.location.reload;
    const reloadSpy = vi.fn();
    delete (window as any).location;
    (window as any).location = { reload: reloadSpy };

    const error = new Error('Failed to load');
    mockUseDashboard.mockReturnValue({
      data: undefined,
      isLoading: false,
      error,
    } as any);

    render(<Dashboard />, { wrapper: createWrapper() });

    const retryButton = screen.getByText('Retry');
    retryButton.click();

    expect(reloadSpy).toHaveBeenCalled();

    window.location = originalReload;
  });
});
