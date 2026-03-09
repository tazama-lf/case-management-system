import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import PaginationControls from '../PaginationControls';

describe('PaginationControls', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 10,
    itemsPerPage: 25,
    totalItems: 250,
    pageRange: [1, 2, 3, 4, 5],
    canGoNext: true,
    canGoPrevious: false,
    onPageChange: vi.fn(),
    onItemsPerPageChange: vi.fn(),
    onNext: vi.fn(),
    onPrevious: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders pagination controls', () => {
    render(<PaginationControls {...defaultProps} />);

    expect(screen.getByText(/Showing/i)).toBeInTheDocument();
    expect(screen.getByText(/250/)).toBeInTheDocument();
  });

  it('calculates and displays correct item range', () => {
    render(
      <PaginationControls
        {...defaultProps}
        currentPage={2}
        itemsPerPage={25}
      />,
    );

    const showingTexts = screen.getAllByText((content, element) => {
      const text = element?.textContent || '';
      return (
        text.includes('Showing') && text.includes('26') && text.includes('50')
      );
    });
    expect(showingTexts.length).toBeGreaterThan(0);
  });

  it('displays correct page numbers in range', () => {
    render(
      <PaginationControls {...defaultProps} pageRange={[1, 2, 3, 4, 5]} />,
    );

    const page1 = screen.getByRole('button', { name: '1' });
    const page2 = screen.getByRole('button', { name: '2' });
    const page3 = screen.getByRole('button', { name: '3' });
    expect(page1).toBeInTheDocument();
    expect(page2).toBeInTheDocument();
    expect(page3).toBeInTheDocument();
  });

  it('highlights current page', () => {
    render(
      <PaginationControls
        {...defaultProps}
        currentPage={3}
        pageRange={[1, 2, 3, 4, 5]}
      />,
    );

    const currentPageButton = screen.getByRole('button', { name: '3' });
    expect(currentPageButton).toHaveClass('bg-indigo-600', 'text-white');
  });

  it('calls onPageChange when page number is clicked', async () => {
    const user = userEvent.setup();
    const onPageChange = vi.fn();
    render(
      <PaginationControls {...defaultProps} onPageChange={onPageChange} />,
    );

    const pageButton = screen.getByRole('button', { name: '2' });
    await user.click(pageButton);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onNext when next button is clicked', async () => {
    const user = userEvent.setup();
    const onNext = vi.fn();
    render(
      <PaginationControls {...defaultProps} onNext={onNext} canGoNext={true} />,
    );

    const nextButtons = screen.getAllByRole('button', { name: /Next/i });
    await user.click(nextButtons[0]);

    expect(onNext).toHaveBeenCalledTimes(1);
  });

  it('calls onPrevious when previous button is clicked', async () => {
    const user = userEvent.setup();
    const onPrevious = vi.fn();
    render(
      <PaginationControls
        {...defaultProps}
        onPrevious={onPrevious}
        canGoPrevious={true}
        currentPage={2}
      />,
    );

    const prevButtons = screen.getAllByRole('button', { name: /Previous/i });
    await user.click(prevButtons[0]);

    expect(onPrevious).toHaveBeenCalledTimes(1);
  });

  it('disables next button when canGoNext is false', () => {
    render(<PaginationControls {...defaultProps} canGoNext={false} />);

    const nextButtons = screen.getAllByRole('button', { name: /Next/i });
    expect(nextButtons[0]).toBeDisabled();
  });

  it('disables previous button when canGoPrevious is false', () => {
    render(<PaginationControls {...defaultProps} canGoPrevious={false} />);

    const prevButtons = screen.getAllByRole('button', { name: /Previous/i });
    expect(prevButtons[0]).toBeDisabled();
  });

  it('calls onItemsPerPageChange when items per page is changed', async () => {
    const user = userEvent.setup();
    const onItemsPerPageChange = vi.fn();
    render(
      <PaginationControls
        {...defaultProps}
        onItemsPerPageChange={onItemsPerPageChange}
      />,
    );

    const select = screen.getByDisplayValue('25');
    await user.selectOptions(select, '50');

    expect(onItemsPerPageChange).toHaveBeenCalledWith(50);
  });

  it('uses custom itemsPerPageOptions', () => {
    render(
      <PaginationControls
        {...defaultProps}
        itemsPerPageOptions={[5, 10, 20]}
        itemsPerPage={5}
      />,
    );

    const select = screen.getByDisplayValue('5');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '5' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '10' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: '20' })).toBeInTheDocument();
  });

  it('returns null when totalItems is 0', () => {
    const { container } = render(
      <PaginationControls {...defaultProps} totalItems={0} />,
    );

    expect(container.firstChild).toBeNull();
  });

  it('displays mobile pagination controls', () => {
    render(<PaginationControls {...defaultProps} />);

    // Mobile controls should be visible
    expect(screen.getByText(/Page 1 of 10/i)).toBeInTheDocument();
  });

  it('displays correct mobile page info', () => {
    render(
      <PaginationControls {...defaultProps} currentPage={5} totalPages={10} />,
    );

    expect(screen.getByText(/Page 5 of 10/i)).toBeInTheDocument();
  });

  it('handles last page correctly', () => {
    render(
      <PaginationControls
        {...defaultProps}
        currentPage={10}
        totalPages={10}
        totalItems={250}
        itemsPerPage={25}
      />,
    );

    const showingTexts = screen.getAllByText((content, element) => {
      const text = element?.textContent || '';
      return (
        text.includes('Showing') && text.includes('226') && text.includes('250')
      );
    });
    expect(showingTexts.length).toBeGreaterThan(0);
  });

  it('handles single page correctly', () => {
    render(
      <PaginationControls
        {...defaultProps}
        currentPage={1}
        totalPages={1}
        totalItems={10}
        itemsPerPage={25}
      />,
    );

    expect(screen.getByText(/Page 1 of 1/i)).toBeInTheDocument();
    const showingTexts = screen.getAllByText((content, element) => {
      const text = element?.textContent || '';
      return (
        text.includes('Showing') &&
        text.includes('1') &&
        text.includes('10') &&
        text.includes('results')
      );
    });
    expect(showingTexts.length).toBeGreaterThan(0);
  });
});
