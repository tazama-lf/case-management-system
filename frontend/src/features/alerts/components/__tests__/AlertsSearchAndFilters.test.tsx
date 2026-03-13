import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AlertsSearchAndFilters from '../AlertsSearchAndFilters';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ success: mockSuccess, error: mockError }),
}));

const mockGetFilters = vi.fn().mockResolvedValue([]);
const mockCreateFilter = vi.fn().mockResolvedValue({});
vi.mock('../../../cases/services/filterService', () => ({
  filterService: {
    getFilters: (...args: unknown[]) => mockGetFilters(...args),
    createFilter: (...args: unknown[]) => mockCreateFilter(...args),
  },
}));

const mockGetUser = vi.fn().mockReturnValue({ userId: 'user-1' });
vi.mock('../../../auth/services/authService', () => ({
  default: {
    getUser: () => mockGetUser(),
  },
}));

const baseFilters = {
  query: '',
  source: '',
  type: '',
  priority: '',
  timeRange: '',
};

const onFilterChange = vi.fn();
const onClearFilters = vi.fn();
const onCustomDateRangeChange = vi.fn();

const getSelectByLabel = (labelText: string): HTMLSelectElement => {
  const labels = document.querySelectorAll('label');
  for (const label of labels) {
    if (label.textContent?.trim() === labelText) {
      const select = label.parentElement?.querySelector('select');
      if (select) return select as HTMLSelectElement;
    }
  }
  throw new Error(`No select found for label "${labelText}"`);
};

const renderComponent = (overrides = {}, props: Record<string, unknown> = {}) =>
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
      {...props}
    />,
  );


