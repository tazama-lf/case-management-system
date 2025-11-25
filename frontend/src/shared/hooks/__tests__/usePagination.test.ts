import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { usePagination } from '../usePagination';

describe('usePagination', () => {
  const mockData = Array.from({ length: 50 }, (_, i) => ({
    id: i + 1,
    name: `Item ${i + 1}`,
  }));

  it('should initialize with default values', () => {
    const { result } = renderHook(() =>
      usePagination({
        data: mockData,
        defaultItemsPerPage: 10,
      }),
    );

    expect(result.current.currentPage).toBe(1);
    expect(result.current.itemsPerPage).toBe(10);
    expect(result.current.totalPages).toBe(5);
    expect(result.current.paginatedData).toHaveLength(10);
    expect(result.current.canGoNext).toBe(true);
    expect(result.current.canGoPrevious).toBe(false);
  });

  it('should paginate data correctly', () => {
    const { result } = renderHook(() =>
      usePagination({
        data: mockData,
        defaultItemsPerPage: 10,
      }),
    );

    expect(result.current.paginatedData[0]).toEqual({ id: 1, name: 'Item 1' });
    expect(result.current.paginatedData[9]).toEqual({
      id: 10,
      name: 'Item 10',
    });
  });

  it('should navigate to next page', () => {
    const { result } = renderHook(() =>
      usePagination({
        data: mockData,
        defaultItemsPerPage: 10,
      }),
    );

    act(() => {
      result.current.goToNextPage();
    });

    expect(result.current.currentPage).toBe(2);
    expect(result.current.paginatedData[0]).toEqual({
      id: 11,
      name: 'Item 11',
    });
  });

  it('should navigate to previous page', () => {
    const { result } = renderHook(() =>
      usePagination({
        data: mockData,
        defaultItemsPerPage: 10,
      }),
    );

    act(() => {
      result.current.goToNextPage();
    });

    act(() => {
      result.current.goToNextPage();
    });

    expect(result.current.currentPage).toBe(3);

    act(() => {
      result.current.goToPreviousPage();
    });

    expect(result.current.currentPage).toBe(2);
  });

  it('should not go beyond last page', () => {
    const { result } = renderHook(() =>
      usePagination({
        data: mockData,
        defaultItemsPerPage: 10,
      }),
    );

    act(() => {
      result.current.goToLastPage();
    });

    expect(result.current.currentPage).toBe(5);
    expect(result.current.canGoNext).toBe(false);

    act(() => {
      result.current.goToNextPage();
    });

    expect(result.current.currentPage).toBe(5); // Should stay at 5
  });

  it('should not go before first page', () => {
    const { result } = renderHook(() =>
      usePagination({
        data: mockData,
        defaultItemsPerPage: 10,
      }),
    );

    expect(result.current.currentPage).toBe(1);
    expect(result.current.canGoPrevious).toBe(false);

    act(() => {
      result.current.goToPreviousPage();
    });

    expect(result.current.currentPage).toBe(1); // Should stay at 1
  });

  it('should go to first page', () => {
    const { result } = renderHook(() =>
      usePagination({
        data: mockData,
        defaultItemsPerPage: 10,
      }),
    );

    act(() => {
      result.current.setCurrentPage(3);
    });

    expect(result.current.currentPage).toBe(3);

    act(() => {
      result.current.goToFirstPage();
    });

    expect(result.current.currentPage).toBe(1);
  });

  it('should go to last page', () => {
    const { result } = renderHook(() =>
      usePagination({
        data: mockData,
        defaultItemsPerPage: 10,
      }),
    );

    act(() => {
      result.current.goToLastPage();
    });

    expect(result.current.currentPage).toBe(5);
    expect(result.current.paginatedData).toHaveLength(10);
  });

  it('should change items per page and reset to first page', () => {
    const { result } = renderHook(() =>
      usePagination({
        data: mockData,
        defaultItemsPerPage: 10,
      }),
    );

    act(() => {
      result.current.setCurrentPage(3);
    });

    expect(result.current.currentPage).toBe(3);

    act(() => {
      result.current.setItemsPerPage(20);
    });

    expect(result.current.itemsPerPage).toBe(20);
    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(3);
  });

  it('should calculate page range correctly', () => {
    const { result } = renderHook(() =>
      usePagination({
        data: Array.from({ length: 100 }, (_, i) => ({ id: i + 1 })),
        defaultItemsPerPage: 10,
      }),
    );

    // On first page, should show [1, 2, 3, 4, 5]
    expect(result.current.pageRange).toEqual([1, 2, 3, 4, 5]);

    // Navigate to middle page
    act(() => {
      result.current.setCurrentPage(5);
    });

    expect(result.current.pageRange).toEqual([3, 4, 5, 6, 7]);

    // Navigate to last page
    act(() => {
      result.current.goToLastPage();
    });

    expect(result.current.pageRange).toEqual([6, 7, 8, 9, 10]);
  });

  it('should handle empty data', () => {
    const { result } = renderHook(() =>
      usePagination({
        data: [],
        defaultItemsPerPage: 10,
      }),
    );

    expect(result.current.currentPage).toBe(1);
    expect(result.current.totalPages).toBe(0);
    expect(result.current.paginatedData).toHaveLength(0);
    expect(result.current.canGoNext).toBe(false);
    expect(result.current.canGoPrevious).toBe(false);
  });

  it('should handle data length less than items per page', () => {
    const smallData = [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ];

    const { result } = renderHook(() =>
      usePagination({
        data: smallData,
        defaultItemsPerPage: 10,
      }),
    );

    expect(result.current.totalPages).toBe(1);
    expect(result.current.paginatedData).toHaveLength(2);
    expect(result.current.canGoNext).toBe(false);
  });

  it('should set specific page number', () => {
    const { result } = renderHook(() =>
      usePagination({
        data: mockData,
        defaultItemsPerPage: 10,
      }),
    );

    act(() => {
      result.current.setCurrentPage(3);
    });

    expect(result.current.currentPage).toBe(3);
    expect(result.current.paginatedData[0]).toEqual({
      id: 21,
      name: 'Item 21',
    });
  });
});
