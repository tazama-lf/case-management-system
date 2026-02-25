import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CaseFilters from '../CaseFilters';

describe('CaseFilters', () => {
  const mockSetSearch = vi.fn();
  const mockSetSortBy = vi.fn();
  const mockSetStatusFilter = vi.fn();
  const mockSetPriorityFilter = vi.fn();

  const defaultProps = {
    search: '',
    setSearch: mockSetSearch,
    sortBy: 'recent' as const,
    setSortBy: mockSetSortBy,
    statusFilter: '',
    setStatusFilter: mockSetStatusFilter,
    priorityFilter: '',
    setPriorityFilter: mockSetPriorityFilter,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders all filter controls', () => {
    render(<CaseFilters {...defaultProps} />);

    expect(screen.getByLabelText(/Status filter/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Priority filter/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
  });

  it('updates search when user types', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} />);

    const searchInput = screen.getByPlaceholderText(/Search/i);
    await user.type(searchInput, 'test search');

    expect(mockSetSearch).toHaveBeenCalled();
  });

  it('updates status filter when changed', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} />);

    const statusFilter = screen.getByLabelText(/Status filter/i);
    await user.selectOptions(statusFilter, 'STATUS_20_IN_PROGRESS');

    expect(mockSetStatusFilter).toHaveBeenCalledWith('STATUS_20_IN_PROGRESS');
  });

  it('updates priority filter when changed', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} />);

    const priorityFilter = screen.getByLabelText(/Priority filter/i);
    await user.selectOptions(priorityFilter, 'URGENT');

    expect(mockSetPriorityFilter).toHaveBeenCalledWith('URGENT');
  });

  it('updates sort order when changed', async () => {
    const user = userEvent.setup();
    render(<CaseFilters {...defaultProps} />);

    const sortSelect = screen.getByLabelText(/Sort by/i);
    await user.selectOptions(sortSelect, 'oldest');

    expect(mockSetSortBy).toHaveBeenCalledWith('oldest');
  });

  it('displays current filter values', () => {
    render(
      <CaseFilters
        {...defaultProps}
        search="test"
        statusFilter="STATUS_20_IN_PROGRESS"
        priorityFilter="URGENT"
        sortBy="oldest"
      />,
    );

    expect(screen.getByDisplayValue('test')).toBeInTheDocument();
    // Check that the select elements have the correct values
    const statusSelect = screen.getByLabelText(
      /Status filter/i,
    ) as HTMLSelectElement;
    const prioritySelect = screen.getByLabelText(
      /Priority filter/i,
    ) as HTMLSelectElement;
    const sortSelect = screen.getByLabelText(/Sort by/i) as HTMLSelectElement;

    expect(statusSelect.value).toBe('STATUS_20_IN_PROGRESS');
    expect(prioritySelect.value).toBe('URGENT');
    expect(sortSelect.value).toBe('oldest');
  });
});
