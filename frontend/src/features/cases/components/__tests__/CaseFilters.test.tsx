import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import CaseFilters from '../CaseFilters';

vi.mock('@/shared/providers/ToastProvider', () => ({
  useToast: () => ({ success: vi.fn(), error: vi.fn() }),
}));

vi.mock('@/features/auth/components/AuthContext', () => ({
  useAuth: () => ({
    hasComplianceOfficerRole: () => false,
    user: { id: 1, username: 'test' },
    isAuthenticated: true,
  }),
}));

vi.mock('../../services/filterService', () => ({
  filterService: {
    getFilters: vi.fn().mockResolvedValue([]),
    createFilter: vi.fn().mockResolvedValue({}),
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
    expect(screen.getByRole('option', { name: 'All Statuses' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Draft' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'In Progress' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Suspended' })).toBeInTheDocument();
  });

  it('should call onStatusFilterChange when status is changed', async () => {
    const user = userEvent.setup();
    const onStatusFilterChange = vi.fn();
    render(<CaseFilters {...defaultProps} onStatusFilterChange={onStatusFilterChange} />);
    await user.click(screen.getByText('Filters'));
    const statusSelect = screen.getByDisplayValue('All Statuses');
    await user.selectOptions(statusSelect, 'STATUS_20_IN_PROGRESS');
    expect(onStatusFilterChange).toHaveBeenCalledWith('STATUS_20_IN_PROGRESS');
  });

  it('should render priority filter options after opening filters', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} />);
    await user.click(screen.getByText('Filters'));
    expect(screen.getByRole('option', { name: 'All Priorities' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'New' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Urgent' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Critical' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Breach' })).toBeInTheDocument();
  });

  it('should call onPriorityFilterChange when priority is changed', async () => {
    const user = userEvent.setup();
    const onPriorityFilterChange = vi.fn();
    render(<CaseFilters {...defaultProps} onPriorityFilterChange={onPriorityFilterChange} />);
    await user.click(screen.getByText('Filters'));
    const prioritySelect = screen.getByDisplayValue('All Priorities');
    await user.selectOptions(prioritySelect, 'CRITICAL');
    expect(onPriorityFilterChange).toHaveBeenCalledWith('CRITICAL');
  });

  it('should display selected status filter', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} statusFilter="STATUS_20_IN_PROGRESS" />);
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
    render(<CaseFilters {...defaultProps} search="existing search" onSearchChange={onSearchChange} />);
    const searchInput = screen.getByPlaceholderText('Search cases...');
    await user.clear(searchInput);
    expect(onSearchChange).toHaveBeenCalledWith('');
  });

  it('should render case type filter dropdown', () => {
    render(<CaseFilters {...defaultProps} />);
    expect(screen.getByRole('option', { name: 'Open Cases' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Draft Cases' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Closed Cases' })).toBeInTheDocument();
  });
});
