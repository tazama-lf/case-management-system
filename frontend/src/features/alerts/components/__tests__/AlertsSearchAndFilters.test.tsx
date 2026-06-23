import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertsSearchAndFilters from '../AlertsSearchAndFilters';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { filterService } from '../../../cases/services/filterService';

const mockSuccess = vi.fn();
const mockError = vi.fn();

// Mock dependencies
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ success: mockSuccess, error: mockError }),
}));

vi.mock('../../../cases/services/filterService', () => ({
  filterService: {
    getFilters: vi.fn().mockResolvedValue([]),
    createFilter: vi.fn().mockResolvedValue({}),
  },
}));

vi.mock('../../../auth/services/authService', () => ({
  default: {
    getUser: vi.fn().mockReturnValue({ userId: 'user-1' }),
  },
}));

const baseFilters = {
  query: '',
  source: '',
  type: '',
  priority: '',
  timeRange: '',
  customDateRange: undefined,
};

describe('AlertsSearchAndFilters', () => {
  const onFilterChange = vi.fn();
  const onClearFilters = vi.fn();
  const onCustomDateRangeChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const renderComponent = (overrides = {}) =>
    render(
      <AlertsSearchAndFilters
        searchFilters={{ ...baseFilters, ...overrides }}
        onFilterChange={onFilterChange}
        onClearFilters={onClearFilters}
        customDateRange={{ startDate: '', endDate: '' }}
        onCustomDateRangeChange={onCustomDateRangeChange}
        alertTypes={['FRAUD']}
        priorities={['NEW', 'URGENT']}
        sources={['System A']}
      />,
    );

  it('shows active badge and clear button when filters are applied', async () => {
    const user = userEvent.setup();
    renderComponent({ priority: 'URGENT' });

    await user.click(screen.getByRole('button', { name: /filters/i }));
    expect(screen.getByText(/Active/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('updates query and time range filters', async () => {
    renderComponent();

    fireEvent.change(screen.getByPlaceholderText(/search by alert id/i), {
      target: { value: 'ALERT-1' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('query', 'ALERT-1');

    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    const timeRangeSelect = screen
      .getByText('Time Range')
      .parentElement?.querySelector('select') as HTMLSelectElement;
    fireEvent.change(timeRangeSelect, {
      target: { value: 'custom' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('timeRange', 'custom');
  });

  it('shows custom date pickers when custom range is selected', async () => {
    const { rerender } = renderComponent();

    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    const timeRangeSelect2 = screen
      .getByText('Time Range')
      .parentElement?.querySelector('select') as HTMLSelectElement;
    fireEvent.change(timeRangeSelect2, {
      target: { value: 'custom' },
    });

    rerender(
      <AlertsSearchAndFilters
        searchFilters={{ ...baseFilters, timeRange: 'custom' }}
        onFilterChange={onFilterChange}
        onClearFilters={onClearFilters}
        customDateRange={{ startDate: '', endDate: '' }}
        onCustomDateRangeChange={onCustomDateRangeChange}
        alertTypes={['FRAUD']}
        priorities={['NEW', 'URGENT']}
        sources={['System A']}
      />,
    );

    const startDateInput = screen
      .getByText('Start Date')
      .parentElement?.querySelector('input') as HTMLInputElement;
    const endDateInput = screen
      .getByText('End Date')
      .parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(startDateInput, {
      target: { value: '2024-01-01' },
    });
    fireEvent.change(endDateInput, {
      target: { value: '2024-01-02' },
    });

    expect(onCustomDateRangeChange).toHaveBeenCalledTimes(2);
  });

  it('saves current filters successfully', async () => {
    (filterService.createFilter as vi.Mock).mockResolvedValue({});
    (filterService.getFilters as vi.Mock)
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([
        {
          filter_Id: 7,
          user_filters: JSON.stringify({
            alertType: '',
            priority: 'URGENT',
            source: '',
            timeRange: '',
          }),
        },
      ]);

    renderComponent({ priority: 'URGENT' });

    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    await userEvent.click(
      screen.getByRole('button', { name: /save current filters/i }),
    );

    await waitFor(() => {
      expect(filterService.createFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          filterType: 'Alert',
        }),
      );
      expect(mockSuccess).toHaveBeenCalledWith(
        'Filter Created',
        expect.any(String),
      );
    });

    expect(filterService.getFilters).toHaveBeenCalledTimes(2);
    expect(
      await screen.findByRole('option', {
        name: /ALL TYPES - URGENT - ALL SOURCES - ALL TIME/i,
      }),
    ).toBeInTheDocument();
  });

  it('handles save filter error', async () => {
    (filterService.createFilter as vi.Mock).mockRejectedValue(
      new Error('Save failed'),
    );
    renderComponent({ priority: 'URGENT' });

    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    await userEvent.click(
      screen.getByRole('button', { name: /save current filters/i }),
    );

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Create Filter Failed',
        'Save failed',
      );
    });
  });

  it('loads and selects saved filters', async () => {
    (filterService.getFilters as vi.Mock).mockResolvedValue([
      {
        filter_Id: 1,
        user_filters: JSON.stringify({
          alertType: 'FRAUD',
          priority: 'URGENT',
          source: 'System A',
          timeRange: 'today',
        }),
      },
    ]);

    renderComponent();
    await userEvent.click(screen.getByRole('button', { name: /filters/i }));

    await waitFor(() => {
      expect(screen.getByText(/select a saved filter/i)).toBeInTheDocument();
    });

    const savedSelect = screen
      .getByText(/select a saved filter/i)
      .closest('select') as HTMLSelectElement;
    fireEvent.change(savedSelect, { target: { value: '1' } });

    // Wait for async setTimeout calls to complete
    await waitFor(
      () => {
        expect(onFilterChange).toHaveBeenCalledWith('type', 'FRAUD');
        expect(onFilterChange).toHaveBeenCalledWith('priority', 'URGENT');
        expect(onFilterChange).toHaveBeenCalledWith('source', 'System A');
      },
      { timeout: 100 },
    );
  });

  it('renders filter dropdowns with provided options', async () => {
    renderComponent();
    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    expect(screen.getByText('Alert Type')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
    expect(screen.getByText('Source')).toBeInTheDocument();
  });
});
