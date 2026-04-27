import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseFilters from '../CaseFilters';

const mockSuccess = vi.fn();
const mockError = vi.fn();

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ success: mockSuccess, error: mockError }),
}));

let mockIsComplianceOfficer = false;
vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: () => mockIsComplianceOfficer,
    user: { id: 1, username: 'test' },
    isAuthenticated: true,
  }),
}));

const mockGetFilters = vi.fn().mockResolvedValue([]);
const mockCreateFilter = vi.fn().mockResolvedValue({});
vi.mock('../../services/filterService', () => ({
  filterService: {
    getFilters: (...args: any[]) => mockGetFilters(...args),
    createFilter: (...args: any[]) => mockCreateFilter(...args),
  },
}));

vi.mock('../../../auth/services/authService', () => ({
  default: {
    getUser: () => ({ userId: 1, username: 'test' }),
  },
}));

describe('CaseFilters', () => {
  const defaultProps = {
    search: '',
    onSearchChange: vi.fn(),
    sortBy: 'recent' as const,
    onSortChange: vi.fn(),
    statusFilter: '',
    onStatusFilterChange: vi.fn(),
    priorityFilter: '',
    onPriorityFilterChange: vi.fn(),
    sarStrStatusFilter: '',
    onSarStrStatusFilterChange: vi.fn(),
    caseTypeFilter: 'all' as const,
    onCaseTypeFilterChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockIsComplianceOfficer = false;
    mockGetFilters.mockResolvedValue([]);
    mockCreateFilter.mockResolvedValue({});
  });

  it('should display search value', () => {
    render(<CaseFilters {...defaultProps} search="test search" />);
    const searchInput = screen.getByPlaceholderText('Search cases...');
    expect(searchInput).toHaveValue('test search');
  });

  it('should call onSearchChange when typing in search', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(<CaseFilters {...defaultProps} onSearchChange={onSearchChange} />);
    const searchInput = screen.getByPlaceholderText('Search cases...');
    await user.type(searchInput, 'test');
    expect(onSearchChange).toHaveBeenCalled();
    expect(onSearchChange.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('should render sort dropdown with correct value after opening filters', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} sortBy="oldest" />);
    await user.click(screen.getByText('Filters'));
    expect(screen.getByDisplayValue('Oldest First')).toBeInTheDocument();
  });

  it('should call onSortChange when sort is changed', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    render(<CaseFilters {...defaultProps} onSortChange={onSortChange} />);
    await user.click(screen.getByText('Filters'));
    const sortSelect = screen.getByDisplayValue('Most Recent');
    await user.selectOptions(sortSelect, 'oldest');
    expect(onSortChange).toHaveBeenCalledWith('oldest');
  });

  it('should render status filter options after opening filters', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} />);
    await user.click(screen.getByText('Filters'));
    expect(
      screen.getByRole('option', { name: 'All Statuses' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Draft' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'In Progress' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Suspended' }),
    ).toBeInTheDocument();
  });

  it('should call onStatusFilterChange when status is changed', async () => {
    const user = userEvent.setup();
    const onStatusFilterChange = vi.fn();
    render(
      <CaseFilters
        {...defaultProps}
        onStatusFilterChange={onStatusFilterChange}
      />,
    );
    await user.click(screen.getByText('Filters'));
    const statusSelect = screen.getByDisplayValue('All Statuses');
    await user.selectOptions(statusSelect, 'STATUS_20_IN_PROGRESS');
    expect(onStatusFilterChange).toHaveBeenCalledWith('STATUS_20_IN_PROGRESS');
  });

  it('should render priority filter options after opening filters', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} />);
    await user.click(screen.getByText('Filters'));
    expect(
      screen.getByRole('option', { name: 'All Priorities' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Urgent' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Critical' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Breach' })).toBeInTheDocument();
  });

  it('should call onPriorityFilterChange when priority is changed', async () => {
    const user = userEvent.setup();
    const onPriorityFilterChange = vi.fn();
    render(
      <CaseFilters
        {...defaultProps}
        onPriorityFilterChange={onPriorityFilterChange}
      />,
    );
    await user.click(screen.getByText('Filters'));
    const prioritySelect = screen.getByDisplayValue('All Priorities');
    await user.selectOptions(prioritySelect, 'CRITICAL');
    expect(onPriorityFilterChange).toHaveBeenCalledWith('CRITICAL');
  });

  it('should display selected status filter', async () => {
    const user = userEvent.setup();
    render(
      <CaseFilters {...defaultProps} statusFilter="STATUS_20_IN_PROGRESS" />,
    );
    await user.click(screen.getByText('Filters'));
    expect(screen.getByDisplayValue('In Progress')).toBeInTheDocument();
  });

  it('should display selected priority filter', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} priorityFilter="CRITICAL" />);
    await user.click(screen.getByText('Filters'));
    expect(screen.getByDisplayValue('Critical')).toBeInTheDocument();
  });

  it('should render search icon', () => {
    const { container } = render(<CaseFilters {...defaultProps} />);
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should have proper styling classes on search input', () => {
    render(<CaseFilters {...defaultProps} />);
    const searchInput = screen.getByPlaceholderText('Search cases...');
    expect(searchInput).toHaveClass('w-full', 'border', 'border-gray-300');
  });

  it('should clear search when empty string is typed', async () => {
    const user = userEvent.setup();
    const onSearchChange = vi.fn();
    render(
      <CaseFilters
        {...defaultProps}
        search="existing search"
        onSearchChange={onSearchChange}
      />,
    );
    const searchInput = screen.getByPlaceholderText('Search cases...');
    await user.clear(searchInput);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('should render case type filter dropdown', () => {
    render(<CaseFilters {...defaultProps} />);
    expect(
      screen.getByRole('option', { name: 'Open Cases' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Draft Cases' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Closed Cases' }),
    ).toBeInTheDocument();
  });

  it('should show Active badge and Clear button when filters are active', async () => {
    const user = userEvent.setup();
    render(
      <CaseFilters {...defaultProps} statusFilter="STATUS_20_IN_PROGRESS" />,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('should clear all filters when Clear button is clicked', async () => {
    const user = userEvent.setup();
    const onStatusFilterChange = vi.fn();
    const onPriorityFilterChange = vi.fn();
    const onSarStrStatusFilterChange = vi.fn();
    const onSortChange = vi.fn();
    const onCaseTypeFilterChange = vi.fn();
    render(
      <CaseFilters
        {...defaultProps}
        statusFilter="STATUS_20_IN_PROGRESS"
        onStatusFilterChange={onStatusFilterChange}
        onPriorityFilterChange={onPriorityFilterChange}
        onSarStrStatusFilterChange={onSarStrStatusFilterChange}
        onSortChange={onSortChange}
        onCaseTypeFilterChange={onCaseTypeFilterChange}
      />,
    );
    await user.click(screen.getByText('Clear'));
    expect(onStatusFilterChange).toHaveBeenCalledWith('');
    expect(onPriorityFilterChange).toHaveBeenCalledWith('');
    expect(onSarStrStatusFilterChange).toHaveBeenCalledWith('');
    expect(onSortChange).toHaveBeenCalledWith('recent');
    expect(onCaseTypeFilterChange).toHaveBeenCalledWith('all');
  });

  it('should call onCaseTypeFilterChange when case type is changed', async () => {
    const user = userEvent.setup();
    const onCaseTypeFilterChange = vi.fn();
    render(
      <CaseFilters
        {...defaultProps}
        onCaseTypeFilterChange={onCaseTypeFilterChange}
      />,
    );
    const select = screen.getByDisplayValue('Open Cases');
    await user.selectOptions(select, 'draft');
    expect(onCaseTypeFilterChange).toHaveBeenCalledWith('draft');
  });

  it('should clear statusFilter when caseTypeFilter switches to draft', () => {
    const onStatusFilterChange = vi.fn();
    render(
      <CaseFilters
        {...defaultProps}
        caseTypeFilter="draft"
        statusFilter="STATUS_20_IN_PROGRESS"
        onStatusFilterChange={onStatusFilterChange}
      />,
    );
    expect(onStatusFilterChange).toHaveBeenCalledWith('');
  });

  it('should clear statusFilter when closed filter has non-closed status selected', () => {
    const onStatusFilterChange = vi.fn();
    render(
      <CaseFilters
        {...defaultProps}
        caseTypeFilter="closed"
        statusFilter="STATUS_20_IN_PROGRESS"
        onStatusFilterChange={onStatusFilterChange}
      />,
    );
    expect(onStatusFilterChange).toHaveBeenCalledWith('');
  });

  it('should keep statusFilter when closed filter has a valid closed status', () => {
    const onStatusFilterChange = vi.fn();
    render(
      <CaseFilters
        {...defaultProps}
        caseTypeFilter="closed"
        statusFilter="STATUS_82_CLOSED_CONFIRMED"
        onStatusFilterChange={onStatusFilterChange}
      />,
    );
    expect(onStatusFilterChange).not.toHaveBeenCalled();
  });

  it('should only show closed statuses when caseTypeFilter is closed', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} caseTypeFilter="closed" />);
    await user.click(screen.getByText('Filters'));
    expect(
      screen.getByRole('option', { name: 'Closed - Confirmed' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Closed - Refuted' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'In Progress' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('option', { name: 'Draft' }),
    ).not.toBeInTheDocument();
  });

  it('should show SAR/STR Status filter for compliance officer role', async () => {
    mockIsComplianceOfficer = true;
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} />);
    await user.click(screen.getByText('Filters'));
    expect(screen.getByText('SAR/STR Status')).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'All SAR/STR Statuses' }),
    ).toBeInTheDocument();
  });

  it('should show disabled Closed Cases dropdown for compliance officer', () => {
    mockIsComplianceOfficer = true;
    render(<CaseFilters {...defaultProps} />);
    const closedOption = screen.getByRole('option', { name: 'Closed Cases' });
    expect(closedOption.closest('select')).toBeDisabled();
  });

  it('should call onSarStrStatusFilterChange for compliance officer', async () => {
    mockIsComplianceOfficer = true;
    const user = userEvent.setup();
    const onSarStrStatusFilterChange = vi.fn();
    render(
      <CaseFilters
        {...defaultProps}
        onSarStrStatusFilterChange={onSarStrStatusFilterChange}
      />,
    );
    await user.click(screen.getByText('Filters'));
    const sarSelect = screen.getByDisplayValue('All SAR/STR Statuses');
    await user.selectOptions(sarSelect, 'STATUS_20_IN_PROGRESS');
    expect(onSarStrStatusFilterChange).toHaveBeenCalledWith(
      'STATUS_20_IN_PROGRESS',
    );
  });

  it('should fetch and display saved filters', async () => {
    mockGetFilters.mockResolvedValue([
      {
        filter_Id: 1,
        user_filters: JSON.stringify({
          sortBy: 'recent',
          status: 'STATUS_20_IN_PROGRESS',
          priority: 'URGENT',
          sarStrStatus: '',
        }),
      },
    ]);
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} />);
    await user.click(screen.getByText('Filters'));
    await waitFor(() => {
      expect(
        screen.getByText('RECENT - STATUS_20_IN_PROGRESS - URGENT'),
      ).toBeInTheDocument();
    });
  });

  it('should apply saved filter when selected', async () => {
    mockGetFilters.mockResolvedValue([
      {
        filter_Id: 1,
        user_filters: JSON.stringify({
          sortBy: 'oldest',
          status: 'STATUS_20_IN_PROGRESS',
          priority: 'URGENT',
          sarStrStatus: '',
        }),
      },
    ]);
    const user = userEvent.setup();
    const onSortChange = vi.fn();
    const onStatusFilterChange = vi.fn();
    const onPriorityFilterChange = vi.fn();
    const onSarStrStatusFilterChange = vi.fn();
    render(
      <CaseFilters
        {...defaultProps}
        onSortChange={onSortChange}
        onStatusFilterChange={onStatusFilterChange}
        onPriorityFilterChange={onPriorityFilterChange}
        onSarStrStatusFilterChange={onSarStrStatusFilterChange}
      />,
    );
    await user.click(screen.getByText('Filters'));
    await waitFor(() => {
      expect(
        screen.getByText('OLDEST - STATUS_20_IN_PROGRESS - URGENT'),
      ).toBeInTheDocument();
    });
    const savedFilterSelect = screen.getByDisplayValue('Select a saved filter');
    await user.selectOptions(savedFilterSelect, '1');
    expect(onSortChange).toHaveBeenCalledWith('oldest');
    expect(onStatusFilterChange).toHaveBeenCalledWith('STATUS_20_IN_PROGRESS');
    expect(onPriorityFilterChange).toHaveBeenCalledWith('URGENT');
    expect(onSarStrStatusFilterChange).toHaveBeenCalledWith('');
  });

  it('should show "No saved filters available" when no filters exist', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} />);
    await user.click(screen.getByText('Filters'));
    await waitFor(() => {
      expect(
        screen.getByText('No saved filters available'),
      ).toBeInTheDocument();
    });
  });

  it('should save current filters and show success toast', async () => {
    const user = userEvent.setup();
    render(
      <CaseFilters {...defaultProps} statusFilter="STATUS_20_IN_PROGRESS" />,
    );
    await user.click(screen.getByText('Filters'));
    await user.click(screen.getByText('Save Current Filters'));
    await waitFor(() => {
      expect(mockCreateFilter).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 1,
          filterType: 'Case',
        }),
      );
      expect(mockSuccess).toHaveBeenCalledWith(
        'Filter Created',
        expect.any(String),
      );
    });
  });

  it('should show error toast for FILTER_ALREADY_EXISTS', async () => {
    mockCreateFilter.mockRejectedValue(new Error('FILTER_ALREADY_EXISTS'));
    const user = userEvent.setup();
    render(
      <CaseFilters {...defaultProps} statusFilter="STATUS_20_IN_PROGRESS" />,
    );
    await user.click(screen.getByText('Filters'));
    await user.click(screen.getByText('Save Current Filters'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Filter Already Exists',
        'A filter with the same criteria has already been saved.',
      );
    });
  });

  it('should show generic error toast on filter save failure', async () => {
    mockCreateFilter.mockRejectedValue(new Error('Network error'));
    const user = userEvent.setup();
    render(
      <CaseFilters {...defaultProps} statusFilter="STATUS_20_IN_PROGRESS" />,
    );
    await user.click(screen.getByText('Filters'));
    await user.click(screen.getByText('Save Current Filters'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Create Filter Failed',
        'Network error',
      );
    });
  });

  it('should handle fetchSavedFilters error gracefully', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockGetFilters.mockRejectedValue(new Error('fetch failed'));
    render(<CaseFilters {...defaultProps} />);
    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        'Failed to load saved filters',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  it('should show Active badge for non-recent sortBy', () => {
    render(<CaseFilters {...defaultProps} sortBy="oldest" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should show Active badge for priority filter', () => {
    render(<CaseFilters {...defaultProps} priorityFilter="URGENT" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should show Active badge for sarStrStatusFilter', () => {
    render(
      <CaseFilters {...defaultProps} sarStrStatusFilter="STATUS_10_ASSIGNED" />,
    );
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should show Active badge for non-all caseTypeFilter', () => {
    render(<CaseFilters {...defaultProps} caseTypeFilter="draft" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('should show Save Current Filters button only when filters are active', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} />);
    await user.click(screen.getByText('Filters'));
    expect(screen.queryByText('Save Current Filters')).not.toBeInTheDocument();
  });

  it('should toggle filter panel visibility', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} />);
    expect(screen.queryByText('Sort By')).not.toBeInTheDocument();
    await user.click(screen.getByText('Filters'));
    expect(screen.getByText('Sort By')).toBeInTheDocument();
    await user.click(screen.getByText('Filters'));
    expect(screen.queryByText('Sort By')).not.toBeInTheDocument();
  });

  it('should handle save filter with non-Error throw', async () => {
    mockCreateFilter.mockRejectedValue('string error');
    const user = userEvent.setup();
    render(
      <CaseFilters {...defaultProps} statusFilter="STATUS_20_IN_PROGRESS" />,
    );
    await user.click(screen.getByText('Filters'));
    await user.click(screen.getByText('Save Current Filters'));
    await waitFor(() => {
      expect(mockError).toHaveBeenCalledWith(
        'Create Filter Failed',
        'Failed to save filter',
      );
    });
  });
});
