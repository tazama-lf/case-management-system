import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/modules/auth/auth.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { UnauthorizedException, ServiceUnavailableException, BadRequestException, NotFoundException } from '@nestjs/common';
import { of, throwError } from 'rxjs';
import * as jwt from 'jsonwebtoken';
import { CacheService } from '../src/modules/shared/cache.service';

describe('AuthService', () => {
  let service: AuthService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;
  let loggerService: jest.Mocked<LoggerService>;
  let cacheService: jest.Mocked<CacheService>;

  const mockToken = jwt.sign({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'user123' }, 'secret');
  const expiredToken = jwt.sign({ exp: Math.floor(Date.now() / 1000) - 3600, sub: 'user123' }, 'secret');

  // Helper function to setup common mocks
  const setupAuthUrl = (url = 'http://auth-service/v1/auth') => {
    (configService.get as jest.Mock).mockReturnValue(url);
  };

  // Helper function to mock successful HTTP response
  const mockHttpResponse = (data: any) => {
    (httpService.post as jest.Mock).mockReturnValue(of({ data }));
  };

  const mockHttpGetResponse = (data: any) => {
    (httpService.get as jest.Mock).mockReturnValue(of({ data }));
  };

  beforeEach(async () => {
    const mockHttpService = {
      post: jest.fn(),
      get: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn(),
    };

    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockCacheService = {
      initializeUserCache: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: HttpService,
          useValue: mockHttpService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: CacheService,
          useValue: mockCacheService,
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
    loggerService = module.get(LoggerService);
    cacheService = module.get(CacheService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('login', () => {
    it('should successfully login with token as string', async () => {
      jest.useFakeTimers();
      setupAuthUrl();
      mockHttpResponse(mockToken);

      const result = await service.login('testuser', 'password123');

      expect(result).toBeDefined();
      expect(result.message).toBe('Login successful');
      expect(result.token).toBe(mockToken);
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(httpService.post).toHaveBeenCalledWith('http://auth-service/v1/auth/login', {
        username: 'testuser',
        password: 'password123',
      });

      // Advance timers to trigger cache initialization
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
      expect(cacheService.initializeUserCache).toHaveBeenCalledWith(0, mockToken);
      jest.useRealTimers();
    });

    test.each([
      ['token field', { token: mockToken, expires_in: 3600 }, 3600],
      ['access_token field', { access_token: mockToken, expiresIn: 7200 }, 7200],
      ['jwt field', { jwt: mockToken }, null],
      ['user.token field', { user: { token: mockToken } }, null],
    ])('should handle %s in response', async (_, responseData, expectedExpiry) => {
      setupAuthUrl();
      mockHttpResponse(responseData);

      const result = await service.login('testuser', 'password123');

      expect(result.token).toBe(mockToken);
      if (expectedExpiry !== null) {
        expect(result.expiresIn).toBe(expectedExpiry);
      } else {
        expect(result.expiresIn).toBeGreaterThan(0);
      }
    });

    it('should derive expiry from token when not provided', async () => {
      setupAuthUrl();
      mockHttpResponse({ token: mockToken });

      const result = await service.login('testuser', 'password123');

      expect(result.expiresIn).toBeGreaterThan(0);
      expect(result.expiresIn).toBeLessThanOrEqual(3600);
    });

    it('should throw ServiceUnavailableException when auth URL not configured', async () => {
      setupAuthUrl(undefined);

      await expect(service.login('testuser', 'password123')).rejects.toThrow(ServiceUnavailableException);
    });

    test.each([
      ['null data', null],
      ['no token in response', { message: 'no token' }],
    ])('should throw ServiceUnavailableException for %s', async (_, responseData) => {
      setupAuthUrl();
      mockHttpResponse(responseData);

      await expect(service.login('testuser', 'password123')).rejects.toThrow(ServiceUnavailableException);
    });

    it('should throw UnauthorizedException on 401 error', async () => {
      setupAuthUrl();
      const error = { response: { status: 401 } };
      (httpService.post as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.login('testuser', 'wrongpass')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ServiceUnavailableException on network error', async () => {
      setupAuthUrl();
      (httpService.post as jest.Mock).mockReturnValue(throwError(() => new Error('Network error')));

      await expect(service.login('testuser', 'password123')).rejects.toThrow(ServiceUnavailableException);
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('isTokenExpired', () => {
    test.each([
      ['valid token', mockToken, false],
      ['expired token', expiredToken, true],
      ['token without expiry', jwt.sign({ sub: 'user123' }, 'secret'), true],
      ['invalid token', 'invalid-token', true],
      ['malformed token', 'not.a.token', true],
    ])('should return %s for %s', (_, token, expected) => {
      const result = service.isTokenExpired(token);
      expect(result).toBe(expected);
    });

    it('should handle non-Error thrown during decode', () => {
      jest.spyOn(jwt, 'decode').mockImplementation(() => {
        throw 'string error';
      });

      const result = service.isTokenExpired('any-token');

      expect(result).toBe(true);
      expect(loggerService.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to check token expiry'));
    });
  });

  describe('getTokenTimeToExpiry', () => {
    test.each([
      ['expired token', expiredToken, 0],
      ['token without expiry', jwt.sign({ sub: 'user123' }, 'secret'), 0],
      ['invalid token', 'invalid-token', 0],
    ])('should return 0 for %s', (_, token, expected) => {
      const result = service.getTokenTimeToExpiry(token);
      expect(result).toBe(expected);
    });

    it('should return time to expiry for valid token', () => {
      // Create token with extra buffer to account for test execution time
      const freshToken = jwt.sign({ exp: Math.floor(Date.now() / 1000) + 7200, sub: 'user123' }, 'secret');
      const result = service.getTokenTimeToExpiry(freshToken);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(7200);
    });

    it('should handle token about to expire', () => {
      // Create token with 10 seconds expiry to be safe
      const almostExpiredToken = jwt.sign({ exp: Math.floor(Date.now() / 1000) + 10, sub: 'user123' }, 'secret');

      const result = service.getTokenTimeToExpiry(almostExpiredToken);

      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(10);
    });

    it('should handle non-Error thrown during decode', () => {
      jest.spyOn(jwt, 'decode').mockImplementation(() => {
        throw { code: 'INVALID_TOKEN' };
      });

      const result = service.getTokenTimeToExpiry('any-token');

      expect(result).toBe(0);
      expect(loggerService.warn).toHaveBeenCalledWith(expect.stringContaining('Failed to get time to expiry'));
    });
  });

  describe('getUserRolesFromAuthService', () => {
    it('should fetch user roles successfully', async () => {
      setupAuthUrl('http://auth-service/v1/auth/login');
      mockHttpGetResponse({ roles: ['admin', 'user'] });

      const result = await service.getUserRolesFromAuthService('user123');

      expect(result).toEqual(['admin', 'user']);
      expect(httpService.get).toHaveBeenCalledWith('http://auth-service/users/user123/roles', expect.any(Object));
    });

    it('should throw BadRequestException when userId is missing', async () => {
      await expect(service.getUserRolesFromAuthService('')).rejects.toThrow(BadRequestException);
    });

    it('should return empty array when roles is not an array', async () => {
      setupAuthUrl();
      mockHttpGetResponse({ roles: null });

      const result = await service.getUserRolesFromAuthService('user123');

      expect(result).toEqual([]);
    });

    it('should encode special characters in userId', async () => {
      setupAuthUrl();
      mockHttpGetResponse({ roles: [] });

      await service.getUserRolesFromAuthService('user@example.com');

      expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining('user%40example.com'), expect.any(Object));
    });

    test.each([
      ['404 error', { response: { status: 404 } }, NotFoundException],
      [
        '500 error with group not found',
        { response: { status: 500, data: { message: 'No group found with name: roles' } } },
        NotFoundException,
      ],
      ['500 error with subgroup not found', { response: { status: 500, data: { error: 'No subgroup found' } } }, NotFoundException],
      ['generic 500 error', { response: { status: 500, data: 'Internal server error' } }, ServiceUnavailableException],
    ])('should handle %s', async (_, error, expectedException) => {
      setupAuthUrl();
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.getUserRolesFromAuthService('user123')).rejects.toThrow(expectedException);
    });
  });

  describe('getUserDetailsFromAuthService', () => {
    const mockUserResponse = {
      id: 'user123',
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      email: 'test@example.com',
      roles: ['admin', 'user'],
    };

    it('should fetch user details successfully', async () => {
      setupAuthUrl('http://auth-service/v1/auth/login');
      mockHttpGetResponse(mockUserResponse);

      const result = await service.getUserDetailsFromAuthService('user123');

      expect(result).toEqual({
        id: 'user123',
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        roles: ['admin', 'user'],
      });
    });

    it('should throw BadRequestException when userId is missing', async () => {
      await expect(service.getUserDetailsFromAuthService('')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException when user has no id', async () => {
      setupAuthUrl();
      mockHttpGetResponse({});

      await expect(service.getUserDetailsFromAuthService('user123')).rejects.toThrow(BadRequestException);
    });

    it('should handle missing optional fields', async () => {
      setupAuthUrl();
      mockHttpGetResponse({ id: 'user123' });

      const result = await service.getUserDetailsFromAuthService('user123');

      expect(result).toEqual({
        id: 'user123',
        username: '',
        firstName: '',
        lastName: '',
        email: '',
        roles: [],
      });
    });

    it('should handle roles as non-array', async () => {
      setupAuthUrl();
      mockHttpGetResponse({ id: 'user123', roles: null });

      const result = await service.getUserDetailsFromAuthService('user123');

      expect(result.roles).toEqual([]);
    });

    it('should encode special characters in userId', async () => {
      setupAuthUrl();
      mockHttpGetResponse(mockUserResponse);

      await service.getUserDetailsFromAuthService('user@example.com');

      expect(httpService.get).toHaveBeenCalledWith(expect.stringContaining('user%40example.com'), expect.any(Object));
    });

    test.each([
      ['404 error', { response: { status: 404 } }, NotFoundException],
      ['network error', new Error('Network error'), ServiceUnavailableException],
    ])('should handle %s', async (_, error, expectedException) => {
      setupAuthUrl();
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.getUserDetailsFromAuthService('user123')).rejects.toThrow(expectedException);
    });
  });

  describe('userExists', () => {
    it('should return true when user exists', async () => {
      setupAuthUrl();
      mockHttpGetResponse({ id: 'user123', username: 'testuser' });

      const result = await service.userExists('user123');

      expect(result).toBe(true);
    });

    test.each([
      ['user does not exist', 'user123', new Error('User not found')],
      ['empty userId', '', null],
      ['network error', 'user123', new Error('Network error')],
    ])('should return false when %s', async (_, userId, error) => {
      if (error) {
        setupAuthUrl();
        (httpService.get as jest.Mock).mockReturnValue(throwError(() => error));
      }

      const result = await service.userExists(userId);

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw ServiceUnavailableException when auth URL is not configured', async () => {
      setupAuthUrl(undefined);

      await expect(service.getUserRolesFromAuthService('user123')).rejects.toThrow(ServiceUnavailableException);
    });

    test.each([
      ['error data as string', { response: { status: 500, data: 'Internal server error' } }],
      ['error data as object with message', { response: { status: 500, data: { message: 'Custom error message' } } }],
      ['error without response', new Error('Connection refused')],
    ])('should handle %s', async (_, error) => {
      setupAuthUrl();
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.getUserRolesFromAuthService('user123')).rejects.toThrow(ServiceUnavailableException);
    });

    test.each([
      ['remove /v1/auth/login suffix', 'http://auth-service/v1/auth/login', 'http://auth-service/users/user123/roles'],
      ['handle trailing slash', 'http://auth-service/v1/auth/login/', 'http://auth-service/users/user123/roles'],
    ])('should %s from auth URL', async (_, authUrl, expectedUrl) => {
      setupAuthUrl(authUrl);
      mockHttpGetResponse({ roles: [] });

      await service.getUserRolesFromAuthService('user123');

      expect(httpService.get).toHaveBeenCalledWith(expectedUrl, expect.any(Object));
    });
  });
});
