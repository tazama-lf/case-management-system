import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
<<<<<<< HEAD

import { of, throwError } from 'rxjs';
import {
  UnauthorizedException,
  ServiceUnavailableException,
<<<<<<< HEAD
  Logger,
} from '@nestjs/common';

// Suppress Logger.error output during tests
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

// Suppress Logger.error output during tests
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
=======
import { of, throwError } from 'rxjs';
>>>>>>> ac7173e (feat: Test Coverage)
=======
} from '@nestjs/common';
>>>>>>> 4dc8c12 (feat: token refresh functionality implemented)

describe('AuthService', () => {
  let service: AuthService;
  let httpService: any;
  let configService: any;

  const mockHttpService = {
    post: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
<<<<<<< HEAD
=======
    // Set up default mock return values
>>>>>>> ac7173e (feat: Test Coverage)
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'TAZAMA_AUTH_URL') {
        return 'http://auth.example.com/login';
      }
      return undefined;
    });
<<<<<<< HEAD
=======

>>>>>>> ac7173e (feat: Test Coverage)
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    httpService = module.get(HttpService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should successfully login with valid credentials and return token string', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const mockToken = 'jwt-token-123';
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(of({ data: mockToken }));

      const result = await service.login(username, password);

      expect(configService.get).toHaveBeenCalledWith('TAZAMA_AUTH_URL');
      expect(httpService.post).toHaveBeenCalledWith(mockAuthUrl, {
        username,
        password,
      });
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
        expiresIn: null,
      });
<<<<<<< HEAD
=======
      expect(result).toEqual({ token: mockToken });
>>>>>>> ac7173e (feat: Test Coverage)
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
    });

    it('should successfully login and extract token from object response with token property', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const mockToken = 'jwt-token-456';
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(of({ data: { token: mockToken } }));

      const result = await service.login(username, password);

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
        expiresIn: null,
      });
<<<<<<< HEAD
=======
      expect(result).toEqual({ token: mockToken });
>>>>>>> ac7173e (feat: Test Coverage)
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
    });

    it('should successfully login and extract access_token from object response', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const mockToken = 'jwt-token-789';
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(
        of({ data: { access_token: mockToken } }),
      );

      const result = await service.login(username, password);

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
        expiresIn: null,
      });
<<<<<<< HEAD
=======
      expect(result).toEqual({ token: mockToken });
>>>>>>> ac7173e (feat: Test Coverage)
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
    });

    it('should successfully login and extract jwt from object response', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const mockToken = 'jwt-token-abc';
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(of({ data: { jwt: mockToken } }));

      const result = await service.login(username, password);

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
        expiresIn: null,
      });
<<<<<<< HEAD
=======
      expect(result).toEqual({ token: mockToken });
>>>>>>> ac7173e (feat: Test Coverage)
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
    });

    it('should successfully login and extract user.token from nested object response', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const mockToken = 'jwt-token-def';
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(
        of({ data: { user: { token: mockToken } } }),
      );

      const result = await service.login(username, password);

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
        expiresIn: null,
      });
    });

    it('should throw ServiceUnavailableException when TAZAMA_AUTH_URL is not set', async () => {
=======
      expect(result).toEqual({ token: mockToken });
    });

