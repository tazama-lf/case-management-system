import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertsSearchAndFilters from '../AlertsSearchAndFilters';
import { describe, it, expect, vi, beforeEach } from 'vitest';

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

    fireEvent.change(
      screen.getByPlaceholderText(/search by alert id/i),
      { target: { value: 'ALERT-1' } },
    );
    expect(onFilterChange).toHaveBeenCalledWith('query', 'ALERT-1');

    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    fireEvent.change(screen.getByLabelText(/Time Range/i), {
      target: { value: 'custom' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('timeRange', 'custom');
  });

  it('shows custom date pickers when custom range is selected', async () => {
    const { rerender } = renderComponent();

    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    fireEvent.change(screen.getByLabelText(/Time Range/i), {
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

    fireEvent.change(await screen.findByLabelText(/Start Date/i), {
      target: { value: '2024-01-01' },
    });
    fireEvent.change(await screen.findByLabelText(/End Date/i), {
      target: { value: '2024-01-02' },
    });

    expect(onCustomDateRangeChange).toHaveBeenCalledTimes(2);
  });
});

