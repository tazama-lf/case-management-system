import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../src/modules/auth/auth.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import {
  UnauthorizedException,
  ServiceUnavailableException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { of, throwError } from 'rxjs';
import * as jwt from 'jsonwebtoken';

describe('AuthService', () => {
  let service: AuthService;
  let httpService: jest.Mocked<HttpService>;
  let configService: jest.Mocked<ConfigService>;
  let loggerService: jest.Mocked<LoggerService>;

  const mockToken = jwt.sign({ exp: Math.floor(Date.now() / 1000) + 3600, sub: 'user123' }, 'secret');
  const expiredToken = jwt.sign({ exp: Math.floor(Date.now() / 1000) - 3600, sub: 'user123' }, 'secret');

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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
    loggerService = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('login', () => {
    it('should successfully login with token as string', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth');
      (httpService.post as jest.Mock).mockReturnValue(of({ data: mockToken }));

      const result = await service.login('testuser', 'password123');

      expect(result).toBeDefined();
      expect(result.message).toBe('Login successful');
      expect(result.token).toBe(mockToken);
      expect(result.expiresIn).toBeGreaterThan(0);
      expect(httpService.post).toHaveBeenCalledWith('http://auth-service/v1/auth/login', {
        username: 'testuser',
        password: 'password123',
      });
    });

    it('should successfully login with token as object', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth');
      (httpService.post as jest.Mock).mockReturnValue(
        of({ data: { token: mockToken, expires_in: 3600 } }),
      );

      const result = await service.login('testuser', 'password123');

      expect(result.token).toBe(mockToken);
      expect(result.expiresIn).toBe(3600);
    });

    it('should handle access_token field', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth');
      (httpService.post as jest.Mock).mockReturnValue(
        of({ data: { access_token: mockToken, expiresIn: 7200 } }),
      );

      const result = await service.login('testuser', 'password123');

      expect(result.token).toBe(mockToken);
      expect(result.expiresIn).toBe(7200);
    });

    it('should handle jwt field', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth');
      (httpService.post as jest.Mock).mockReturnValue(of({ data: { jwt: mockToken } }));

      const result = await service.login('testuser', 'password123');

      expect(result.token).toBe(mockToken);
    });

    it('should handle user.token field', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth');
      (httpService.post as jest.Mock).mockReturnValue(
        of({ data: { user: { token: mockToken } } }),
      );

      const result = await service.login('testuser', 'password123');

      expect(result.token).toBe(mockToken);
    });

    it('should derive expiry from token when not provided', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth');
      (httpService.post as jest.Mock).mockReturnValue(of({ data: { token: mockToken } }));

      const result = await service.login('testuser', 'password123');

      expect(result.expiresIn).toBeGreaterThan(0);
      expect(result.expiresIn).toBeLessThanOrEqual(3600);
    });

    it('should throw ServiceUnavailableException when auth URL is not configured', async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      await expect(service.login('testuser', 'password123')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw UnauthorizedException on 401 error', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth');
      const error = {
        response: { status: 401 },
      };
      (httpService.post as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.login('testuser', 'wrongpass')).rejects.toThrow(UnauthorizedException);
    });

    it('should throw ServiceUnavailableException when data is null', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth');
      (httpService.post as jest.Mock).mockReturnValue(of({ data: null }));

      await expect(service.login('testuser', 'password123')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw ServiceUnavailableException when no token in response', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth');
      (httpService.post as jest.Mock).mockReturnValue(of({ data: { message: 'no token' } }));

      await expect(service.login('testuser', 'password123')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should throw ServiceUnavailableException on network error', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth');
      (httpService.post as jest.Mock).mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(service.login('testuser', 'password123')).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(loggerService.error).toHaveBeenCalled();
    });
  });

  describe('isTokenExpired', () => {
    it('should return false for valid token', () => {
      const result = service.isTokenExpired(mockToken);

      expect(result).toBe(false);
    });

    it('should return true for expired token', () => {
      const result = service.isTokenExpired(expiredToken);

      expect(result).toBe(true);
    });

    it('should return true for token without expiry', () => {
      const tokenWithoutExp = jwt.sign({ sub: 'user123' }, 'secret');

      const result = service.isTokenExpired(tokenWithoutExp);

      expect(result).toBe(true);
    });

    it('should return true for invalid token', () => {
      const result = service.isTokenExpired('invalid-token');

      expect(result).toBe(true);
    });

    it('should handle malformed token gracefully', () => {
      const result = service.isTokenExpired('not.a.token');

      expect(result).toBe(true);
    });

    it('should handle non-Error thrown during decode', () => {
      jest.spyOn(jwt, 'decode').mockImplementation(() => {
        throw 'string error'; // Throw non-Error object
      });

      const result = service.isTokenExpired('any-token');

      expect(result).toBe(true);
      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to check token expiry'),
      );
    });
  });

  describe('getTokenTimeToExpiry', () => {
    it('should return time to expiry for valid token', () => {
      const result = service.getTokenTimeToExpiry(mockToken);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(3600);
    });

    it('should return 0 for expired token', () => {
      const result = service.getTokenTimeToExpiry(expiredToken);

      expect(result).toBe(0);
    });

    it('should return 0 for token without expiry', () => {
      const tokenWithoutExp = jwt.sign({ sub: 'user123' }, 'secret');

      const result = service.getTokenTimeToExpiry(tokenWithoutExp);

      expect(result).toBe(0);
    });

    it('should return 0 for invalid token', () => {
      const result = service.getTokenTimeToExpiry('invalid-token');

      expect(result).toBe(0);
    });

    it('should handle token about to expire', () => {
      const almostExpiredToken = jwt.sign(
        { exp: Math.floor(Date.now() / 1000) + 5, sub: 'user123' },
        'secret',
      );

      const result = service.getTokenTimeToExpiry(almostExpiredToken);

      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(5);
    });

    it('should handle non-Error thrown during decode', () => {
      jest.spyOn(jwt, 'decode').mockImplementation(() => {
        throw { code: 'INVALID_TOKEN' }; // Throw non-Error object
      });

      const result = service.getTokenTimeToExpiry('any-token');

      expect(result).toBe(0);
      expect(loggerService.warn).toHaveBeenCalledWith(
        expect.stringContaining('Failed to get time to expiry'),
      );
    });
  });

  describe('getUserRolesFromAuthService', () => {
    it('should fetch user roles successfully', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth/login');
      (httpService.get as jest.Mock).mockReturnValue(
        of({ data: { roles: ['admin', 'user'] } }),
      );

      const result = await service.getUserRolesFromAuthService('user123');

      expect(result).toEqual(['admin', 'user']);
      expect(httpService.get).toHaveBeenCalledWith(
        'http://auth-service/users/user123/roles',
        expect.any(Object),
      );
    });

    it('should throw BadRequestException when userId is missing', async () => {
      await expect(service.getUserRolesFromAuthService('')).rejects.toThrow(BadRequestException);
    });

    it('should return empty array when roles is not an array', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      (httpService.get as jest.Mock).mockReturnValue(of({ data: { roles: null } }));

      const result = await service.getUserRolesFromAuthService('user123');

      expect(result).toEqual([]);
    });

    it('should handle 404 error', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      const error = {
        response: { status: 404, statusText: 'Not Found' },
      };
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.getUserRolesFromAuthService('user123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle 500 error with group not found message', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      const error = {
        response: {
          status: 500,
          data: { message: 'No group found with name: roles' },
        },
      };
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.getUserRolesFromAuthService('user123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle 500 error with subgroup not found message', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      const error = {
        response: {
          status: 500,
          data: { error: 'No subgroup found' },
        },
      };
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.getUserRolesFromAuthService('user123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle generic 500 error', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      const error = {
        response: {
          status: 500,
          data: 'Internal server error',
        },
      };
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.getUserRolesFromAuthService('user123')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should encode special characters in userId', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      (httpService.get as jest.Mock).mockReturnValue(of({ data: { roles: [] } }));

      await service.getUserRolesFromAuthService('user@example.com');

      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('user%40example.com'),
        expect.any(Object),
      );
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
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth/login');
      (httpService.get as jest.Mock).mockReturnValue(of({ data: mockUserResponse }));

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
      await expect(service.getUserDetailsFromAuthService('')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException when user has no id', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      (httpService.get as jest.Mock).mockReturnValue(of({ data: {} }));

      await expect(service.getUserDetailsFromAuthService('user123')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should handle missing optional fields', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      (httpService.get as jest.Mock).mockReturnValue(of({ data: { id: 'user123' } }));

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
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      (httpService.get as jest.Mock).mockReturnValue(
        of({ data: { id: 'user123', roles: null } }),
      );

      const result = await service.getUserDetailsFromAuthService('user123');

      expect(result.roles).toEqual([]);
    });

    it('should handle 404 error', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      const error = {
        response: { status: 404 },
      };
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.getUserDetailsFromAuthService('user123')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle error and throw ServiceUnavailableException', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      (httpService.get as jest.Mock).mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      await expect(service.getUserDetailsFromAuthService('user123')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should encode special characters in userId', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      (httpService.get as jest.Mock).mockReturnValue(of({ data: mockUserResponse }));

      await service.getUserDetailsFromAuthService('user@example.com');

      expect(httpService.get).toHaveBeenCalledWith(
        expect.stringContaining('user%40example.com'),
        expect.any(Object),
      );
    });
  });

  describe('userExists', () => {
    it('should return true when user exists', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      (httpService.get as jest.Mock).mockReturnValue(
        of({ data: { id: 'user123', username: 'testuser' } }),
      );

      const result = await service.userExists('user123');

      expect(result).toBe(true);
    });

    it('should return false when user does not exist', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      (httpService.get as jest.Mock).mockReturnValue(
        throwError(() => new Error('User not found')),
      );

      const result = await service.userExists('user123');

      expect(result).toBe(false);
    });

    it('should return false when userId is empty', async () => {
      const result = await service.userExists('');

      expect(result).toBe(false);
    });

    it('should return false on network error', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      (httpService.get as jest.Mock).mockReturnValue(
        throwError(() => new Error('Network error')),
      );

      const result = await service.userExists('user123');

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should throw ServiceUnavailableException when auth URL is not configured', async () => {
      (configService.get as jest.Mock).mockReturnValue(undefined);

      await expect(service.getUserRolesFromAuthService('user123')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should handle error data as string', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      const error = {
        response: {
          status: 500,
          data: 'Internal server error',
        },
      };
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.getUserRolesFromAuthService('user123')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should handle error data as object with message', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      const error = {
        response: {
          status: 500,
          data: { message: 'Custom error message' },
        },
      };
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.getUserRolesFromAuthService('user123')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should handle error without response', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service');
      const error = new Error('Connection refused');
      (httpService.get as jest.Mock).mockReturnValue(throwError(() => error));

      await expect(service.getUserRolesFromAuthService('user123')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('should remove /v1/auth/login suffix from auth URL', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth/login');
      (httpService.get as jest.Mock).mockReturnValue(of({ data: { roles: [] } }));

      await service.getUserRolesFromAuthService('user123');

      expect(httpService.get).toHaveBeenCalledWith(
        'http://auth-service/users/user123/roles',
        expect.any(Object),
      );
    });

    it('should handle auth URL with trailing slash', async () => {
      (configService.get as jest.Mock).mockReturnValue('http://auth-service/v1/auth/login/');
      (httpService.get as jest.Mock).mockReturnValue(of({ data: { roles: [] } }));

      await service.getUserRolesFromAuthService('user123');

      expect(httpService.get).toHaveBeenCalledWith(
        'http://auth-service/users/user123/roles',
        expect.any(Object),
      );
    });
  });
});
