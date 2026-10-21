import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useBlockedUserIds } from '../useBlockedUserIds';
import { investigatorService } from '../../services/investigatorService';

vi.mock('../../services/investigatorService');

describe('useBlockedUserIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (investigatorService.getBlockedUserIds as vi.Mock).mockResolvedValue([
      'user-a',
      'user-b',
    ]);
  });

  it('starts empty and fills with the blocked ids once fetched', async () => {
    const { result } = renderHook(() => useBlockedUserIds(42, true));

    expect(result.current.size).toBe(0);
    await waitFor(() => {
      expect(result.current.has('user-a')).toBe(true);
    });
    expect(result.current.has('user-b')).toBe(true);
    expect(investigatorService.getBlockedUserIds).toHaveBeenCalledWith(42);
  });

  it('does not fetch while disabled (modal closed)', () => {
    const { result } = renderHook(() => useBlockedUserIds(42, false));

    expect(investigatorService.getBlockedUserIds).not.toHaveBeenCalled();
    expect(result.current.size).toBe(0);
  });

  it('does not fetch without a case id', () => {
    renderHook(() => useBlockedUserIds(undefined, true));

    expect(investigatorService.getBlockedUserIds).not.toHaveBeenCalled();
  });

  it('empties again when the modal closes', async () => {
    const { result, rerender } = renderHook(
      ({ enabled }) => useBlockedUserIds(42, enabled),
      { initialProps: { enabled: true } },
    );
    await waitFor(() => {
      expect(result.current.size).toBe(2);
    });

    rerender({ enabled: false });

    await waitFor(() => {
      expect(result.current.size).toBe(0);
    });
  });

  it('refetches for a different case', async () => {
    const { rerender } = renderHook(
      ({ caseId }) => useBlockedUserIds(caseId, true),
      { initialProps: { caseId: 42 } },
    );
    rerender({ caseId: 43 });

    await waitFor(() => {
      expect(investigatorService.getBlockedUserIds).toHaveBeenCalledWith(43);
    });
  });
});
