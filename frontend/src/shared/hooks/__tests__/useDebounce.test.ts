import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import useDebounce from '../useDebounce';

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should return initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('initial', 500));

    expect(result.current).toBe('initial');
  });

  it('should debounce value changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'initial', delay: 500 },
      },
    );

    expect(result.current).toBe('initial');

    // Update the value
    rerender({ value: 'updated', delay: 500 });

    // Value should not change immediately
    expect(result.current).toBe('initial');

    // Fast-forward time by 500ms and run pending timers
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Now the value should be updated
    expect(result.current).toBe('updated');
  });

  it('should cancel previous debounce on rapid changes', async () => {
    const { result, rerender } = renderHook(
      ({ value, delay }) => useDebounce(value, delay),
      {
        initialProps: { value: 'first', delay: 500 },
      },
    );

    expect(result.current).toBe('first');

    // Update value multiple times rapidly
    rerender({ value: 'second', delay: 500 });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'third', delay: 500 });
    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    rerender({ value: 'fourth', delay: 500 });

    // Value should still be the initial value
    expect(result.current).toBe('first');

    // Fast-forward past the delay
    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    // Should only update to the last value
    expect(result.current).toBe('fourth');
  });

  it('should cleanup timeout on unmount', () => {
    const { unmount } = renderHook(() => useDebounce('test', 500));

    // Spy on clearTimeout
    const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout');

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalled();
  });
});