describe('AlertsSearchAndFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFilters.mockResolvedValue([]);
    mockGetUser.mockReturnValue({ userId: 'user-1' });
  });

  it('renders search input, filters button', () => {
    renderComponent();
    expect(screen.getByPlaceholderText(/search by alert id/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /filters/i })).toBeInTheDocument();
  });

  it('does not show clear button when no active filters', () => {
    renderComponent();
    expect(screen.queryByRole('button', { name: /clear/i })).not.toBeInTheDocument();
  });

  /* ---------- active filters ---------- */

  it('shows active badge and clear button when filters are applied', async () => {
    const user = userEvent.setup();
    renderComponent({ priority: 'URGENT' });

    await user.click(screen.getByRole('button', { name: /filters/i }));
    expect(screen.getByText(/Active/i)).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /clear/i }));
    expect(onClearFilters).toHaveBeenCalled();
  });

  it('shows active badge for source filter', () => {
    renderComponent({ source: 'System A' });
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /clear/i })).toBeInTheDocument();
  });

  it('shows active badge for type filter', () => {
    renderComponent({ type: 'FRAUD' });
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
  });

  it('shows active badge for timeRange filter', () => {
    renderComponent({ timeRange: 'today' });
    expect(screen.getByText(/Active/i)).toBeInTheDocument();
  });

  /* ---------- query input ---------- */

  it('updates query filter on text input', () => {
    renderComponent();
    fireEvent.change(screen.getByPlaceholderText(/search by alert id/i), {
      target: { value: 'ALERT-1' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('query', 'ALERT-1');
  });

  /* ---------- filter dropdowns ---------- */

  it('opens filter panel and shows dropdowns', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole('button', { name: /filters/i }));

    expect(getSelectByLabel('Alert Type')).toBeInTheDocument();
    expect(getSelectByLabel('Priority')).toBeInTheDocument();
    expect(getSelectByLabel('Source')).toBeInTheDocument();
    expect(getSelectByLabel('Time Range')).toBeInTheDocument();
  });

  it('toggles filter panel on button click', async () => {
    const user = userEvent.setup();
    renderComponent();

    await user.click(screen.getByRole('button', { name: /filters/i }));
    expect(getSelectByLabel('Alert Type')).toBeInTheDocument();

    // Click again to close
    await user.click(screen.getByRole('button', { name: /filters/i }));
    expect(screen.queryByText('Alert Type', { selector: 'label' })).not.toBeInTheDocument();
  });

  it('changes alert type filter', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /filters/i }));

    fireEvent.change(getSelectByLabel('Alert Type'), {
      target: { value: 'FRAUD' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('type', 'FRAUD');
  });

  it('changes priority filter', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /filters/i }));

    fireEvent.change(getSelectByLabel('Priority'), {
      target: { value: 'URGENT' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('priority', 'URGENT');
  });

  it('changes source filter', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /filters/i }));

    fireEvent.change(getSelectByLabel('Source'), {
      target: { value: 'System A' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('source', 'System A');
  });

  /* ---------- time range & custom date ---------- */

  it('changes time range to non-custom value', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /filters/i }));

    fireEvent.change(getSelectByLabel('Time Range'), {
      target: { value: 'today' },
    });
    expect(onFilterChange).toHaveBeenCalledWith('timeRange', 'today');
    // custom date picker should NOT show
    expect(screen.queryByText('Start Date', { selector: 'label' })).not.toBeInTheDocument();
  });

  it('shows custom date pickers when custom range is selected', async () => {
    const { rerender } = renderComponent();

    await userEvent.click(screen.getByRole('button', { name: /filters/i }));
    fireEvent.change(getSelectByLabel('Time Range'), {
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

    const startInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    const endInput = document.querySelectorAll('input[type="date"]')[1] as HTMLInputElement;
    fireEvent.change(startInput, { target: { value: '2024-01-01' } });
    fireEvent.change(endInput, { target: { value: '2024-01-02' } });

    expect(onCustomDateRangeChange).toHaveBeenCalledTimes(2);
  });

  /* ---------- formatDisplayValue ---------- */

  it('renders formatted priority values in dropdown', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /filters/i }));

    // Priority options are formatted: "New", "Urgent"
    const prioritySelect = getSelectByLabel('Priority');
    const options = prioritySelect.querySelectorAll('option');
    const optTexts = Array.from(options).map((o) => o.textContent);
    expect(optTexts).toContain('New');
    expect(optTexts).toContain('Urgent');
  });

  /* ---------- default filter options ---------- */

  it('uses default filter options when none are provided', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <AlertsSearchAndFilters
        searchFilters={baseFilters}
        onFilterChange={onFilterChange}
        onClearFilters={onClearFilters}
        customDateRange={{ startDate: '', endDate: '' }}
        onCustomDateRangeChange={onCustomDateRangeChange}
      />,
    );
    await user.click(screen.getByRole('button', { name: /filters/i }));

    // Should use defaults: priorities=['NEW','URGENT','CRITICAL','BREACH']
    const prioritySelect = getSelectByLabel('Priority');
    const options = prioritySelect.querySelectorAll('option');
    expect(options.length).toBeGreaterThanOrEqual(5); // "All Priorities" + 4 defaults
  });

  /* ---------- saved filters ---------- */

  it('fetches saved filters on mount', async () => {
    renderComponent();
    await waitFor(() => {
      expect(mockGetFilters).toHaveBeenCalledWith('user-1', 'Alert');
    });
  });

  it('shows "No saved filters available" when no saved filters exist', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /filters/i }));

    await waitFor(() => {
      expect(screen.getByText(/No saved filters available/i)).toBeInTheDocument();
    });
  });

  it('renders saved filters in dropdown when they exist', async () => {
    mockGetFilters.mockResolvedValue([
      {
        filter_Id: 1,
        user_id: 'user-1',
        created_at: '2024-01-01',
        user_filters: JSON.stringify({
          alertType: 'FRAUD',
          priority: 'URGENT',
          source: 'System A',
          timeRange: 'today',
        }),
        filter_type: 'Alert',
        updated_at: '2024-01-01',
      },
    ]);

    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /filters/i }));

    await waitFor(() => {
      expect(screen.getByText(/Select a saved filter/i)).toBeInTheDocument();
    });
  });

  it('applies saved filter on selection', async () => {
    mockGetFilters.mockResolvedValue([
      {
        filter_Id: 42,
        user_id: 'user-1',
        created_at: '2024-01-01',
        user_filters: JSON.stringify({
          alertType: 'AML',
          priority: 'CRITICAL',
          source: 'System B',
          timeRange: 'today',
        }),
        filter_type: 'Alert',
        updated_at: '2024-01-01',
      },
    ]);

    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /filters/i }));

    await waitFor(() => {
      expect(screen.getByText(/Select a saved filter/i)).toBeInTheDocument();
    });

    fireEvent.change(screen.getByDisplayValue(/Select a saved filter/i), {
      target: { value: '42' },
    });

    expect(onFilterChange).toHaveBeenCalledWith('type', 'AML');
    expect(onFilterChange).toHaveBeenCalledWith('priority', 'CRITICAL');
    expect(onFilterChange).toHaveBeenCalledWith('source', 'System B');
  });

  it('does not apply filter if saved filter id not found', async () => {
    mockGetFilters.mockResolvedValue([
      {
        filter_Id: 1,
        user_id: 'user-1',
        created_at: '2024-01-01',
        user_filters: JSON.stringify({ alertType: 'FRAUD' }),
        filter_type: 'Alert',
        updated_at: '2024-01-01',
      },
    ]);

    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /filters/i }));

    await waitFor(() => {
      expect(screen.getByText(/Select a saved filter/i)).toBeInTheDocument();
    });

    // Select the default empty value (no matching filter)
    fireEvent.change(screen.getByDisplayValue(/Select a saved filter/i), {
      target: { value: '' },
    });

    // onFilterChange should NOT have been called with saved filter values
    expect(onFilterChange).not.toHaveBeenCalledWith('type', 'FRAUD');
  });

  /* ---------- save current filters ---------- */

  it('shows "Save Current Filters" button only when active filters exist', async () => {
    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /filters/i }));

    expect(screen.queryByRole('button', { name: /save current filters/i })).not.toBeInTheDocument();
  });

  it('shows "Save Current Filters" button when filters are active', async () => {
    const user = userEvent.setup();
    renderComponent({ priority: 'URGENT' });
    await user.click(screen.getByRole('button', { name: /filters/i }));

    expect(screen.getByRole('button', { name: /save current filters/i })).toBeInTheDocument();
  });

  it('saves current filters successfully', async () => {
    const user = userEvent.setup();
    renderComponent({ priority: 'URGENT', type: 'FRAUD' });
    await user.click(screen.getByRole('button', { name: /filters/i }));

    await user.click(screen.getByRole('button', { name: /save current filters/i }));

    await waitFor(() => {
      expect(mockCreateFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 'user-1',
          filterType: 'Alert',
        }),
      );
    });
    expect(mockSuccess).toHaveBeenCalledWith('Filter Created', expect.any(String));
  });

  it('shows error toast when saving filters fails', async () => {
    mockCreateFilter.mockRejectedValueOnce(new Error('Network failure'));

    const user = userEvent.setup();
    renderComponent({ priority: 'URGENT' });
    await user.click(screen.getByRole('button', { name: /filters/i }));

    await user.click(screen.getByRole('button', { name: /save current filters/i }));

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Create Filter Failed', 'Network failure');
    });
  });

  it('shows generic error message when non-Error is thrown during save', async () => {
    mockCreateFilter.mockRejectedValueOnce('something bad');

    const user = userEvent.setup();
    renderComponent({ priority: 'URGENT' });
    await user.click(screen.getByRole('button', { name: /filters/i }));

    await user.click(screen.getByRole('button', { name: /save current filters/i }));

    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith('Create Filter Failed', 'Failed to save filter');
    });
  });

  /* ---------- edge cases ---------- */

  it('skips fetchSavedFilters when no userId', async () => {
    mockGetUser.mockReturnValue(null);
    renderComponent();

    await waitFor(() => {
      expect(mockGetFilters).not.toHaveBeenCalled();
    });
  });

  it('handles fetchSavedFilters error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetFilters.mockRejectedValueOnce(new Error('fetch error'));

    renderComponent();

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalled();
    });
    consoleSpy.mockRestore();
  });

  it('parses saved filters with date parts', async () => {
    mockGetFilters.mockResolvedValue([
      {
        filter_Id: 10,
        user_id: 'user-1',
        created_at: '2024-01-01',
        user_filters: JSON.stringify({
          alertType: '',
          priority: '',
          source: '',
          timeRange: 'custom',
          startDate: '2024-01-01',
          endDate: '2024-02-01',
        }),
        filter_type: 'Alert',
        updated_at: '2024-01-01',
      },
    ]);

    const user = userEvent.setup();
    renderComponent();
    await user.click(screen.getByRole('button', { name: /filters/i }));

    await waitFor(() => {
      expect(screen.getByText(/Select a saved filter/i)).toBeInTheDocument();
    });
  });
});
