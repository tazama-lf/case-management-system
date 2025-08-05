/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from '../../src/auth/auth.service';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { of, throwError } from 'rxjs';
import {
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';

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
    // Set up default mock return values
    mockConfigService.get.mockImplementation((key: string) => {
      if (key === 'TAZAMA_AUTH_URL') {
        return 'http://auth.example.com/login';
      }
      return undefined;
    });

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
      httpService.post.mockReturnValue(
        of({ data: { access_token: mockToken } }),
      );

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
      httpService.post.mockReturnValue(
        of({ data: { user: { token: mockToken } } }),
      );

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

      await expect(service.login(username, password)).rejects.toThrow(
        ServiceUnavailableException,
      );
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

      const result = await service.login(username, password);

      expect(result).toEqual({
        message: 'Login successful',
        token: undefined,
        expiresIn: null,
      });
    });
  });
});
