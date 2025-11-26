import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { LoginCredentials, User, LoginResponse, Investigator } from '../../types/auth.types';
import { server } from '@/test/mocks/server';
import { http, HttpResponse } from 'msw';
import authService from '../authService';

// No longer needed - using MSW handlers instead

describe('authService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    // Reset environment variable
    vi.stubEnv('VITE_API_BASE_URL', 'http://127.0.0.1:3000');
    // Reset MSW handlers
    server.resetHandlers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    server.resetHandlers();
  });

  describe('login', () => {
    it('successfully logs in and stores token', async () => {
      const mockToken = 'mock-jwt-token';
      const mockUser: User = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test Tenant',
        validatedClaims: {},
      };

      server.use(
        http.post('*/v1/auth/login', () => {
          return HttpResponse.json({
            message: 'Login successful',
            token: mockToken,
          });
        }),
        http.get('*/v1/auth/me', () => {
          return HttpResponse.json({
            clientId: 'user-1',
            tenantId: 'tenant-1',
            email: 'test@test.com',
            fullName: 'Test User',
            tenantName: 'Test Tenant',
            validatedClaims: {},
          });
        }),
      );

      const credentials: LoginCredentials = {
        username: 'test-user',
        password: 'password123',
      };

      const response = await authService.login(credentials);

      expect(response.token).toBe(mockToken);
      expect(localStorage.getItem('authToken')).toBe(mockToken);
    });

    it('throws error on invalid credentials', async () => {
      server.use(
        http.post('*/v1/auth/login', () => {
          return HttpResponse.json(
            { error: 'Invalid credentials' },
            { status: 401 },
          );
        }),
      );

      const credentials: LoginCredentials = {
        username: 'wrong-user',
        password: 'wrong-password',
      };

      await expect(authService.login(credentials)).rejects.toThrow(
        'Invalid credentials',
      );
    });

    it('handles fetch user profile failure gracefully', async () => {
      const mockToken = 'mock-jwt-token';
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      
      server.use(
        http.post('*/v1/auth/login', () => {
          return HttpResponse.json({
            message: 'Login successful',
            token: mockToken,
          });
        }),
        http.get('*/v1/auth/me', () => {
          return HttpResponse.json(
            { error: 'Failed to fetch user profile' },
            { status: 500 },
          );
        }),
      );

      const credentials: LoginCredentials = {
        username: 'test-user',
        password: 'password123',
      };

      const response = await authService.login(credentials);

      expect(response.token).toBe(mockToken);
      // fetchUserProfile catches errors and logs with console.error, then returns null
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        'Error fetching user profile:',
        expect.any(Error),
      );
      consoleErrorSpy.mockRestore();
    });
  });

  describe('fetchUserProfile', () => {
    it('fetches user profile successfully', async () => {
      const mockToken = 'mock-jwt-token';
      localStorage.setItem('authToken', mockToken);

      const mockUserData = {
        clientId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test Tenant',
        validatedClaims: { CMS_INVESTIGATOR: true },
      };

      server.use(
        http.get('*/v1/auth/me', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          if (authHeader === `Bearer ${mockToken}`) {
            return HttpResponse.json(mockUserData);
          }
          return HttpResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }),
      );

      const user = await authService.fetchUserProfile();

      expect(user).toEqual({
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test Tenant',
        validatedClaims: { CMS_INVESTIGATOR: true },
      });
    });

    it('returns null when no token is available', async () => {
      localStorage.removeItem('authToken');

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = await authService.fetchUserProfile();

      expect(user).toBeNull();
      consoleErrorSpy.mockRestore();
    });

    it('handles fetch failure and returns null', async () => {
      const mockToken = 'mock-jwt-token';
      localStorage.setItem('authToken', mockToken);

      server.use(
        http.get('*/v1/auth/me', () => {
          return HttpResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
          );
        }),
      );

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const user = await authService.fetchUserProfile();

      expect(user).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('logout', () => {
    it('removes token and user from localStorage', () => {
      localStorage.setItem('authToken', 'token');
      localStorage.setItem('user', JSON.stringify({ userId: 'user-1' }));

      authService.logout();

      expect(localStorage.getItem('authToken')).toBeNull();
      expect(localStorage.getItem('user')).toBeNull();
    });
  });

  describe('getToken and setToken', () => {
    it('sets and gets token from localStorage', () => {
      const token = 'test-token';
      authService.setToken(token);
      expect(authService.getToken()).toBe(token);
    });

    it('returns null when no token is stored', () => {
      localStorage.removeItem('authToken');
      expect(authService.getToken()).toBeNull();
    });
  });

  describe('getUser and setUser', () => {
    it('sets and gets user from localStorage', () => {
      const user: User = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test Tenant',
        validatedClaims: {},
      };

      authService.setUser(user);
      expect(authService.getUser()).toEqual(user);
    });

    it('returns null when no user is stored', () => {
      localStorage.removeItem('user');
      expect(authService.getUser()).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('returns true when valid token exists', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      const token = createMockToken({ exp: futureExp });
      authService.setToken(token);

      expect(authService.isAuthenticated()).toBe(true);
    });

    it('returns false when token is expired', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const token = createMockToken({ exp: pastExp });
      authService.setToken(token);

      expect(authService.isAuthenticated()).toBe(false);
    });

    it('returns false when no token exists', () => {
      localStorage.removeItem('authToken');
      expect(authService.isAuthenticated()).toBe(false);
    });
  });

  describe('isTokenExpired', () => {
    it('returns false for valid token', () => {
      const futureExp = Math.floor(Date.now() / 1000) + 3600;
      const token = createMockToken({ exp: futureExp });

      expect(authService.isTokenExpired(token)).toBe(false);
    });

    it('returns true for expired token', () => {
      const pastExp = Math.floor(Date.now() / 1000) - 3600;
      const token = createMockToken({ exp: pastExp });

      expect(authService.isTokenExpired(token)).toBe(true);
    });

    it('returns true for invalid token', () => {
      expect(authService.isTokenExpired('invalid-token')).toBe(true);
    });
  });

  describe('getTokenExpiration', () => {
    it('returns expiration date for valid token', () => {
      const exp = Math.floor(Date.now() / 1000) + 3600;
      const token = createMockToken({ exp });

      const expiration = authService.getTokenExpiration(token);

      expect(expiration).toBeInstanceOf(Date);
      expect(expiration?.getTime()).toBe(exp * 1000);
    });

    it('returns null for invalid token', () => {
      expect(authService.getTokenExpiration('invalid-token')).toBeNull();
    });
  });

  describe('hasBackendClaim', () => {
    it('returns true when user has the claim', () => {
      const user: User = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test Tenant',
        validatedClaims: {
          CMS_INVESTIGATOR: true,
        },
      };

      authService.setUser(user);
      expect(authService.hasBackendClaim('CMS_INVESTIGATOR')).toBe(true);
    });

    it('returns false when user does not have the claim', () => {
      const user: User = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test Tenant',
        validatedClaims: {},
      };

      authService.setUser(user);
      expect(authService.hasBackendClaim('CMS_INVESTIGATOR')).toBe(false);
    });

    it('returns false when no user is stored', () => {
      localStorage.removeItem('user');
      expect(authService.hasBackendClaim('CMS_INVESTIGATOR')).toBe(false);
    });
  });

  describe('role check methods', () => {
    beforeEach(() => {
      const user: User = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test Tenant',
        validatedClaims: {
          'CMS-TEST-ROLE': true,
          'alert-triage': true,
          CMS_INVESTIGATOR: true,
          CMS_SUPERVISOR: true,
          CMS_COMPLIANCE_OFFICER: true,
          CMS_ADMIN: true,
        },
      };
      authService.setUser(user);
    });

    it('hasCMSTestRole returns true when user has CMS-TEST-ROLE', () => {
      expect(authService.hasCMSTestRole()).toBe(true);
    });

    it('hasAlertTriageRole returns true when user has alert-triage', () => {
      expect(authService.hasAlertTriageRole()).toBe(true);
    });

    it('hasInvestigatorRole returns true when user has CMS_INVESTIGATOR', () => {
      expect(authService.hasInvestigatorRole()).toBe(true);
    });

    it('hasSupervisorRole returns true when user has CMS_SUPERVISOR', () => {
      expect(authService.hasSupervisorRole()).toBe(true);
    });

    it('hasComplianceOfficerRole returns true when user has CMS_COMPLIANCE_OFFICER', () => {
      expect(authService.hasComplianceOfficerRole()).toBe(true);
    });

    it('hasCMSAdminRole returns true when user has CMS_ADMIN', () => {
      expect(authService.hasCMSAdminRole()).toBe(true);
    });

    it('hasCMSComplianceOfficerRole returns true when user has CMS_COMPLIANCE_OFFICER', () => {
      expect(authService.hasCMSComplianceOfficerRole()).toBe(true);
    });

    it('hasAdminRole returns true when user has alert-triage or CMS-TEST-ROLE', () => {
      expect(authService.hasAdminRole()).toBe(true);
    });
  });

  describe('hasAnyRole and hasAllRoles', () => {
    beforeEach(() => {
      const user: User = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test Tenant',
        validatedClaims: {
          CMS_INVESTIGATOR: true,
          CMS_SUPERVISOR: false,
        },
      };
      authService.setUser(user);
    });

    it('hasAnyRole returns true when user has at least one role', () => {
      expect(
        authService.hasAnyRole(['CMS_INVESTIGATOR', 'CMS_SUPERVISOR']),
      ).toBe(true);
    });

    it('hasAnyRole returns false when user has none of the roles', () => {
      expect(authService.hasAnyRole(['CMS_ADMIN', 'CMS_COMPLIANCE_OFFICER'])).toBe(
        false,
      );
    });

    it('hasAllRoles returns true when user has all roles', () => {
      expect(authService.hasAllRoles(['CMS_INVESTIGATOR'])).toBe(true);
    });

    it('hasAllRoles returns false when user does not have all roles', () => {
      expect(
        authService.hasAllRoles(['CMS_INVESTIGATOR', 'CMS_SUPERVISOR']),
      ).toBe(false);
    });
  });

  describe('validateBackendAccess', () => {
    it('returns true when user has at least one valid CMS role', () => {
      const user: User = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test Tenant',
        validatedClaims: {
          CMS_INVESTIGATOR: true,
        },
      };
      authService.setUser(user);

      expect(authService.validateBackendAccess()).toBe(true);
    });

    it('returns false when user has no valid CMS roles', () => {
      const user: User = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'test@test.com',
        fullName: 'Test User',
        tenantName: 'Test Tenant',
        validatedClaims: {},
      };
      authService.setUser(user);

      expect(authService.validateBackendAccess()).toBe(false);
    });
  });

  describe('refreshUserProfile', () => {
    it('refreshes and updates user profile', async () => {
      const mockToken = 'mock-token';
      localStorage.setItem('authToken', mockToken);

      const mockUserData = {
        clientId: 'user-1',
        tenantId: 'tenant-1',
        email: 'updated@test.com',
        fullName: 'Updated User',
        tenantName: 'Updated Tenant',
        validatedClaims: { CMS_INVESTIGATOR: true },
      };

      server.use(
        http.get('*/v1/auth/me', () => {
          return HttpResponse.json(mockUserData);
        }),
      );

      const user = await authService.refreshUserProfile();

      expect(user).toEqual({
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'updated@test.com',
        fullName: 'Updated User',
        tenantName: 'Updated Tenant',
        validatedClaims: { CMS_INVESTIGATOR: true },
      });
      expect(authService.getUser()).toEqual(user);
    });
  });

  describe('getAuthHeader', () => {
    it('returns Authorization header when token exists', () => {
      const token = 'mock-token';
      authService.setToken(token);

      expect(authService.getAuthHeader()).toEqual({
        Authorization: `Bearer ${token}`,
      });
    });

    it('returns empty object when no token exists', () => {
      localStorage.removeItem('authToken');
      expect(authService.getAuthHeader()).toEqual({});
    });
  });

  describe('fetchAllInvestigators', () => {
    it('fetches all investigators successfully', async () => {
      const mockToken = 'mock-token';
      localStorage.setItem('authToken', mockToken);

      const mockInvestigators: Investigator[] = [
        {
          id: 'inv-1',
          username: 'investigator1',
          email: 'inv1@test.com',
          firstName: 'John',
          lastName: 'Doe',
        },
        {
          id: 'inv-2',
          username: 'investigator2',
          email: 'inv2@test.com',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      ];

      server.use(
        http.get('*/v1/user/list-by-role/CMS_INVESTIGATOR', () => {
          return HttpResponse.json(mockInvestigators);
        }),
      );

      const investigators = await authService.fetchAllInvestigators();

      expect(investigators).toEqual(mockInvestigators);
    });

    it('throws error on fetch failure', async () => {
      const mockToken = 'mock-token';
      localStorage.setItem('authToken', mockToken);

      server.use(
        http.get('*/v1/user/list-by-role/CMS_INVESTIGATOR', () => {
          return HttpResponse.json(
            { error: 'Internal Server Error' },
            { status: 500 },
          );
        }),
      );

      await expect(authService.fetchAllInvestigators()).rejects.toThrow(
        'Failed to fetch investigators',
      );
    });
  });
});

// Helper function to create a mock JWT token
function createMockToken(payload: { exp: number; [key: string]: unknown }): string {
  // Create proper JWT format: header.payload.signature
  // The token needs to have 3 parts separated by dots for the decoder to work
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  // Ensure we have a valid 3-part token structure
  return `${header}.${body}.signature`;
}

