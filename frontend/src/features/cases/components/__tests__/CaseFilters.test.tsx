import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CaseFilters from '../CaseFilters';

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ success: mockSuccess, error: mockError }),
}));

const mockHasComplianceOfficerRole = vi.fn().mockReturnValue(false);
vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: mockHasComplianceOfficerRole,
  }),
}));

const mockGetFilters = vi.fn().mockResolvedValue([]);
const mockCreateFilter = vi.fn().mockResolvedValue({});
vi.mock('../../services/filterService', () => ({
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

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

interface RenderProps {
  search?: string;
  onSearchChange?: ReturnType<typeof vi.fn>;
  sortBy?: 'recent' | 'oldest';
  onSortChange?: ReturnType<typeof vi.fn>;
  statusFilter?: string;
  onStatusFilterChange?: ReturnType<typeof vi.fn>;
  priorityFilter?: string;
  onPriorityFilterChange?: ReturnType<typeof vi.fn>;
  sarStrStatusFilter?: string;
  onSarStrStatusFilterChange?: ReturnType<typeof vi.fn>;
  caseTypeFilter?: 'all' | 'draft' | 'closed';
  onCaseTypeFilterChange?: ReturnType<typeof vi.fn>;
}

const defaultProps = (): Required<RenderProps> => ({
  search: '',
  onSearchChange: vi.fn(),
  sortBy: 'recent',
  onSortChange: vi.fn(),
  statusFilter: '',
  onStatusFilterChange: vi.fn(),
  priorityFilter: '',
  onPriorityFilterChange: vi.fn(),
  sarStrStatusFilter: '',
  onSarStrStatusFilterChange: vi.fn(),
  caseTypeFilter: 'all',
  onCaseTypeFilterChange: vi.fn(),
});

function renderFilters(overrides: RenderProps = {}) {
  const props = { ...defaultProps(), ...overrides };
  return { ...render(<CaseFilters {...props} />), props };
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */

describe('CaseFilters', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockHasComplianceOfficerRole.mockReturnValue(false);
    mockGetFilters.mockResolvedValue([]);
    mockGetUser.mockReturnValue({ userId: 'user-1' });
  });

  /* ---------- Rendering ---------------------------------------- */

  it('renders search input', () => {
    renderFilters();
    expect(screen.getByPlaceholderText('Search cases...')).toBeInTheDocument();
  });

  it('renders case type dropdown with three options', () => {
    renderFilters();
    const options = screen.getAllByRole('option');
    expect(options.some((o) => o.textContent === 'All Cases')).toBe(true);
    expect(options.some((o) => o.textContent === 'Draft Cases')).toBe(true);
    expect(options.some((o) => o.textContent === 'Closed Cases')).toBe(true);
  });

  it('renders Filters button', () => {
    renderFilters();
    expect(screen.getByText('Filters')).toBeInTheDocument();
  });

  it('does not render the filter panel initially', () => {
    renderFilters();
    expect(screen.queryByText('Sort By')).not.toBeInTheDocument();
  });

  /* ---------- Search ------------------------------------------- */

  it('displays current search value', () => {
    renderFilters({ search: 'hello' });
    expect(screen.getByPlaceholderText('Search cases...')).toHaveValue('hello');
  });

  it('calls onSearchChange when typing', async () => {
    const user = userEvent.setup();
    const { props } = renderFilters();
    const input = screen.getByPlaceholderText('Search cases...');
    await user.type(input, 'test');
    expect(props.onSearchChange).toHaveBeenCalled();
  });

  /* ---------- Case Type Filter --------------------------------- */

  it('calls onCaseTypeFilterChange when selecting a case type', async () => {
    const user = userEvent.setup();
    const { props } = renderFilters();
    const select = screen.getByDisplayValue('All Cases');
    await user.selectOptions(select, 'draft');
    expect(props.onCaseTypeFilterChange).toHaveBeenCalledWith('draft');
  });

  /* ---------- Filter Panel Toggle ------------------------------ */

  it('shows filter panel when Filters button is clicked', async () => {
    const user = userEvent.setup();
    renderFilters();
    await user.click(screen.getByText('Filters'));
    expect(screen.getByText('Sort By')).toBeInTheDocument();
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Priority')).toBeInTheDocument();
  });

  it('hides filter panel when Filters button is clicked again', async () => {
    const user = userEvent.setup();
    renderFilters();
    const btn = screen.getByText('Filters');
    await user.click(btn);
    expect(screen.getByText('Sort By')).toBeInTheDocument();
    await user.click(btn);
    expect(screen.queryByText('Sort By')).not.toBeInTheDocument();
  });

  /* ---------- Sort --------------------------------------------- */

  it('calls onSortChange when selecting a sort option', async () => {
    const user = userEvent.setup();
    const { props } = renderFilters();
    await user.click(screen.getByText('Filters'));
    const sortSelect = screen.getByDisplayValue('Most Recent');
    await user.selectOptions(sortSelect, 'oldest');
    expect(props.onSortChange).toHaveBeenCalledWith('oldest');
  });

  /* ---------- Status Filter ------------------------------------ */

  it('renders all status options for non-compliance officer', async () => {
    const user = userEvent.setup();
    renderFilters();
    await user.click(screen.getByText('Filters'));
    expect(screen.getByText('All Statuses')).toBeInTheDocument();
    expect(screen.getByText('Abandoned')).toBeInTheDocument();
    expect(screen.getByText('Assigned')).toBeInTheDocument();
    expect(screen.getByText('Draft')).toBeInTheDocument();
    expect(screen.getByText('In Progress')).toBeInTheDocument();
    expect(screen.getByText('Pending Creation Approval')).toBeInTheDocument();
    expect(screen.getByText('Suspended')).toBeInTheDocument();
  });

  it('calls onStatusFilterChange on status selection', async () => {
    const user = userEvent.setup();
    const { props } = renderFilters();
    await user.click(screen.getByText('Filters'));
    const statusSelect = screen.getByDisplayValue('All Statuses');
    await user.selectOptions(statusSelect, 'STATUS_10_ASSIGNED');
    expect(props.onStatusFilterChange).toHaveBeenCalledWith(
      'STATUS_10_ASSIGNED',
    );
  });

  it('filters status options when caseTypeFilter is closed', async () => {
    const user = userEvent.setup();
    renderFilters({ caseTypeFilter: 'closed' });
    await user.click(screen.getByText('Filters'));
    expect(screen.getByText('All Statuses')).toBeInTheDocument();
    expect(screen.getByText('Closed - Confirmed')).toBeInTheDocument();
    expect(screen.getByText('Closed - Inconclusive')).toBeInTheDocument();
    expect(screen.getByText('Closed - Refuted')).toBeInTheDocument();
    expect(screen.queryByText('Draft')).not.toBeInTheDocument();
    expect(screen.queryByText('In Progress')).not.toBeInTheDocument();
  });

  it('disables status select when caseTypeFilter is draft', async () => {
    const user = userEvent.setup();
    renderFilters({ caseTypeFilter: 'draft' });
    await user.click(screen.getByText('Filters'));
    const statusSelect = screen.getByDisplayValue('All Statuses');
    expect(statusSelect).toBeDisabled();
  });

  it('clears statusFilter when switching to draft', () => {
    const onStatusFilterChange = vi.fn();
    renderFilters({
      caseTypeFilter: 'draft',
      statusFilter: 'STATUS_10_ASSIGNED',
      onStatusFilterChange,
    });
    expect(onStatusFilterChange).toHaveBeenCalledWith('');
  });

  it('clears non-closed status when switching to closed caseType', () => {
    const onStatusFilterChange = vi.fn();
    renderFilters({
      caseTypeFilter: 'closed',
      statusFilter: 'STATUS_10_ASSIGNED', // not a closed status
      onStatusFilterChange,
    });
    expect(onStatusFilterChange).toHaveBeenCalledWith('');
  });

  it('keeps closed status when switching to closed caseType', () => {
    const onStatusFilterChange = vi.fn();
    renderFilters({
      caseTypeFilter: 'closed',
      statusFilter: 'STATUS_82_CLOSED_CONFIRMED',
      onStatusFilterChange,
    });
    expect(onStatusFilterChange).not.toHaveBeenCalled();
  });

  /* ---------- Priority Filter ---------------------------------- */

  it('renders priority options', async () => {
    const user = userEvent.setup();
    renderFilters();
    await user.click(screen.getByText('Filters'));
    expect(screen.getByText('All Priorities')).toBeInTheDocument();
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(screen.getByText('Urgent')).toBeInTheDocument();
    expect(screen.getByText('Critical')).toBeInTheDocument();
    expect(screen.getByText('Breach')).toBeInTheDocument();
  });

  it('calls onPriorityFilterChange on priority selection', async () => {
    const user = userEvent.setup();
    const { props } = renderFilters();
    await user.click(screen.getByText('Filters'));
    const prioritySelect = screen.getByDisplayValue('All Priorities');
    await user.selectOptions(prioritySelect, 'URGENT');
    expect(props.onPriorityFilterChange).toHaveBeenCalledWith('URGENT');
  });

  /* ---------- Compliance Officer (SAR/STR) --------------------- */

  it('shows SAR/STR Status instead of Status for compliance officer', async () => {
    mockHasComplianceOfficerRole.mockReturnValue(true);
    const user = userEvent.setup();
    renderFilters();
    await user.click(screen.getByText('Filters'));
    expect(screen.getByText('SAR/STR Status')).toBeInTheDocument();
    expect(screen.queryByText('Status')).not.toBeInTheDocument();
  });

  it('renders SAR/STR status options for compliance officer', async () => {
    mockHasComplianceOfficerRole.mockReturnValue(true);
    const user = userEvent.setup();
    renderFilters();
    await user.click(screen.getByText('Filters'));
    expect(screen.getByText('All SAR/STR Statuses')).toBeInTheDocument();
    expect(screen.getByText('Unassigned')).toBeInTheDocument();
    expect(screen.getByText('Completed')).toBeInTheDocument();
    expect(screen.getByText('No SAR/STR Task')).toBeInTheDocument();
  });

  it('calls onSarStrStatusFilterChange when selecting SAR/STR status', async () => {
    mockHasComplianceOfficerRole.mockReturnValue(true);
    const user = userEvent.setup();
    const { props } = renderFilters();
    await user.click(screen.getByText('Filters'));
    const sarSelect = screen.getByDisplayValue('All SAR/STR Statuses');
    await user.selectOptions(sarSelect, 'STATUS_30_COMPLETED');
    expect(props.onSarStrStatusFilterChange).toHaveBeenCalledWith(
      'STATUS_30_COMPLETED',
    );
  });

  /* ---------- Active Filters Badge & Clear --------------------- */

  it('shows Active badge when filters are active', () => {
    renderFilters({ statusFilter: 'STATUS_10_ASSIGNED' });
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Active badge when sortBy is oldest', () => {
    renderFilters({ sortBy: 'oldest' });
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Active badge when caseTypeFilter is not all', () => {
    renderFilters({ caseTypeFilter: 'draft' });
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Active badge when priorityFilter is set', () => {
    renderFilters({ priorityFilter: 'URGENT' });
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('shows Active badge when sarStrStatusFilter is set', () => {
    renderFilters({ sarStrStatusFilter: 'STATUS_01_UNASSIGNED' });
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('does not show Active badge when no filters are active', () => {
    renderFilters();
    expect(screen.queryByText('Active')).not.toBeInTheDocument();
  });

  it('renders Clear button when filters are active', () => {
    renderFilters({ statusFilter: 'STATUS_10_ASSIGNED' });
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('does not render Clear button when no filters are active', () => {
    renderFilters();
    expect(screen.queryByText('Clear')).not.toBeInTheDocument();
  });

  it('clears all filters when Clear is clicked', async () => {
    const user = userEvent.setup();
    const { props } = renderFilters({ statusFilter: 'STATUS_10_ASSIGNED' });
    await user.click(screen.getByText('Clear'));
    expect(props.onStatusFilterChange).toHaveBeenCalledWith('');
    expect(props.onPriorityFilterChange).toHaveBeenCalledWith('');
    expect(props.onSarStrStatusFilterChange).toHaveBeenCalledWith('');
    expect(props.onSortChange).toHaveBeenCalledWith('recent');
    expect(props.onCaseTypeFilterChange).toHaveBeenCalledWith('all');
  });

  /* ---------- Saved Filters ------------------------------------ */

  it('shows "No saved filters available" when there are none', async () => {
    const user = userEvent.setup();
    renderFilters();
    await user.click(screen.getByText('Filters'));
    await waitFor(() => {
      expect(screen.getByText('No saved filters available')).toBeInTheDocument();
    });
  });

  it('fetches saved filters on mount', async () => {
    renderFilters();
    await waitFor(() => {
      expect(mockGetFilters).toHaveBeenCalledWith('user-1', 'Case');
    });
  });

  it('does not fetch filters when user is not logged in', async () => {
    mockGetUser.mockReturnValue(null);
    renderFilters();
    await waitFor(() => {
      expect(mockGetFilters).not.toHaveBeenCalled();
    });
  });

  it('renders saved filters in dropdown', async () => {
    mockGetFilters.mockResolvedValue([
      {
        filter_Id: 1,
        user_filters: JSON.stringify({
          status: 'STATUS_10_ASSIGNED',
          priority: 'URGENT',
          sortBy: 'recent',
          sarStrStatus: '',
        }),
      },
    ]);
    const user = userEvent.setup();
    renderFilters();
    await user.click(screen.getByText('Filters'));
    await waitFor(() => {
      expect(
        screen.getByText('RECENT - STATUS_10_ASSIGNED - URGENT'),
      ).toBeInTheDocument();
    });
  });

  it('applies saved filter when selected', async () => {
    mockGetFilters.mockResolvedValue([
      {
        filter_Id: 1,
        user_filters: JSON.stringify({
          status: 'STATUS_10_ASSIGNED',
          priority: 'URGENT',
          sortBy: 'oldest',
          sarStrStatus: '',
        }),
      },
    ]);
    const user = userEvent.setup();
    const { props } = renderFilters();
    await user.click(screen.getByText('Filters'));
    await waitFor(() => {
      expect(
        screen.getByText('OLDEST - STATUS_10_ASSIGNED - URGENT'),
      ).toBeInTheDocument();
    });
    const savedSelect = screen.getByDisplayValue('Select a saved filter');
    await user.selectOptions(savedSelect, '1');
    expect(props.onStatusFilterChange).toHaveBeenCalledWith(
      'STATUS_10_ASSIGNED',
    );
    expect(props.onPriorityFilterChange).toHaveBeenCalledWith('URGENT');
    expect(props.onSortChange).toHaveBeenCalledWith('oldest');
    expect(props.onSarStrStatusFilterChange).toHaveBeenCalledWith('');
  });

  /* ---------- Save Current Filters ----------------------------- */

  it('shows Save Current Filters button only when filters are active and panel is open', async () => {
    const user = userEvent.setup();
    renderFilters({ priorityFilter: 'URGENT' });
    await user.click(screen.getByText('Filters'));
    expect(screen.getByText('Save Current Filters')).toBeInTheDocument();
  });

  it('does not show Save Current Filters button when no filters active', async () => {
    const user = userEvent.setup();
    renderFilters();
    await user.click(screen.getByText('Filters'));
    expect(
      screen.queryByText('Save Current Filters'),
    ).not.toBeInTheDocument();
  });

  it('saves current filters and shows success toast', async () => {
    mockCreateFilter.mockResolvedValue({});
    const user = userEvent.setup();
    renderFilters({
      statusFilter: 'STATUS_10_ASSIGNED',
      priorityFilter: 'URGENT',
      sortBy: 'recent',
      sarStrStatusFilter: '',
    });
    await user.click(screen.getByText('Filters'));
    await user.click(screen.getByText('Save Current Filters'));
    await waitFor(() => {
      expect(mockCreateFilter).toHaveBeenCalledWith({
        user_id: 'user-1',
        filterType: 'Case',
        userFilters: JSON.stringify({
          status: 'STATUS_10_ASSIGNED',
          priority: 'URGENT',
          sortBy: 'recent',
          sarStrStatus: '',
        }),
      });
    });
    await waitFor(() => {
      expect(mockSuccess).toHaveBeenCalled();
    });
  });

  it('shows error toast when saving fails with FILTER_ALREADY_EXISTS', async () => {
    mockCreateFilter.mockRejectedValue(
      new Error('FILTER_ALREADY_EXISTS'),
    );
    const user = userEvent.setup();
    renderFilters({ priorityFilter: 'URGENT' });
    await user.click(screen.getByText('Filters'));
    await user.click(screen.getByText('Save Current Filters'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Filter Already Exists',
        'A filter with the same criteria has already been saved.',
      );
    });
  });

  it('shows generic error toast when save fails with unknown error', async () => {
    mockCreateFilter.mockRejectedValue(new Error('Network timeout'));
    const user = userEvent.setup();
    renderFilters({ priorityFilter: 'URGENT' });
    await user.click(screen.getByText('Filters'));
    await user.click(screen.getByText('Save Current Filters'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Create Filter Failed',
        'Network timeout',
      );
    });
  });

  it('shows fallback error message when save fails with non-Error', async () => {
    mockCreateFilter.mockRejectedValue('string-error');
    const user = userEvent.setup();
    renderFilters({ priorityFilter: 'URGENT' });
    await user.click(screen.getByText('Filters'));
    await user.click(screen.getByText('Save Current Filters'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Create Filter Failed',
        'Failed to save filter',
      );
    });
  });

  /* ---------- fetchSavedFilters error handling ----------------- */

  it('handles fetchSavedFilters failure gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetFilters.mockRejectedValue(new Error('fetch failed'));
    renderFilters();
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load saved filters',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });
});
