import { renderHook, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('@/shared/services/apiClient', () => ({ default: { get: vi.fn() } }));

import apiClient from '@/shared/services/apiClient';

// the hook remembers the answer for the page's lifetime, so each test loads a fresh copy of it
const freshHook = async () => (await import('../useCopilotFeatures')).useCopilotFeatures;

beforeEach(() => {
  vi.resetModules();
  vi.mocked(apiClient.get).mockReset();
});

describe('useCopilotFeatures', () => {
  it('starts with both features off, then follows what the backend reports for each', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ copilotInvestigation: true, copilotSar: false });
    const useCopilotFeatures = await freshHook();
    const { result } = renderHook(() => useCopilotFeatures());
    expect(result.current).toEqual({ investigation: false, sar: false });
    await waitFor(() => {
      expect(result.current).toEqual({ investigation: true, sar: false });
    });
    expect(apiClient.get).toHaveBeenCalledWith('/api/v1/features');
  });

  it('treats a failing or malformed answer as off', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('404'));
    const useCopilotFeatures = await freshHook();
    const { result } = renderHook(() => useCopilotFeatures());
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalled();
    });
    expect(result.current).toEqual({ investigation: false, sar: false });
  });

  it('asks again after a failure instead of remembering it', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('401')).mockResolvedValue({ copilotInvestigation: true, copilotSar: true });
    const useCopilotFeatures = await freshHook();
    const first = renderHook(() => useCopilotFeatures());
    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
    await new Promise((r) => setTimeout(r, 0)); // let the failure settle
    first.unmount();
    const second = renderHook(() => useCopilotFeatures());
    await waitFor(() => {
      expect(second.result.current).toEqual({ investigation: true, sar: true });
    });
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it('asks the backend only once however many components use it', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ copilotInvestigation: true, copilotSar: true });
    const useCopilotFeatures = await freshHook();
    const a = renderHook(() => useCopilotFeatures());
    const b = renderHook(() => useCopilotFeatures());
    await waitFor(() => {
      expect(a.result.current.sar).toBe(true);
      expect(b.result.current.sar).toBe(true);
    });
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });
});
