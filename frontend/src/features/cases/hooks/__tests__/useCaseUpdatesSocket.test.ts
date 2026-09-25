import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { io } from 'socket.io-client';
import authService from '@/features/auth/services/authService';
import { useCaseUpdatesSocket } from '../useCaseUpdatesSocket';

vi.mock('socket.io-client', () => ({ io: vi.fn() }));
vi.mock('@/features/auth/services/authService', () => ({
  default: { getToken: vi.fn() },
}));

const DEBOUNCE_MS = 500;

type Handler = (...args: unknown[]) => void;

// Minimal stand-in for a socket.io client socket: records handlers registered via `on` and lets
// the test fire server events at them.
const createFakeSocket = () => {
  const handlers = new Map<string, Handler[]>();
  return {
    on: vi.fn((event: string, handler: Handler) => {
      handlers.set(event, [...(handlers.get(event) ?? []), handler]);
    }),
    disconnect: vi.fn(),
    serverEmit(event: string, ...args: unknown[]) {
      (handlers.get(event) ?? []).forEach((handler) => handler(...args));
    },
  };
};

const caseChanged = { caseId: 1, type: 'status-changed' as const };

describe('useCaseUpdatesSocket - isReady gating', () => {
  let socket: ReturnType<typeof createFakeSocket>;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    socket = createFakeSocket();
    (io as unknown as vi.Mock).mockReturnValue(socket);
    (authService.getToken as vi.Mock).mockReturnValue('valid-token');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const flushDebounce = () => {
    act(() => {
      vi.advanceTimersByTime(DEBOUNCE_MS + 1);
    });
  };

  it('ignores case:changed events received before the server sends ready', () => {
    const onChange = vi.fn();
    renderHook(() => useCaseUpdatesSocket(onChange));

    act(() => {
      socket.serverEmit('case:changed', caseChanged);
    });
    flushDebounce();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('forwards case:changed events once the server has sent ready', () => {
    const onChange = vi.fn();
    renderHook(() => useCaseUpdatesSocket(onChange));

    act(() => {
      socket.serverEmit('ready');
      socket.serverEmit('case:changed', caseChanged);
    });
    flushDebounce();

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('does not replay events that arrived before ready', () => {
    const onChange = vi.fn();
    renderHook(() => useCaseUpdatesSocket(onChange));

    act(() => {
      socket.serverEmit('case:changed', caseChanged);
      socket.serverEmit('ready');
    });
    flushDebounce();

    expect(onChange).not.toHaveBeenCalled();
  });

  it('stops forwarding after disconnect until ready is received again', () => {
    const onChange = vi.fn();
    renderHook(() => useCaseUpdatesSocket(onChange));

    act(() => {
      socket.serverEmit('ready');
      socket.serverEmit('disconnect');
      socket.serverEmit('case:changed', caseChanged);
    });
    flushDebounce();
    expect(onChange).not.toHaveBeenCalled();

    // socket.io reconnected and the gateway re-authorized the socket.
    act(() => {
      socket.serverEmit('ready');
      socket.serverEmit('case:changed', caseChanged);
    });
    flushDebounce();
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
