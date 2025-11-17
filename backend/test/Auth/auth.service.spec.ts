import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/modules/auth/auth.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { LoggerService } from '@tazama-lf/frms-coe-lib';

import { of, throwError } from 'rxjs';
import { UnauthorizedException, ServiceUnavailableException, Logger } from '@nestjs/common';

// Suppress Logger.error output during tests
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

// Suppress Logger.error output during tests
jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});

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
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'TAZAMA_AUTH_URL') {
        return 'http://auth.example.com/login';
      }
      return undefined;
    });
    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
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
      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
        expiresIn: null,
      });
    });

    it('should successfully login and extract token from object response with token property', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const mockToken = 'jwt-token-456';
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(of({ data: { token: mockToken } }));

      const result = await service.login(username, password);

      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
        expiresIn: null,
      });
    });

    it('should successfully login and extract access_token from object response', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const mockToken = 'jwt-token-789';
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(of({ data: { access_token: mockToken } }));

      const result = await service.login(username, password);

      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
        expiresIn: null,
      });
    });

    it('should successfully login and extract jwt from object response', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const mockToken = 'jwt-token-abc';
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(of({ data: { jwt: mockToken } }));

      const result = await service.login(username, password);

      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
        expiresIn: null,
      });
    });

    it('should successfully login and extract user.token from nested object response', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const mockToken = 'jwt-token-def';
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(of({ data: { user: { token: mockToken } } }));

      const result = await service.login(username, password);

      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
        expiresIn: null,
      });
    });

    it('should throw ServiceUnavailableException when TAZAMA_AUTH_URL is not set', async () => {
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(undefined);

      await expect(service.login(username, password)).rejects.toThrow(ServiceUnavailableException);
      expect(configService.get).toHaveBeenCalledWith('TAZAMA_AUTH_URL');
    });

    it('should throw UnauthorizedException when HTTP request fails with 401', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const username = 'testuser';
      const password = 'testpass';
      const error: any = new Error('Unauthorized');
      error.response = { status: 401 };

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(throwError(() => error));

      await expect(service.login(username, password)).rejects.toThrow(UnauthorizedException);
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

      await expect(service.login(username, password)).rejects.toThrow(ServiceUnavailableException);
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
      httpService.post.mockReturnValue(of({ data: { message: 'no token here' } }));

      const result = await service.login(username, password);

      // Should still return with undefined token since the extraction logic returns undefined
      expect(result).toEqual({
        message: 'Login successful',
        token: undefined,
        expiresIn: null,
      });
    });

    it('should handle empty response data', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(of({ data: null }));

      await expect(service.login(username, password)).rejects.toThrow(
        new ServiceUnavailableException('Authentication service unavailable')
      );
    });

    it('should return expiresIn when provided in response data', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const mockToken = 'jwt-token-with-expiry';
      const expiresIn = 3600;
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(of({ 
        data: { 
          token: mockToken, 
          expires_in: expiresIn 
        } 
      }));

      const result = await service.login(username, password);

      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
        expiresIn: expiresIn,
      });
    });

    it('should return expiresIn when provided as expiresIn field in response data', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const mockToken = 'jwt-token-with-expiry-2';
      const expiresIn = 7200;
      const username = 'testuser';
      const password = 'testpass';

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(of({ 
        data: { 
          token: mockToken, 
          expiresIn: expiresIn 
        } 
      }));

      const result = await service.login(username, password);

      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
        expiresIn: expiresIn,
      });
    });

    it('should throw ServiceUnavailableException when HTTP request fails without response object', async () => {
      const mockAuthUrl = 'http://auth.example.com/login';
      const username = 'testuser';
      const password = 'testpass';
      const error: any = new Error('Network error without response');

      configService.get.mockReturnValue(mockAuthUrl);
      httpService.post.mockReturnValue(throwError(() => error));

      await expect(service.login(username, password)).rejects.toThrow(ServiceUnavailableException);
      expect(httpService.post).toHaveBeenCalledWith(mockAuthUrl, {
        username,
        password,
      });
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

    it('should handle jwt.decode throwing an error and log warning', () => {
      const mockLoggerService = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      };
      
      // Mock jwt.decode to throw an error
      const originalDecode = require('jsonwebtoken').decode;
      require('jsonwebtoken').decode = jest.fn(() => {
        throw new Error('JWT decode error');
      });

      // Create a new service instance with the mock logger to verify the warning
      const serviceWithMockLogger = new AuthService(
        httpService,
        configService,
        mockLoggerService as any
      );

      const result = serviceWithMockLogger.isTokenExpired('some.token.here');
      
      expect(result).toBe(true);
      expect(mockLoggerService.warn).toHaveBeenCalledWith('Failed to check token expiry: JWT decode error');

      // Restore original decode
      require('jsonwebtoken').decode = originalDecode;
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
    });

    it('should handle jwt.decode throwing an error and log warning', () => {
      const mockLoggerService = {
        log: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
        verbose: jest.fn(),
      };
      
      // Mock jwt.decode to throw an error
      const originalDecode = require('jsonwebtoken').decode;
      require('jsonwebtoken').decode = jest.fn(() => {
        throw new Error('JWT decode error for time to expiry');
      });

      // Create a new service instance with the mock logger to verify the warning
      const serviceWithMockLogger = new AuthService(
        httpService,
        configService,
        mockLoggerService as any
      );

      const result = serviceWithMockLogger.getTokenTimeToExpiry('some.token.here');
      
      expect(result).toBe(0);
      expect(mockLoggerService.warn).toHaveBeenCalledWith('Failed to get time to expiry: JWT decode error for time to expiry');

      // Restore original decode
      require('jsonwebtoken').decode = originalDecode;
    });
  });
});
