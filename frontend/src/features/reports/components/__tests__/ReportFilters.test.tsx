import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../test/mocks/server';

// Mock FiltersPanel BEFORE importing ReportFilters
vi.mock('../FiltersPanel', () => {
  return {
    default: ({
      caseType,
      priority,
      investigator,
      onChange,
      onApply,
      onReset,
    }: any) => (
      <div data-testid="filters-panel">
        <select
          data-testid="case-type-select"
          value={caseType}
          onChange={(e) => onChange('caseType', e.target.value)}
        >
          <option value="">All Types</option>
          <option value="FRAUD">Fraud</option>
        </select>
        <select
          data-testid="priority-select"
          value={priority}
          onChange={(e) => onChange('priority', e.target.value)}
        >
          <option value="">All Priorities</option>
          <option value="HIGH">High</option>
        </select>
        <select
          data-testid="investigator-select"
          value={investigator}
          onChange={(e) => onChange('investigator', e.target.value)}
        >
          <option value="">All Investigators</option>
          <option value="user-1">John Doe</option>
        </select>
        <button onClick={onApply} data-testid="apply-button">
          Apply Filters
        </button>
        <button onClick={onReset} data-testid="reset-button">
          Reset Filters
        </button>
      </div>
    ),
  };
});

import ReportFilters from '../ReportFilters';

