import { describe, it, expect } from 'vitest';
import {
  BACKEND_CLAIMS,
  type BackendClaim,
  type LoginCredentials,
  type User,
  type LoginResponse,
  type DecodedToken,
  type Investigator,
  type AuthState,
  type AuthContextType,
} from '../auth.types';

describe('Auth Types', () => {
  describe('BACKEND_CLAIMS constants', () => {
    it('defines all backend claim constants', () => {
      expect(BACKEND_CLAIMS.ALERT_TRIAGE).toBe('alert-triage');
      expect(BACKEND_CLAIMS.CMS_TEST_ROLE).toBe('CMS-TEST-ROLE');
      expect(BACKEND_CLAIMS.CMS_INVESTIGATOR).toBe('CMS_INVESTIGATOR');
      expect(BACKEND_CLAIMS.CMS_SUPERVISOR).toBe('CMS_SUPERVISOR');
      expect(BACKEND_CLAIMS.CMS_ADMIN).toBe('CMS_ADMIN');
      expect(BACKEND_CLAIMS.MANAGE_ACCOUNT).toBe('manage-account');
      expect(BACKEND_CLAIMS.MANAGE_ACCOUNT_LINKS).toBe('manage-account-links');
      expect(BACKEND_CLAIMS.VIEW_PROFILE).toBe('view-profile');
      expect(BACKEND_CLAIMS.DEFAULT_ROLES_TAZAMA_CMS).toBe(
        'default-roles-tazama-cms',
      );
      expect(BACKEND_CLAIMS.OFFLINE_ACCESS).toBe('offline_access');
      expect(BACKEND_CLAIMS.UMA_AUTHORIZATION).toBe('uma_authorization');
    });
  });

  describe('LoginCredentials', () => {
    it('should be assignable with username and password', () => {
      const credentials: LoginCredentials = {
        username: 'test-user',
        password: 'password123',
      };
      expect(credentials.username).toBe('test-user');
      expect(credentials.password).toBe('password123');
    });
  });

  describe('User', () => {
    it('should be assignable with all required fields', () => {
      const user: User = {
        userId: 'user-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        fullName: 'John Doe',
        tenantName: 'Test Tenant',
        validatedClaims: {
          CMS_INVESTIGATOR: true,
          CMS_SUPERVISOR: false,
        },
      };
      expect(user.userId).toBe('user-1');
      expect(user.validatedClaims['CMS_INVESTIGATOR']).toBe(true);
    });
  });

  describe('LoginResponse', () => {
    it('should be assignable with token', () => {
      const response: LoginResponse = {
        message: 'Login successful',
        token: 'jwt-token-123',
        expiresIn: 3600,
      };
      expect(response.token).toBe('jwt-token-123');
      expect(response.expiresIn).toBe(3600);
    });

    it('should be assignable with user', () => {
      const response: LoginResponse = {
        message: 'Login successful',
        token: 'jwt-token-123',
        user: {
          userId: 'user-1',
          tenantId: 'tenant-1',
          email: 'user@example.com',
          fullName: 'John Doe',
          tenantName: 'Test Tenant',
          validatedClaims: {},
        },
      };
      expect(response.user?.userId).toBe('user-1');
    });
  });

  describe('DecodedToken', () => {
    it('should be assignable with all fields', () => {
      const token: DecodedToken = {
        exp: 1234567890,
        sid: 'session-123',
        iss: 'https://auth.example.com',
        tokenString: 'token-string',
        clientId: 'client-1',
        tenantId: 'tenant-1',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        tenantName: 'Test Tenant',
        claims: ['CMS_INVESTIGATOR', 'CMS_SUPERVISOR'],
      };
      expect(token.clientId).toBe('client-1');
      expect(token.claims).toHaveLength(2);
    });
  });

  describe('Investigator', () => {
    it('should be assignable with all fields', () => {
      const investigator: Investigator = {
        id: 'inv-1',
        username: 'investigator1',
        email: 'inv@example.com',
        firstName: 'Jane',
        lastName: 'Smith',
      };
      expect(investigator.id).toBe('inv-1');
      expect(investigator.username).toBe('investigator1');
    });
  });

  describe('AuthState', () => {
    it('should be assignable with all fields', () => {
      const state: AuthState = {
        isAuthenticated: true,
        user: {
          userId: 'user-1',
          tenantId: 'tenant-1',
          email: 'user@example.com',
          fullName: 'John Doe',
          tenantName: 'Test Tenant',
          validatedClaims: {},
        },
        token: 'jwt-token-123',
        loading: false,
        error: null,
      };
      expect(state.isAuthenticated).toBe(true);
      expect(state.loading).toBe(false);
    });

    it('should be assignable with null user and token', () => {
      const state: AuthState = {
        isAuthenticated: false,
        user: null,
        token: null,
        loading: false,
        error: null,
      };
      expect(state.isAuthenticated).toBe(false);
      expect(state.user).toBeNull();
    });
  });

  describe('AuthContextType', () => {
    it('should extend AuthState and include methods', () => {
      const context: AuthContextType = {
        isAuthenticated: true,
        user: {
          userId: 'user-1',
          tenantId: 'tenant-1',
          email: 'user@example.com',
          fullName: 'John Doe',
          tenantName: 'Test Tenant',
          validatedClaims: {},
        },
        token: 'jwt-token-123',
        loading: false,
        error: null,
        login: async () => {},
        logout: () => {},
        clearError: () => {},
        hasBackendClaim: () => false,
        hasInvestigatorRole: () => false,
        hasSupervisorRole: () => false,
        hasComplianceOfficerRole: () => false,
        hasCMSAdminRole: () => false,
        hasAdminRole: () => false,
        hasAnyRole: () => false,
        hasAllRoles: () => false,
        validateBackendAccess: () => false,
      };
      expect(context.login).toBeDefined();
      expect(context.logout).toBeDefined();
      expect(typeof context.hasBackendClaim).toBe('function');
    });
  });
});
