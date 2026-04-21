import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertsSearchAndFilters from '../AlertsSearchAndFilters';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
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
    const timeRangeSelect = screen.getByText('Time Range').parentElement?.querySelector('select') as HTMLSelectElement;
    fireEvent.change(timeRangeSelect, {
      target: { value: 'custom' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('timeRange', 'custom');
  });

  it('shows custom date pickers when custom range is selected', async () => {
    const { rerender } = renderComponent();

    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    const timeRangeSelect2 = screen.getByText('Time Range').parentElement?.querySelector('select') as HTMLSelectElement;
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

    const startDateInput = screen.getByText('Start Date').parentElement?.querySelector('input') as HTMLInputElement;
    const endDateInput = screen.getByText('End Date').parentElement?.querySelector('input') as HTMLInputElement;
    fireEvent.change(startDateInput, {
      target: { value: '2024-01-01' },
    });
    fireEvent.change(endDateInput, {
      target: { value: '2024-01-02' },
    });

    expect(onCustomDateRangeChange).toHaveBeenCalledTimes(2);
  });
});