<<<<<<< HEAD
    it('should throw error when TAZAMA_AUTH_URL is not set', async () => {
>>>>>>> ac7173e (feat: Test Coverage)
=======
    it('should throw ServiceUnavailableException when TAZAMA_AUTH_URL is not set', async () => {
>>>>>>> 4dc8c12 (feat: token refresh functionality implemented)
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(undefined);

      await expect(service.login(username, password)).rejects.toThrow(
<<<<<<< HEAD
<<<<<<< HEAD
        ServiceUnavailableException,
=======
        'Authentication service unavailable',
>>>>>>> ac7173e (feat: Test Coverage)
=======
        ServiceUnavailableException,
>>>>>>> 4dc8c12 (feat: token refresh functionality implemented)
      );
      expect(configService.get).toHaveBeenCalledWith('TAZAMA_AUTH_URL');
    });

<<<<<<< HEAD
<<<<<<< HEAD
    it('should throw UnauthorizedException when HTTP request fails with 401', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const username = 'testuser';
      const password = 'testpass';
      const error: any = new Error('Unauthorized');
      error.response = { status: 401 };

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(throwError(() => error));

      await expect(service.login(username, password)).rejects.toThrow(
        UnauthorizedException,
      );
      expect(httpService.post).toHaveBeenCalledWith(mockAuthUrl, {
        username,
        password,
      });
    });

    it('should throw ServiceUnavailableException when HTTP request fails with non-401 error', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const username = 'testuser';
      const password = 'testpass';
      const error: any = new Error('Network error');
      error.response = { status: 500 };

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(throwError(() => error));

      await expect(service.login(username, password)).rejects.toThrow(
        ServiceUnavailableException,
=======
    it('should throw error when HTTP request fails', async () => {
=======
    it('should throw UnauthorizedException when HTTP request fails with 401', async () => {
>>>>>>> 4dc8c12 (feat: token refresh functionality implemented)
      const mockAuthUrl = 'http://auth.example.com/login';
      const username = 'testuser';
      const password = 'testpass';
      const error: any = new Error('Unauthorized');
      error.response = { status: 401 };

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(throwError(() => error));

      await expect(service.login(username, password)).rejects.toThrow(
<<<<<<< HEAD
        'Authentication failed',
>>>>>>> ac7173e (feat: Test Coverage)
=======
        UnauthorizedException,
      );
      expect(httpService.post).toHaveBeenCalledWith(mockAuthUrl, {
        username,
        password,
      });
    });

    it('should throw ServiceUnavailableException when HTTP request fails with non-401 error', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const username = 'testuser';
      const password = 'testpass';
      const error: any = new Error('Network error');
      error.response = { status: 500 };

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(throwError(() => error));

      await expect(service.login(username, password)).rejects.toThrow(
        ServiceUnavailableException,
>>>>>>> 4dc8c12 (feat: token refresh functionality implemented)
      );
      expect(httpService.post).toHaveBeenCalledWith(mockAuthUrl, {
        username,
        password,
      });
    });

    it('should throw error when response does not contain token', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(
        of({ data: { message: 'no token here' } }),
      );

      const result = await service.login(username, password);

      // Should still return with undefined token since the extraction logic returns undefined
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
      expect(result).toEqual({
        message: 'Login successful',
        token: undefined,
        expiresIn: null,
      });
<<<<<<< HEAD
=======
      expect(result).toEqual({ token: undefined });
>>>>>>> ac7173e (feat: Test Coverage)
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
    });

    it('should handle empty response data', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(of({ data: null }));

      const result = await service.login(username, password);

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
      expect(result).toEqual({
        message: 'Login successful',
        token: undefined,
        expiresIn: null,
      });
<<<<<<< HEAD
    });
  });

  describe('isTokenExpired', () => {
    const realDateNow = Date.now;
    afterEach(() => {
      global.Date.now = realDateNow;
    });

    it('should return false if token is not expired', () => {
      // exp in the future
      const future = Math.floor(Date.now() / 1000) + 1000;
      const token = require('jsonwebtoken').sign({ exp: future }, 'secret');
      expect(service.isTokenExpired(token)).toBe(false);
    });

    it('should return true if token is expired', () => {
      // exp in the past
      const past = Math.floor(Date.now() / 1000) - 1000;
      const token = require('jsonwebtoken').sign({ exp: past }, 'secret');
      expect(service.isTokenExpired(token)).toBe(true);
    });

    it('should return true if token has no exp', () => {
      const token = require('jsonwebtoken').sign({ foo: 'bar' }, 'secret');
      expect(service.isTokenExpired(token)).toBe(true);
    });

    it('should return true if token is invalid', () => {
      expect(service.isTokenExpired('invalid.token')).toBe(true);
    });
  });

  describe('getTokenTimeToExpiry', () => {
    const realDateNow = Date.now;
    afterEach(() => {
      global.Date.now = realDateNow;
    });

    it('should return seconds to expiry if token is valid', () => {
      const now = Math.floor(Date.now() / 1000);
      const exp = now + 500;
      const token = require('jsonwebtoken').sign({ exp }, 'secret');
      expect(service.getTokenTimeToExpiry(token)).toBeGreaterThanOrEqual(499);
    });

    it('should return 0 if token is expired', () => {
      const now = Math.floor(Date.now() / 1000);
      const exp = now - 10;
      const token = require('jsonwebtoken').sign({ exp }, 'secret');
      expect(service.getTokenTimeToExpiry(token)).toBe(0);
    });

    it('should return 0 if token has no exp', () => {
      const token = require('jsonwebtoken').sign({ foo: 'bar' }, 'secret');
      expect(service.getTokenTimeToExpiry(token)).toBe(0);
    });

    it('should return 0 if token is invalid', () => {
      expect(service.getTokenTimeToExpiry('invalid.token')).toBe(0);
=======
      expect(result).toEqual({ token: undefined });
>>>>>>> ac7173e (feat: Test Coverage)
=======
>>>>>>> a67b513 (feat: token refresh functionality implemented)
    });
  });
});
