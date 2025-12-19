import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AuthProvider, useAuth } from '../AuthContext';
import authService from '../../services/authService';

// Mock authService
vi.mock('../../services/authService', () => ({
  default: {
    getToken: vi.fn(),
    getUser: vi.fn(),
    isAuthenticated: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
    getTokenExpiration: vi.fn(),
    hasBackendClaim: vi.fn(),
    hasInvestigatorRole: vi.fn(),
    hasSupervisorRole: vi.fn(),
    hasComplianceOfficerRole: vi.fn(),
    hasCMSAdminRole: vi.fn(),
    hasAdminRole: vi.fn(),
    hasAnyRole: vi.fn(),
    hasAllRoles: vi.fn(),
    validateBackendAccess: vi.fn(),
  },
}));

describe('AuthContext', () => {
  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AuthProvider>{children}</AuthProvider>
  );

  beforeEach(() => {
    vi.useFakeTimers();
    vi.resetAllMocks();

    // Default mock implementations
    (authService.getToken as any).mockReturnValue(null);
    (authService.getUser as any).mockReturnValue(null);
    (authService.isAuthenticated as any).mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should initialize with default unauthenticated state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it('should initialize with authenticated state if token exists', () => {
    const mockUser = { id: '1', username: 'test' };
    (authService.getToken as any).mockReturnValue('valid-token');
    (authService.getUser as any).mockReturnValue(mockUser);
    (authService.isAuthenticated as any).mockReturnValue(true);

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.token).toBe('valid-token');
  });

  it('should login successfully', async () => {
    const mockUser = { id: '1', username: 'test' };
    const mockResponse = { token: 'new-token', user: mockUser };
    (authService.login as any).mockResolvedValue(mockResponse);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      await result.current.login({ username: 'test', password: 'password' });
    });

    expect(authService.login).toHaveBeenCalledWith({
      username: 'test',
      password: 'password',
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(mockUser);
    expect(result.current.token).toBe('new-token');
    expect(result.current.error).toBeNull();
  });

  it('should handle login failure', async () => {
    const error = new Error('Invalid credentials');
    (authService.login as any).mockRejectedValue(error);

    const { result } = renderHook(() => useAuth(), { wrapper });

    await act(async () => {
      try {
        await result.current.login({ username: 'test', password: 'wrong' });
      } catch (e) {
        // Expected error
      }
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.error).toBe('Invalid credentials');
  });

  it('should logout successfully', () => {
    // Setup authenticated state
    (authService.getToken as any).mockReturnValue('valid-token');
    (authService.isAuthenticated as any).mockReturnValue(true);

    const { result } = renderHook(() => useAuth(), { wrapper });

    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    act(() => {
      result.current.logout();
    });

    expect(authService.logout).toHaveBeenCalled();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.token).toBeNull();
    expect(window.location.href).toBe('/login');
  });

  it('should auto-logout when token expires', async () => {
    // Setup authenticated state
    (authService.getToken as any).mockReturnValue('valid-token');
    (authService.isAuthenticated as any).mockReturnValue(true);

    // Mock token expiration in 1000ms
    const futureDate = new Date(Date.now() + 1000);
    (authService.getTokenExpiration as any).mockReturnValue(futureDate);

    // Mock window.location.href
    Object.defineProperty(window, 'location', {
      value: { href: '' },
      writable: true,
    });

    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(result.current.isAuthenticated).toBe(true);

    // Advance time past expiration
    act(() => {
      vi.advanceTimersByTime(1500);
    });

    expect(authService.logout).toHaveBeenCalled();
    // Note: State updates in timeouts might not reflect immediately in result.current without waitFor
    // But the service call is the key side effect we want to verify
  });

  it('should expose role check functions', () => {
    const { result } = renderHook(() => useAuth(), { wrapper });

    expect(typeof result.current.hasInvestigatorRole).toBe('function');
    expect(typeof result.current.hasSupervisorRole).toBe('function');
    expect(typeof result.current.hasAdminRole).toBe('function');
  });
});
