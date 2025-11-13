import * as AuthTypes from '../../src/auth/auth.types';
import { AuthenticatedUser, AuthenticatedRequest, TazamaToken, ClaimValidationResult } from '../../src/auth/auth.types';

describe('Auth Types', () => {
  // Test that imports are working and the module exports are accessible
  it('should import auth types module successfully', () => {
    // This test ensures the module can be imported without errors
    // and that the module exports are accessible
    expect(AuthTypes).toBeDefined();
    expect(typeof AuthTypes).toBe('object');
  });

  describe('AuthenticatedUser Interface', () => {
    it('should have required properties: token, validated, and validClaims', () => {
      // Create a mock that satisfies the interface structure
      const mockToken = {} as TazamaToken;
      const mockValidated = {} as ClaimValidationResult;

      const user: AuthenticatedUser = {
        token: mockToken,
        validated: mockValidated,
        validClaims: ['claim1', 'claim2'],
      };

      // Test that the interface structure is correct
      expect(user).toHaveProperty('token');
      expect(user).toHaveProperty('validated');
      expect(user).toHaveProperty('validClaims');
      expect(Array.isArray(user.validClaims)).toBe(true);
    });

    it('should allow empty validClaims array', () => {
      const user: AuthenticatedUser = {
        token: {} as TazamaToken,
        validated: {} as ClaimValidationResult,
        validClaims: [],
      };

      expect(user.validClaims).toHaveLength(0);
      expect(Array.isArray(user.validClaims)).toBe(true);
    });

    it('should allow multiple validClaims', () => {
      const user: AuthenticatedUser = {
        token: {} as TazamaToken,
        validated: {} as ClaimValidationResult,
        validClaims: ['admin', 'user', 'read', 'write'],
      };

      expect(user.validClaims).toHaveLength(4);
      expect(user.validClaims).toContain('admin');
      expect(user.validClaims).toContain('write');
    });

    it('should accept TazamaToken type for token property', () => {
      const user: AuthenticatedUser = {
        token: {} as TazamaToken,
        validated: {} as ClaimValidationResult,
        validClaims: [],
      };

      // Test that token property accepts TazamaToken type
      expect(user.token).toBeDefined();
      expect(typeof user.token).toBe('object');
    });

    it('should accept ClaimValidationResult type for validated property', () => {
      const user: AuthenticatedUser = {
        token: {} as TazamaToken,
        validated: {} as ClaimValidationResult,
        validClaims: [],
      };

      // Test that validated property accepts ClaimValidationResult type
      expect(user.validated).toBeDefined();
      expect(typeof user.validated).toBe('object');
    });
  });

  describe('AuthenticatedRequest Interface', () => {
    it('should extend Request with AuthenticatedUser', () => {
      // Create a minimal mock that satisfies the interface
      const user: AuthenticatedUser = {
        token: {} as TazamaToken,
        validated: {} as ClaimValidationResult,
        validClaims: ['test'],
      };

      // Test that AuthenticatedRequest includes user property
      const request = { user } as AuthenticatedRequest;

      expect(request).toHaveProperty('user');
      expect(request.user).toBeDefined();
      expect(request.user.validClaims).toContain('test');
    });

    it('should maintain Request interface compatibility', () => {
      const user: AuthenticatedUser = {
        token: {} as TazamaToken,
        validated: {} as ClaimValidationResult,
        validClaims: [],
      };

      // Test that we can assign standard Request properties
      const request = {
        user,
        url: '/test',
        method: 'GET',
      } as AuthenticatedRequest;

      expect(request.user).toBeDefined();
      expect(request.url).toBe('/test');
      expect(request.method).toBe('GET');
    });

    it('should allow different user configurations', () => {
      const userWithClaims: AuthenticatedUser = {
        token: {} as TazamaToken,
        validated: {} as ClaimValidationResult,
        validClaims: ['admin', 'moderator'],
      };

      const userWithoutClaims: AuthenticatedUser = {
        token: {} as TazamaToken,
        validated: {} as ClaimValidationResult,
        validClaims: [],
      };

      const requestWithClaims = { user: userWithClaims } as AuthenticatedRequest;
      const requestWithoutClaims = { user: userWithoutClaims } as AuthenticatedRequest;

      expect(requestWithClaims.user.validClaims).toHaveLength(2);
      expect(requestWithoutClaims.user.validClaims).toHaveLength(0);
    });
  });

  describe('Type Exports', () => {
    it('should export TazamaToken type', () => {
      // Test that TazamaToken type is available for import
      const createToken = (): TazamaToken => ({}) as TazamaToken;
      const token = createToken();

      expect(token).toBeDefined();
      expect(typeof token).toBe('object');
    });

    it('should export ClaimValidationResult type', () => {
      // Test that ClaimValidationResult type is available for import
      const createResult = (): ClaimValidationResult => ({}) as ClaimValidationResult;
      const result = createResult();

      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should support type composition', () => {
      // Test that exported types can be used together
      const createUser = (token: TazamaToken, validated: ClaimValidationResult): AuthenticatedUser => ({
        token,
        validated,
        validClaims: [],
      });

      const token = {} as TazamaToken;
      const validated = {} as ClaimValidationResult;
      const user = createUser(token, validated);

      expect(user.token).toBe(token);
      expect(user.validated).toBe(validated);
      expect(user.validClaims).toEqual([]);
    });
  });

  describe('Interface Usage Patterns', () => {
    it('should support functional programming patterns', () => {
      const users: AuthenticatedUser[] = [
        {
          token: {} as TazamaToken,
          validated: {} as ClaimValidationResult,
          validClaims: ['read'],
        },
        {
          token: {} as TazamaToken,
          validated: {} as ClaimValidationResult,
          validClaims: ['write', 'admin'],
        },
      ];

      const adminUsers = users.filter((user) => user.validClaims.includes('admin'));
      const allClaims = users.flatMap((user) => user.validClaims);

      expect(adminUsers).toHaveLength(1);
      expect(allClaims).toContain('read');
      expect(allClaims).toContain('write');
      expect(allClaims).toContain('admin');
    });

    it('should support object destructuring', () => {
      const user: AuthenticatedUser = {
        token: {} as TazamaToken,
        validated: {} as ClaimValidationResult,
        validClaims: ['test', 'example'],
      };

      const { token, validated, validClaims } = user;

      expect(token).toBeDefined();
      expect(validated).toBeDefined();
      expect(validClaims).toEqual(['test', 'example']);
    });
  });
});