// Setup MSW handler for filters endpoint
const mockFiltersData = {
  caseTypes: [
    { value: 'FRAUD', label: 'Fraud' },
    { value: 'MONEY_LAUNDERING', label: 'Money Laundering' },
  ],
  priorities: [
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
  ],
  investigators: [
    { value: 'user-1', label: 'John Doe' },
    { value: 'user-2', label: 'Jane Smith' },
  ],
};

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe('ReportFilters', () => {
  const mockOnChangeReportType = vi.fn();
  const mockOnChangeDateRange = vi.fn();
  const mockOnApplyFilters = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    // Setup MSW handler
    server.use(
      http.get('/api/v1/reports/filters', () => {
        return HttpResponse.json(mockFiltersData);
      }),
    );
  });

  it('renders report filters', () => {
    render(
      <ReportFilters
        reportType="CASE_STATUS"
        dateRange="last30"
        onChangeReportType={mockOnChangeReportType}
        onChangeDateRange={mockOnChangeDateRange}
        onApplyFilters={mockOnApplyFilters}
      />,
    );

    expect(screen.getByText('Case Status Report')).toBeInTheDocument();
    expect(screen.getByText('Last 30 Days')).toBeInTheDocument();
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('opens and closes report type menu', async () => {
    const user = userEvent.setup();
    render(
      <ReportFilters
        reportType="CASE_STATUS"
        dateRange="last30"
        onChangeReportType={mockOnChangeReportType}
        onChangeDateRange={mockOnChangeDateRange}
        onApplyFilters={mockOnApplyFilters}
      />,
    );

    const reportTypeButton = screen
      .getByText('Case Status Report')
      .closest('button');
    expect(reportTypeButton).toBeInTheDocument();

    await user.click(reportTypeButton!);

    await waitFor(() => {
      expect(screen.getByText('Audit Logs Report')).toBeInTheDocument();
    });

    // Click again to close
    await user.click(reportTypeButton!);

    await waitFor(() => {
      expect(screen.queryByText('Audit Logs Report')).not.toBeInTheDocument();
    });
  });

  it('opens and closes date range menu', async () => {
    const user = userEvent.setup();
    render(
      <ReportFilters
        reportType="CASE_STATUS"
        dateRange="last30"
        onChangeReportType={mockOnChangeReportType}
        onChangeDateRange={mockOnChangeDateRange}
        onApplyFilters={mockOnApplyFilters}
      />,
    );

    const dateRangeButton = screen.getByText('Last 30 Days').closest('button');
    expect(dateRangeButton).toBeInTheDocument();

    await user.click(dateRangeButton!);

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    // Click again to close
    await user.click(dateRangeButton!);

    await waitFor(() => {
      expect(screen.queryByText('Today')).not.toBeInTheDocument();
    });
  });

  it('calls onChangeReportType when report type is selected', async () => {
    const user = userEvent.setup();
    render(
      <ReportFilters
        reportType="CASE_STATUS"
        dateRange="last30"
        onChangeReportType={mockOnChangeReportType}
        onChangeDateRange={mockOnChangeDateRange}
        onApplyFilters={mockOnApplyFilters}
      />,
    );

    const reportTypeButton = screen
      .getByText('Case Status Report')
      .closest('button');
    await user.click(reportTypeButton!);

    await waitFor(() => {
      expect(screen.getByText('Audit Logs Report')).toBeInTheDocument();
    });

    const auditLogsOption = screen.getByText('Audit Logs Report');
    await user.click(auditLogsOption);

    expect(mockOnChangeReportType).toHaveBeenCalledWith('AUDIT_LOGS');
  });

  it('calls onChangeDateRange when date range is selected', async () => {
    const user = userEvent.setup();
    render(
      <ReportFilters
        reportType="CASE_STATUS"
        dateRange="last30"
        onChangeReportType={mockOnChangeReportType}
        onChangeDateRange={mockOnChangeDateRange}
        onApplyFilters={mockOnApplyFilters}
      />,
    );

    const dateRangeButton = screen.getByText('Last 30 Days').closest('button');
    await user.click(dateRangeButton!);

    await waitFor(() => {
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    const todayOption = screen.getByText('Today');
    await user.click(todayOption);

    expect(mockOnChangeDateRange).toHaveBeenCalledWith('today');
  });

  it('toggles filters panel', async () => {
    const user = userEvent.setup();
    render(
      <ReportFilters
        reportType="CASE_STATUS"
        dateRange="last30"
        onChangeReportType={mockOnChangeReportType}
        onChangeDateRange={mockOnChangeDateRange}
        onApplyFilters={mockOnApplyFilters}
      />,
      { wrapper: createWrapper() },
    );

    const filtersButton = screen.getByRole('button', { name: /Filters/i });
    await user.click(filtersButton);

    await waitFor(
      () => {
        expect(screen.getByTestId('filters-panel')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Click again to hide
    await user.click(filtersButton);

    await waitFor(() => {
      expect(screen.queryByTestId('filters-panel')).not.toBeInTheDocument();
    });
  });

  it('applies filters and closes panel', async () => {
    const user = userEvent.setup();
    render(
      <ReportFilters
        reportType="CASE_STATUS"
        dateRange="last30"
        onChangeReportType={mockOnChangeReportType}
        onChangeDateRange={mockOnChangeDateRange}
        onApplyFilters={mockOnApplyFilters}
      />,
      { wrapper: createWrapper() },
    );

    // Open filters panel
    const filtersButton = screen.getByRole('button', { name: /Filters/i });
    await user.click(filtersButton);

    await waitFor(
      () => {
        expect(screen.getByTestId('filters-panel')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Set filters
    const caseTypeSelect = screen.getByTestId('case-type-select');
    await user.selectOptions(caseTypeSelect, 'FRAUD');

    // Apply filters
    const applyButton = screen.getByTestId('apply-button');
    await user.click(applyButton);

    expect(mockOnApplyFilters).toHaveBeenCalledWith({
      caseType: 'FRAUD',
      priority: '',
      investigator: '',
    });

    // Panel should close
    await waitFor(() => {
      expect(screen.queryByTestId('filters-panel')).not.toBeInTheDocument();
    });
  });

  it('resets filters', async () => {
    const user = userEvent.setup();
    render(
      <ReportFilters
        reportType="CASE_STATUS"
        dateRange="last30"
        onChangeReportType={mockOnChangeReportType}
        onChangeDateRange={mockOnChangeDateRange}
        onApplyFilters={mockOnApplyFilters}
      />,
      { wrapper: createWrapper() },
    );

    // Open filters panel
    const filtersButton = screen.getByRole('button', { name: /Filters/i });
    await user.click(filtersButton);

    await waitFor(
      () => {
        expect(screen.getByTestId('filters-panel')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    // Set filters
    const caseTypeSelect = screen.getByTestId('case-type-select');
    await user.selectOptions(caseTypeSelect, 'FRAUD');

    // Reset filters
    const resetButton = screen.getByTestId('reset-button');
    await user.click(resetButton);

    // Filters should be reset
    expect(
      (screen.getByTestId('case-type-select') as HTMLSelectElement).value,
    ).toBe('');
  });

  it('closes one menu when opening another', async () => {
    const user = userEvent.setup();
    render(
      <ReportFilters
        reportType="CASE_STATUS"
        dateRange="last30"
        onChangeReportType={mockOnChangeReportType}
        onChangeDateRange={mockOnChangeDateRange}
        onApplyFilters={mockOnApplyFilters}
      />,
    );

    // Open report type menu
    const reportTypeButton = screen
      .getByText('Case Status Report')
      .closest('button');
    await user.click(reportTypeButton!);

    await waitFor(() => {
      expect(screen.getByText('Audit Logs Report')).toBeInTheDocument();
    });

    // Open date range menu (should close report type menu)
    const dateRangeButton = screen.getByText('Last 30 Days').closest('button');
    await user.click(dateRangeButton!);

    await waitFor(() => {
      expect(screen.queryByText('Audit Logs Report')).not.toBeInTheDocument();
      expect(screen.getByText('Today')).toBeInTheDocument();
    });
  });
});
