import { Test, TestingModule } from '@nestjs/testing';
import { CacheService, UserDetails } from '../src/modules/shared/cache.service';
import { RedisService } from '../src/modules/shared/redis.service';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../src/modules/auth/auth.service';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import { UserGroupDetails } from '../src/utils/types/UserList';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CacheService', () => {
  let service: CacheService;
  let redisService: jest.Mocked<RedisService>;
  let configService: jest.Mocked<ConfigService>;
  let authService: jest.Mocked<AuthService>;

  const mockUserGroupDetails: UserGroupDetails[] = [
    {
      id: 'user-1',
      username: 'john.doe',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      enabled: true,
      emailVerified: true,
      createdTimestamp: Date.now() - 86400000,
      totp: false,
      disableableCredentialTypes: [],
      requiredActions: [],
      notBefore: 0,
    },
    {
      id: 'user-2',
      username: 'jane.smith',
      email: 'jane.smith@example.com',
      firstName: 'Jane',
      lastName: 'Smith',
      enabled: true,
      emailVerified: true,
      createdTimestamp: Date.now() - 86400000,
      totp: false,
      disableableCredentialTypes: [],
      requiredActions: [],
      notBefore: 0,
    },
  ];

  const mockCachedUserDetails: UserDetails = {
    id: 'user-1',
    username: 'john.doe',
    firstName: 'John',
    lastName: 'Doe',
    fullName: 'John Doe',
    email: 'john.doe@example.com',
    roles: ['CMS_INVESTIGATOR'],
  };

  beforeEach(async () => {
    jest.clearAllTimers();
    jest.useRealTimers(); // Use real timers by default

    const mockRedisService = {
      isConnected: jest.fn(),
      get: jest.fn(),
      mget: jest.fn(),
      mset: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockImplementation((key: string) => {
        const config = {
          TAZAMA_AUTH_URL: 'http://auth.example.com',
          TAZAMA_AUTH_ADMIN_USERNAME: 'admin',
          TAZAMA_AUTH_ADMIN_PASSWORD: 'password',
          KEYCLOAK_GROUP_NAME: 'test-group',
        };
        return config[key];
      }),
    };

    const mockAuthService = {
      login: jest.fn(),
      getUserDetailsFromAuthService: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CacheService,
        {
          provide: RedisService,
          useValue: mockRedisService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    redisService = module.get(RedisService);
    configService = module.get(ConfigService);
    authService = module.get(AuthService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    jest.spyOn(Logger.prototype, 'debug').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.useRealTimers();
  });

  describe('onModuleInit', () => {
    it('should log initialization message', async () => {
      jest.useFakeTimers();
      redisService.isConnected.mockReturnValue(false);

      await service.onModuleInit();

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Initializing CMS cache...',
        'CacheService',
      );

      jest.runAllTimers();
      jest.useRealTimers();
    });

    it('should handle initialization error without throwing', async () => {
      jest.useFakeTimers();
      redisService.isConnected.mockImplementation(() => {
        throw new Error('Connection error');
      });

      await expect(service.onModuleInit()).resolves.not.toThrow();

      jest.runAllTimers();
      jest.useRealTimers();
    });

    it('should log warning when initialization fails', async () => {
      jest.useFakeTimers();
      const error = new Error('Init failed');
      redisService.isConnected.mockImplementation(() => {
        throw error;
      });

      await service.onModuleInit();
      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        expect.stringContaining('Init failed'),
        'CacheService',
      );

      jest.useRealTimers();
    });
  });

  describe('initializeUserCache', () => {
    it('should initialize cache with users from both roles', async () => {
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockResolvedValue({ token: 'test-token' } as any);
      mockedAxios.get
        .mockResolvedValueOnce({ data: [mockUserGroupDetails[0]] })
        .mockResolvedValueOnce({ data: [mockUserGroupDetails[1]] });
      redisService.mset.mockResolvedValue(undefined);

      await (service as any).initializeUserCache();

      expect(authService.login).toHaveBeenCalledWith('admin', 'password');
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://auth.example.com/user/CMS_INVESTIGATOR?groupName=test-group',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
      
      // Verify cache was populated with correct user data
      expect(redisService.mset).toHaveBeenCalled();
      const cachedData = (redisService.mset as jest.Mock).mock.calls[0][0];
      expect(cachedData).toBeDefined();
      expect(Object.keys(cachedData).length).toBeGreaterThan(0);
      
      // Verify both users are cached
      const userIds = Object.keys(cachedData).map(key => key.split(':')[2]);
      expect(userIds).toContain('user-1');
      expect(userIds).toContain('user-2');
    });

    it('should skip initialization when Redis is not connected', async () => {
      redisService.isConnected.mockReturnValue(false);

      await (service as any).initializeUserCache(3); // Start with max retries

      expect(authService.login).not.toHaveBeenCalled();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Redis not connected after retries, skipping cache initialization',
        'CacheService',
      );
    });

    it('should retry when Redis is not connected', async () => {
      jest.useFakeTimers();
      redisService.isConnected.mockReturnValue(false);

      await (service as any).initializeUserCache(0);

      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Redis not connected',
        'CacheService',
      );

      jest.useRealTimers();
    });

    it('should stop retrying after max retries', async () => {
      redisService.isConnected.mockReturnValue(false);

      await (service as any).initializeUserCache(3);

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Redis not connected after retries, skipping cache initialization',
        'CacheService',
      );
    });

    it('should log error when fetching users for a role fails', async () => {
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockResolvedValue({ token: 'test-token' } as any);
      mockedAxios.get
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({ data: [mockUserGroupDetails[1]] });
      redisService.mset.mockResolvedValue(undefined);

      await (service as any).initializeUserCache();

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to fetch users with role CMS_INVESTIGATOR: API error',
        'CacheService',
      );
      expect(redisService.mset).toHaveBeenCalled(); // Should still cache second role
    });

    it('should warn when no users are fetched', async () => {
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockResolvedValue({ token: 'test-token' } as any);
      mockedAxios.get.mockResolvedValue({ data: [] });

      await (service as any).initializeUserCache();

      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'No users fetched for caching',
        'CacheService',
      );
      expect(redisService.mset).not.toHaveBeenCalled();
    });

    it('should set cache TTL to 720 hours (30 days)', async () => {
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockResolvedValue({ token: 'test-token' } as any);
      mockedAxios.get.mockResolvedValue({ data: [mockUserGroupDetails[0]] });
      redisService.mset.mockResolvedValue(undefined);

      await (service as any).initializeUserCache();

      expect(redisService.mset).toHaveBeenCalledWith(
        expect.any(Object),
        2592000, // 720 * 3600 seconds
      );
    });

    it('should handle errors during cache initialization', async () => {
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockRejectedValue(new Error('Auth failed'));

      await (service as any).initializeUserCache();

      // Login errors are caught per-role and logged as errors
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to fetch users with role CMS_INVESTIGATOR: Auth failed',
        'CacheService',
      );
      // Since no users were fetched from any role, should warn about empty cache
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'No users fetched for caching',
        'CacheService',
      );
    });

    it('should create correct cache keys with prefix', async () => {
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockResolvedValue({ token: 'test-token' } as any);
      mockedAxios.get.mockResolvedValue({ data: [mockUserGroupDetails[0]] });
      redisService.mset.mockResolvedValue(undefined);

      await (service as any).initializeUserCache();

      expect(redisService.mset).toHaveBeenCalledWith(
        expect.objectContaining({
          'cms:users:user-1': expect.objectContaining({
            id: 'user-1',
            username: 'john.doe',
            email: 'john.doe@example.com',
          }),
        }),
        expect.any(Number),
      );
    });

    it('should trim user full names', async () => {
      const userWithSpaces = {
        ...mockUserGroupDetails[0],
        firstName: '  John  ',
        lastName: '  Doe  ',
      };
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockResolvedValue({ token: 'test-token' } as any);
      mockedAxios.get.mockResolvedValue({ data: [userWithSpaces] });
      redisService.mset.mockResolvedValue(undefined);

      await (service as any).initializeUserCache();

      expect(redisService.mset).toHaveBeenCalledWith(
        expect.objectContaining({
          'cms:users:user-1': expect.objectContaining({
            fullName: 'John     Doe',
          }),
        }),
        expect.any(Number),
      );
    });

    it('should mark cache as initialized after successful setup', async () => {
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockResolvedValue({ token: 'test-token' } as any);
      mockedAxios.get.mockResolvedValue({ data: [mockUserGroupDetails[0]] });
      redisService.mset.mockResolvedValue(undefined);

      expect(service.isCacheAvailable()).toBe(false);

      await (service as any).initializeUserCache();

      expect(service.isCacheAvailable()).toBe(true);
    });

    it('should set cacheInitialized to false on error', async () => {
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockRejectedValue(new Error('Failed'));

      await (service as any).initializeUserCache();

      expect(service.isCacheAvailable()).toBe(false);
    });
  });

  describe('getUsersByRole', () => {
    it('should fetch users by role from auth API', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockUserGroupDetails });

      const users = await service.getUsersByRole('test-token', 'CMS_INVESTIGATOR', 'tenant-1');

      expect(users).toEqual(mockUserGroupDetails);
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://auth.example.com/user/CMS_INVESTIGATOR?groupName=tenant-1',
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer test-token',
          },
        },
      );
    });

    it('should include authorization header with token', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });

      await service.getUsersByRole('my-token', 'CMS_SUPERVISOR', 'tenant-2');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer my-token',
          }),
        }),
      );
    });

    it('should log the role being fetched', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });

      await service.getUsersByRole('token', 'CMS_INVESTIGATOR', 'tenant');

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Fetching users with role: CMS_INVESTIGATOR',
      );
    });

    it('should handle API errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API error'));

      await expect(
        service.getUsersByRole('token', 'CMS_INVESTIGATOR', 'tenant'),
      ).rejects.toThrow('API error');
    });
  });

  describe('refreshUserCache', () => {
    it('should call initializeUserCache', async () => {
      const initSpy = jest.spyOn(service as any, 'initializeUserCache').mockResolvedValue(undefined);

      await service.refreshUserCache();

      expect(initSpy).toHaveBeenCalled();
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Refreshing user cache...',
        'CacheService',
      );
    });

    it('should propagate errors from initializeUserCache', async () => {
      jest.spyOn(service as any, 'initializeUserCache').mockRejectedValue(new Error('Init failed'));

      await expect(service.refreshUserCache()).rejects.toThrow('Init failed');
    });
  });

  describe('getUserFromCache', () => {
    it('should return user details from cache when found', async () => {
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(mockCachedUserDetails);

      const user = await service.getUserFromCache('user-1');

      expect(user).toEqual(mockCachedUserDetails);
      expect(redisService.get).toHaveBeenCalledWith('cms:users:user-1', true);
    });

    it('should return null when user not found in cache', async () => {
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(null);

      const user = await service.getUserFromCache('user-999');

      expect(user).toBeNull();
      expect(Logger.prototype.debug).toHaveBeenCalledWith(
        'User user-999 not found in Redis cache',
        'CacheService',
      );
    });

    it('should return null when Redis is not connected', async () => {
      redisService.isConnected.mockReturnValue(false);

      const user = await service.getUserFromCache('user-1');

      expect(user).toBeNull();
      expect(Logger.prototype.debug).toHaveBeenCalledWith(
        'Redis not connected, cache unavailable',
        'CacheService',
      );
      expect(redisService.get).not.toHaveBeenCalled();
    });

    it('should return null and log warning on error', async () => {
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockRejectedValue(new Error('Redis error'));

      const user = await service.getUserFromCache('user-1');

      expect(user).toBeNull();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Error getting user user-1 from cache: Redis error',
        'CacheService',
      );
    });

    it('should log debug message when user found', async () => {
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(mockCachedUserDetails);

      await service.getUserFromCache('user-1');

      expect(Logger.prototype.debug).toHaveBeenCalledWith(
        'User user-1 found in Redis cache',
        'CacheService',
      );
    });
  });

  describe('getUserEmailFromCache', () => {
    it('should return user email when user found in cache', async () => {
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(mockCachedUserDetails);

      const email = await service.getUserEmailFromCache('user-1');

      expect(email).toBe('john.doe@example.com');
    });

    it('should return null when user not found in cache', async () => {
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(null);

      const email = await service.getUserEmailFromCache('user-999');

      expect(email).toBeNull();
    });

    it('should return null when Redis is not connected', async () => {
      redisService.isConnected.mockReturnValue(false);

      const email = await service.getUserEmailFromCache('user-1');

      expect(email).toBeNull();
    });

    it('should handle user with no email', async () => {
      const userWithoutEmail = { ...mockCachedUserDetails, email: '' };
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(userWithoutEmail);

      const email = await service.getUserEmailFromCache('user-1');

      expect(email).toBeNull();
    });
  });

  describe('getUserFullNameFromCache', () => {
    it('should return full name when user found in cache', async () => {
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(mockCachedUserDetails);

      const fullName = await service.getUserFullNameFromCache('user-1');

      expect(fullName).toBe('John Doe');
    });

    it('should return null when user not found in cache', async () => {
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(null);

      const fullName = await service.getUserFullNameFromCache('user-999');

      expect(fullName).toBeNull();
    });

    it('should trim whitespace from full name', async () => {
      const userWithSpaces = {
        ...mockCachedUserDetails,
        firstName: '  John  ',
        lastName: '  Doe  ',
      };
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(userWithSpaces);

      const fullName = await service.getUserFullNameFromCache('user-1');

      expect(fullName).toBe('John     Doe');
    });

    it('should handle user with only first name', async () => {
      const userFirstNameOnly = {
        ...mockCachedUserDetails,
        firstName: 'John',
        lastName: '',
      };
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(userFirstNameOnly);

      const fullName = await service.getUserFullNameFromCache('user-1');

      expect(fullName).toBe('John');
    });

    it('should handle user with only last name', async () => {
      const userLastNameOnly = {
        ...mockCachedUserDetails,
        firstName: '',
        lastName: 'Doe',
      };
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(userLastNameOnly);

      const fullName = await service.getUserFullNameFromCache('user-1');

      expect(fullName).toBe('Doe');
    });
  });

  describe('getBatchUserEmailsFromCache', () => {
    it('should return email map for all cached users', async () => {
      const user1 = { ...mockCachedUserDetails, id: 'user-1', email: 'user1@example.com' };
      const user2 = { ...mockCachedUserDetails, id: 'user-2', email: 'user2@example.com' };
      redisService.isConnected.mockReturnValue(true);
      redisService.mget.mockResolvedValue({
        'cms:users:user-1': user1,
        'cms:users:user-2': user2,
      });

      const emailMap = await service.getBatchUserEmailsFromCache(['user-1', 'user-2']);

      expect(emailMap.size).toBe(2);
      expect(emailMap.get('user-1')).toBe('user1@example.com');
      expect(emailMap.get('user-2')).toBe('user2@example.com');
    });

    it('should exclude users not found in cache', async () => {
      const user1 = { ...mockCachedUserDetails, id: 'user-1', email: 'user1@example.com' };
      redisService.isConnected.mockReturnValue(true);
      redisService.mget.mockResolvedValue({
        'cms:users:user-1': user1,
        'cms:users:user-2': null,
      });

      const emailMap = await service.getBatchUserEmailsFromCache(['user-1', 'user-2']);

      expect(emailMap.size).toBe(1);
      expect(emailMap.get('user-1')).toBe('user1@example.com');
      expect(emailMap.has('user-2')).toBe(false);
    });

    it('should return empty map when Redis is not connected', async () => {
      redisService.isConnected.mockReturnValue(false);

      const emailMap = await service.getBatchUserEmailsFromCache(['user-1', 'user-2']);

      expect(emailMap.size).toBe(0);
      expect(redisService.mget).not.toHaveBeenCalled();
    });

    it('should return empty map for empty user array', async () => {
      redisService.isConnected.mockReturnValue(true);

      const emailMap = await service.getBatchUserEmailsFromCache([]);

      expect(emailMap.size).toBe(0);
    });

    it('should handle errors during batch lookup', async () => {
      redisService.isConnected.mockReturnValue(true);
      redisService.mget.mockRejectedValue(new Error('Redis error'));

      const emailMap = await service.getBatchUserEmailsFromCache(['user-1', 'user-2']);

      expect(emailMap.size).toBe(0);
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Error during batch cache lookup: Redis error',
        'CacheService',
      );
    });

    it('should skip users with no email', async () => {
      const user1 = { ...mockCachedUserDetails, id: 'user-1', email: 'user1@example.com' };
      const user2 = { ...mockCachedUserDetails, id: 'user-2', email: '' };
      redisService.isConnected.mockReturnValue(true);
      redisService.mget.mockResolvedValue({
        'cms:users:user-1': user1,
        'cms:users:user-2': user2,
      });

      const emailMap = await service.getBatchUserEmailsFromCache(['user-1', 'user-2']);

      expect(emailMap.size).toBe(1);
      expect(emailMap.get('user-1')).toBe('user1@example.com');
      expect(emailMap.has('user-2')).toBe(false);
    });

    it('should log debug message with found count', async () => {
      const user1 = { ...mockCachedUserDetails, id: 'user-1', email: 'user1@example.com' };
      redisService.isConnected.mockReturnValue(true);
      redisService.mget.mockResolvedValue({
        'cms:users:user-1': user1,
        'cms:users:user-2': null,
        'cms:users:user-3': null,
      });

      await service.getBatchUserEmailsFromCache(['user-1', 'user-2', 'user-3']);

      expect(Logger.prototype.debug).toHaveBeenCalledWith(
        'Found 1 users in cache out of 3 requested',
        'CacheService',
      );
    });

    it('should call mget with correct cache keys', async () => {
      redisService.isConnected.mockReturnValue(true);
      redisService.mget.mockResolvedValue({});

      await service.getBatchUserEmailsFromCache(['user-1', 'user-2']);

      expect(redisService.mget).toHaveBeenCalledWith(
        ['cms:users:user-1', 'cms:users:user-2'],
        true,
      );
    });
  });

  describe('isCacheAvailable', () => {
    it('should return true when cache is initialized and Redis is connected', async () => {
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockResolvedValue({ token: 'test-token' } as any);
      mockedAxios.get.mockResolvedValue({ data: [mockUserGroupDetails[0]] });
      redisService.mset.mockResolvedValue(undefined);

      await (service as any).initializeUserCache();

      expect(service.isCacheAvailable()).toBe(true);
    });

    it('should return false when cache is not initialized', async () => {
      redisService.isConnected.mockReturnValue(true);

      expect(service.isCacheAvailable()).toBe(false);
    });

    it('should return false when Redis is not connected', async () => {
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockResolvedValue({ token: 'test-token' } as any);
      mockedAxios.get.mockResolvedValue({ data: [mockUserGroupDetails[0]] });
      redisService.mset.mockResolvedValue(undefined);

      await (service as any).initializeUserCache();

      redisService.isConnected.mockReturnValue(false);

      expect(service.isCacheAvailable()).toBe(false);
    });

    it('should return false when initialization failed', async () => {
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockRejectedValue(new Error('Failed'));

      await (service as any).initializeUserCache();

      expect(service.isCacheAvailable()).toBe(false);
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete initialization flow', async () => {
      jest.useFakeTimers();
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockResolvedValue({ token: 'test-token' } as any);
      mockedAxios.get
        .mockResolvedValueOnce({ data: [mockUserGroupDetails[0]] })
        .mockResolvedValueOnce({ data: [mockUserGroupDetails[1]] });
      redisService.mset.mockResolvedValue(undefined);

      await service.onModuleInit();
      jest.advanceTimersByTime(2000);
      await Promise.resolve();

      expect(Logger.prototype.log).toHaveBeenCalledWith(
        'Initializing CMS cache...',
        'CacheService',
      );

      jest.useRealTimers();
    });

    it('should cache users with correct structure', async () => {
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockResolvedValue({ token: 'test-token' } as any);
      mockedAxios.get.mockResolvedValue({ data: [mockUserGroupDetails[0]] });
      redisService.mset.mockResolvedValue(undefined);

      await (service as any).initializeUserCache();

      expect(redisService.mset).toHaveBeenCalledWith(
        expect.objectContaining({
          'cms:users:user-1': expect.objectContaining({
            id: 'user-1',
            username: 'john.doe',
            firstName: 'John',
            lastName: 'Doe',
            fullName: 'John Doe',
            email: 'john.doe@example.com',
 }),
        }),
        2592000,
      );
    });

    it('should handle mixed success and failure in batch operations', async () => {
      const user1 = { ...mockCachedUserDetails, id: 'user-1', email: 'user1@example.com' };
      redisService.isConnected.mockReturnValue(true);
      redisService.mget.mockResolvedValue({
        'cms:users:user-1': user1,
        'cms:users:user-2': null,
        'cms:users:user-3': { ...mockCachedUserDetails, id: 'user-3', email: '' },
      });

      const emailMap = await service.getBatchUserEmailsFromCache(['user-1', 'user-2', 'user-3']);

      expect(emailMap.size).toBe(1);
      expect(emailMap.get('user-1')).toBe('user1@example.com');
    });
  });

  describe('Configuration', () => {
    it('should use configured TAZAMA_AUTH_URL', async () => {
      // Create a new service instance with custom config
      const customConfigService = {
        get: jest.fn().mockImplementation((key: string) => {
          if (key === 'TAZAMA_AUTH_URL') return 'http://custom-auth.com';
          if (key === 'KEYCLOAK_GROUP_NAME') return 'group';
          return '';
        }),
      };

      const customModule = await Test.createTestingModule({
        providers: [
          CacheService,
          {
            provide: RedisService,
            useValue: redisService,
          },
          {
            provide: ConfigService,
            useValue: customConfigService,
          },
          {
            provide: AuthService,
            useValue: authService,
          },
        ],
      }).compile();

      const customService = customModule.get<CacheService>(CacheService);
      mockedAxios.get.mockResolvedValue({ data: [] });

      await customService.getUsersByRole('token', 'ROLE', 'tenant');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://custom-auth.com/user/ROLE?groupName=tenant',
        expect.any(Object),
      );
    });

    it('should use configured admin credentials', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TAZAMA_AUTH_ADMIN_USERNAME') return 'custom-admin';
        if (key === 'TAZAMA_AUTH_ADMIN_PASSWORD') return 'custom-password';
        return '';
      });
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockResolvedValue({ token: 'token' } as any);
      mockedAxios.get.mockResolvedValue({ data: [] });

      await (service as any).initializeUserCache();

      expect(authService.login).toHaveBeenCalledWith('custom-admin', 'custom-password');
    });

    it('should handle missing configuration values', async () => {
      configService.get.mockReturnValue('');
      redisService.isConnected.mockReturnValue(true);
      authService.login.mockResolvedValue({ token: 'token' } as any);
      mockedAxios.get.mockResolvedValue({ data: [] });

      await (service as any).initializeUserCache();

      expect(authService.login).toHaveBeenCalledWith('', '');
    });
  });
});
