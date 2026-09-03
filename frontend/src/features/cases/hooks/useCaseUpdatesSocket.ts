import { useEffect, useRef } from 'react';
import { io, type Socket } from 'socket.io-client';
import { useDebouncedCallback } from 'use-debounce';
import authService from '@/features/auth/services/authService';

const API_BASE_URL =
  (import.meta.env.VITE_API_BASE_URL as string | undefined) ??
  'http://127.0.0.1:3000';

// Matches the search-input debounce already used on this dashboard (useCaseDashboard.ts) -
// coalesces a burst of near-simultaneous case-changed events into a single refetch.
const DEBOUNCE_MS = 500;

interface CaseChangedPayload {
  caseId: number;
  type: 'created' | 'status-changed';
}

/**
 * Subscribes to the backend's CaseEventsGateway and calls `onChange` (debounced) whenever any
 * case in the current user's tenant is created or has its status changed by anyone - including
 * other users' sessions. The socket only ever carries a lightweight "something changed" signal,
 * never case data itself; `onChange` is expected to trigger a normal re-fetch through the
 * existing, already-authorized case-list endpoint.
 *
 * Fails open: if the socket can't connect (or the auth token is missing/expired), the dashboard
 * simply behaves as it does without this hook - no error is surfaced to the user. socket.io
 * retries transient disconnects (network blips, server restarts) on its own; the gateway
 * explicitly disconnects (rather than just letting the connection drop) when the token is
 * rejected or this user already has too many sockets open, so those cases are handled below by
 * disconnecting for good instead of retrying a connection that will only be rejected again.
 */
export function useCaseUpdatesSocket(onChange: () => void): void {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const debouncedOnChange = useDebouncedCallback(() => {
    onChangeRef.current();
  }, DEBOUNCE_MS);

  useEffect(() => {
    const token = authService.getToken();
    if (!token) {
      // Not logged in (or token not yet available) - nothing to connect for.
      return undefined;
    }

    const socket: Socket = io(API_BASE_URL, {
      auth: { token },
    });

    socket.on('case:changed', (_payload: CaseChangedPayload) => {
      debouncedOnChange();
    });

    // The gateway emits one of these right before it disconnects us on purpose (bad/expired
    // token, or too many sockets already open for this user) - stop here rather than letting
    // socket.io's default reconnection keep retrying with the same token/connection that will
    // just be rejected again.
    socket.on('auth_failed', () => {
      socket.disconnect();
    });
    socket.on('connection_limit_exceeded', () => {
      socket.disconnect();
    });

    return () => {
      debouncedOnChange.cancel();
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- token is read once per mount; a token refresh mid-session degrades gracefully to no live updates rather than reconnecting
  }, []);
}

export default useCaseUpdatesSocket;
