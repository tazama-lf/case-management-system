import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import CaseFilters from '../CaseFilters';

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
  };

  it('should render search input', () => {
    render(<CaseFilters {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search cases...');
    expect(searchInput).toBeInTheDocument();
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

    // user.type() calls onChange for each character typed
    expect(onSearchChange).toHaveBeenCalled();
    // Verify it was called at least the number of characters typed
    expect(onSearchChange.mock.calls.length).toBeGreaterThanOrEqual(4);
  });

  it('should render sort dropdown with correct value', () => {
    render(<CaseFilters {...defaultProps} sortBy="oldest" />);

    const sortSelect = screen.getByDisplayValue('Oldest First');
    expect(sortSelect).toBeInTheDocument();
  });

  it('should call onSortChange when sort is changed', async () => {
    const user = userEvent.setup();
    const onSortChange = vi.fn();

    render(<CaseFilters {...defaultProps} onSortChange={onSortChange} />);

    const sortSelect = screen.getByDisplayValue('Most Recent');
    await user.selectOptions(sortSelect, 'oldest');

    expect(onSortChange).toHaveBeenCalledWith('oldest');
  });

  it('should render status filter with all options', () => {
    render(<CaseFilters {...defaultProps} />);

    expect(
      screen.getByRole('option', { name: 'All Statuses' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Draft' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Pending Creation Approval' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'In Progress' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Suspended' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Closed - Refuted' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Closed - Confirmed' }),
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

    const statusSelects = screen.getAllByRole('combobox');
    const statusSelect = statusSelects.find((select) =>
      select.querySelector('option[value="STATUS_00_DRAFT"]'),
    );

    await user.selectOptions(statusSelect!, 'STATUS_20_IN_PROGRESS');

    expect(onStatusFilterChange).toHaveBeenCalledWith('STATUS_20_IN_PROGRESS');
  });

  it('should render priority filter with all options', () => {
    render(<CaseFilters {...defaultProps} />);

    expect(
      screen.getByRole('option', { name: 'All Priorities' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Low' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Medium' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'High' })).toBeInTheDocument();
    expect(
      screen.getByRole('option', { name: 'Critical' }),
    ).toBeInTheDocument();
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

    const prioritySelects = screen.getAllByRole('combobox');
    const prioritySelect = prioritySelects.find((select) =>
      select.querySelector('option[value="CRITICAL"]'),
    );

    await user.selectOptions(prioritySelect!, 'HIGH');

    expect(onPriorityFilterChange).toHaveBeenCalledWith('HIGH');
  });

  it('should display selected status filter', () => {
    render(
      <CaseFilters {...defaultProps} statusFilter="STATUS_20_IN_PROGRESS" />,
    );

    const statusSelect = screen.getByDisplayValue('In Progress');
    expect(statusSelect).toBeInTheDocument();
  });

  it('should display selected priority filter', () => {
    render(<CaseFilters {...defaultProps} priorityFilter="HIGH" />);

    const prioritySelect = screen.getByDisplayValue('High');
    expect(prioritySelect).toBeInTheDocument();
  });

  it('should render search icon', () => {
    const { container } = render(<CaseFilters {...defaultProps} />);

    // MagnifyingGlassIcon should be rendered
    const icon = container.querySelector('svg');
    expect(icon).toBeInTheDocument();
  });

  it('should have proper styling classes on search input', () => {
    render(<CaseFilters {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText('Search cases...');
    expect(searchInput).toHaveClass('block', 'w-full', 'border-gray-300');
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
});
