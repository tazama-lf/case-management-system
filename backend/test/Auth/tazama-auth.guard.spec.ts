import { TazamaAuthGuard } from '../../src/auth/tazama-auth.guard';
import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validateTokenAndClaims } from '@tazama-lf/auth-lib';
import { ClaimValidationResult } from '@tazama-lf/auth-lib/lib/interfaces/iTazamaToken';
import { TazamaToken } from '../../src/auth/auth.types';
import * as jwt from 'jsonwebtoken';

// Mock the external auth library
jest.mock('@tazama-lf/auth-lib', () => ({
  validateTokenAndClaims: jest.fn(),
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  decode: jest.fn(),
}));

interface MockRequest {
  headers: {
    authorization?: string;
  };
  user?: {
    token: TazamaToken;
    validated: ClaimValidationResult;
    validClaims: string[];
  };
}

describe('TazamaAuthGuard', () => {
  let guard: TazamaAuthGuard;
  let reflector: jest.Mocked<Reflector>;
  let mockExecutionContext: jest.Mocked<ExecutionContext>;
  let mockRequest: MockRequest;
  let mockValidateTokenAndClaims: jest.MockedFunction<typeof validateTokenAndClaims>;
  let mockJwtDecode: jest.MockedFunction<typeof jwt.decode>;

  beforeEach(() => {
    reflector = {
      getAllAndOverride: jest.fn(),
    } as unknown as jest.Mocked<Reflector>;

    guard = new TazamaAuthGuard(reflector);
    mockValidateTokenAndClaims = validateTokenAndClaims as jest.MockedFunction<typeof validateTokenAndClaims>;
    mockJwtDecode = jwt.decode as jest.MockedFunction<typeof jwt.decode>;

    mockRequest = {
      headers: {
        authorization: undefined,
      },
      user: undefined,
    };

    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as unknown as jest.Mocked<ExecutionContext>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Silence logger output during tests
  beforeAll(() => {
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  describe('canActivate', () => {
    it('should be defined', () => {
      expect(guard).toBeDefined();
      expect(typeof guard.canActivate).toBe('function');
    });

    it('should return true for public routes', async () => {
      // Mock public route
      reflector.getAllAndOverride
        .mockReturnValueOnce(true) // IS_PUBLIC_KEY
        .mockReturnValueOnce([]); // CLAIMS_KEY

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(reflector.getAllAndOverride).toHaveBeenNthCalledWith(1, 'isPublic', [
        mockExecutionContext.getHandler(),
        mockExecutionContext.getClass(),
      ]);
      expect(mockValidateTokenAndClaims).not.toHaveBeenCalled();
    });

    it('should throw UnauthorizedException when no Bearer token is provided', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['test-claim']); // CLAIMS_KEY

      mockRequest.headers.authorization = undefined;

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(new UnauthorizedException('No Bearer token provided'));
    });

    it('should throw UnauthorizedException when authorization header does not start with Bearer', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['test-claim']); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Basic some-token';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(new UnauthorizedException('No Bearer token provided'));
    });

    it('should throw UnauthorizedException when no required claims are specified', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce([]); // CLAIMS_KEY (empty array)

      mockRequest.headers.authorization = 'Bearer valid-token';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(new UnauthorizedException('No required claims specified'));
    });

    it('should throw UnauthorizedException when required claims are undefined', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(undefined); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Bearer valid-token';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(new UnauthorizedException('No required claims specified'));
    });

    it('should throw UnauthorizedException when token validation fails', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['admin']); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Bearer invalid-token';

      mockValidateTokenAndClaims.mockImplementation(() => {
        throw new Error('Token validation failed');
      });

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(new UnauthorizedException('Token validation failed'));
    });

    it('should throw UnauthorizedException when user has missing required claims', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['admin', 'write']); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Bearer user-token';

      const mockValidationResult: ClaimValidationResult = {
        admin: false, // Missing this claim
        write: true,
      };

      mockValidateTokenAndClaims.mockReturnValue(mockValidationResult);

      const mockTokenPayload: TazamaToken = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        claims: ['write'],
      } as TazamaToken;

      mockJwtDecode.mockReturnValue(mockTokenPayload);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(new UnauthorizedException('Missing or invalid claims: admin'));
    });

    it('should throw UnauthorizedException when token decode fails', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['admin']); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Bearer malformed-token';

      const mockValidationResult: ClaimValidationResult = {
        admin: true,
      };

      mockValidateTokenAndClaims.mockReturnValue(mockValidationResult);
      mockJwtDecode.mockReturnValue(null); // Failed to decode

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(new UnauthorizedException('Invalid token format'));
    });

    it('should return true and set user when authentication is successful', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['admin', 'read']); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Bearer valid-token';

      const mockValidationResult: ClaimValidationResult = {
        admin: true,
        read: true,
        isValid: false, // match the guard's default
        errors: false,
      };

      mockValidateTokenAndClaims.mockReturnValue(mockValidationResult);

      const mockTokenPayload: TazamaToken = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        claims: ['admin', 'read', 'write'],
      } as TazamaToken;

      mockJwtDecode.mockReturnValue(mockTokenPayload);

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(mockValidateTokenAndClaims).toHaveBeenCalledWith('valid-token', ['admin', 'read']);
      expect(mockRequest.user).toBeDefined();
      expect(mockRequest.user?.token).toEqual(mockTokenPayload);
      expect(mockRequest.user?.validated).toEqual(mockValidationResult);
      expect(mockRequest.user?.validClaims).toEqual(['admin', 'read']);
    });

    it('should handle partial claim validation correctly', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['admin', 'read', 'write']); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Bearer partial-token';

      const mockValidationResult: ClaimValidationResult = {
        admin: true,
        read: true,
        write: false, // This claim is invalid
      };

      mockValidateTokenAndClaims.mockReturnValue(mockValidationResult);

      const mockTokenPayload: TazamaToken = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        claims: ['admin', 'read'],
      } as TazamaToken;

      mockJwtDecode.mockReturnValue(mockTokenPayload);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(new UnauthorizedException('Missing or invalid claims: write'));
    });

    it('should handle multiple missing claims correctly', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['admin', 'read', 'write', 'delete']); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Bearer limited-token';

      const mockValidationResult: ClaimValidationResult = {
        admin: false,
        read: true,
        write: false,
        delete: false,
      };

      mockValidateTokenAndClaims.mockReturnValue(mockValidationResult);

      const mockTokenPayload: TazamaToken = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        claims: ['read'],
      } as TazamaToken;

      mockJwtDecode.mockReturnValue(mockTokenPayload);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        new UnauthorizedException('Missing or invalid claims: admin, write, delete'),
      );
    });

    it('should correctly extract token from authorization header', async () => {
      const testCases = [
        { header: 'Bearer token123', expectedToken: 'token123' },
        { header: 'Bearer token-with-spaces', expectedToken: 'token-with-spaces' },
        { header: 'Bearer jwt.token.with.dots', expectedToken: 'jwt.token.with.dots' },
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();

        reflector.getAllAndOverride
          .mockReturnValueOnce(false) // IS_PUBLIC_KEY
          .mockReturnValueOnce(['test']); // CLAIMS_KEY

        mockRequest.headers.authorization = testCase.header;

        const mockValidationResult: ClaimValidationResult = {
          test: true,
        };

        mockValidateTokenAndClaims.mockReturnValue(mockValidationResult);

        const mockTokenPayload: TazamaToken = {
          clientId: 'test-client',
          tenantId: 'test-tenant',
          claims: ['test'],
        } as TazamaToken;

        mockJwtDecode.mockReturnValue(mockTokenPayload);

        await guard.canActivate(mockExecutionContext);

        expect(mockValidateTokenAndClaims).toHaveBeenCalledWith(testCase.expectedToken, ['test']);
      }
    });

    it('should re-throw UnauthorizedException as-is', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['admin']); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Bearer failing-token';

      const customUnauthorizedException = new UnauthorizedException('Custom unauthorized message');
      mockValidateTokenAndClaims.mockImplementation(() => {
        throw customUnauthorizedException;
      });

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(customUnauthorizedException);
    });
  });

  describe('extractTokenPayload error scenarios', () => {
    it('should throw UnauthorizedException when token is missing clientId', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['admin']); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Bearer token-without-clientId';

      const mockValidationResult: ClaimValidationResult = {
        admin: true,
      };

      mockValidateTokenAndClaims.mockReturnValue(mockValidationResult);

      // Mock token payload missing clientId (line 103-104)
      const mockTokenPayload = {
        tenantId: 'test-tenant',
        claims: ['admin'],
      } as TazamaToken;

      mockJwtDecode.mockReturnValue(mockTokenPayload);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(new UnauthorizedException('Invalid token format'));
    });

    it('should throw UnauthorizedException when token is missing tenantId', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['admin']); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Bearer token-without-tenantId';

      const mockValidationResult: ClaimValidationResult = {
        admin: true,
      };

      mockValidateTokenAndClaims.mockReturnValue(mockValidationResult);

      // Mock token payload missing tenantId (line 107-108)
      const mockTokenPayload = {
        clientId: 'test-client',
        claims: ['admin'],
      } as TazamaToken;

      mockJwtDecode.mockReturnValue(mockTokenPayload);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(new UnauthorizedException('Invalid token format'));
    });

    it('should throw UnauthorizedException when token is missing claims array', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['admin']); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Bearer token-without-claims';

      const mockValidationResult: ClaimValidationResult = {
        admin: true,
      };

      mockValidateTokenAndClaims.mockReturnValue(mockValidationResult);

      // Mock token payload missing claims (line 111-112)
      const mockTokenPayload = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
      } as TazamaToken;

      mockJwtDecode.mockReturnValue(mockTokenPayload);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(new UnauthorizedException('Invalid token format'));
    });

    it('should throw UnauthorizedException when token has invalid claims array', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['admin']); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Bearer token-with-invalid-claims';

      const mockValidationResult: ClaimValidationResult = {
        admin: true,
      };

      mockValidateTokenAndClaims.mockReturnValue(mockValidationResult);

      // Mock token payload with invalid claims (not an array) (line 111-112)
      const mockTokenPayload = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        claims: 'not-an-array', // Invalid claims type
      } as unknown as TazamaToken;

      mockJwtDecode.mockReturnValue(mockTokenPayload);

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(new UnauthorizedException('Invalid token format'));
    });
  });

  describe('Integration with NestJS', () => {
    it('should properly use Reflector for metadata extraction', async () => {
      reflector.getAllAndOverride
        .mockReturnValueOnce(true) // IS_PUBLIC_KEY
        .mockReturnValueOnce([]); // CLAIMS_KEY

      await guard.canActivate(mockExecutionContext);

      expect(reflector.getAllAndOverride).toHaveBeenNthCalledWith(1, 'isPublic', [
        mockExecutionContext.getHandler(),
        mockExecutionContext.getClass(),
      ]);
    });

    it('should properly use ExecutionContext to get request', async () => {
      const mockGetRequest = jest.fn().mockReturnValue(mockRequest);
      const mockSwitchToHttp = jest.fn().mockReturnValue({
        getRequest: mockGetRequest,
      });

      // Update the existing mock execution context
      mockExecutionContext.switchToHttp = mockSwitchToHttp;

      reflector.getAllAndOverride
        .mockReturnValueOnce(false) // IS_PUBLIC_KEY
        .mockReturnValueOnce(['test']); // CLAIMS_KEY

      mockRequest.headers.authorization = 'Bearer test-token';

      const mockValidationResult: ClaimValidationResult = {
        test: true,
      };

      mockValidateTokenAndClaims.mockReturnValue(mockValidationResult);

      const mockTokenPayload: TazamaToken = {
        clientId: 'test-client',
        tenantId: 'test-tenant',
        claims: ['test'],
      } as TazamaToken;

      mockJwtDecode.mockReturnValue(mockTokenPayload);

      await guard.canActivate(mockExecutionContext);

      expect(mockSwitchToHttp).toHaveBeenCalled();
      expect(mockGetRequest).toHaveBeenCalled();
    });
  });
});
