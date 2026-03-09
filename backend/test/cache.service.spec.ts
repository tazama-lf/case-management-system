import { Test, TestingModule } from '@nestjs/testing';
import { CacheService, UserDetails } from '../src/modules/shared/cache.service';
import { RedisService } from '../src/modules/shared/redis.service';
import { ConfigService } from '@nestjs/config';
import { Logger } from '@nestjs/common';
import axios from 'axios';
import { UserGroupDetails } from '../src/utils/types/UserList';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('CacheService', () => {
  let service: CacheService;
  let redisService: jest.Mocked<RedisService>;
  let configService: jest.Mocked<ConfigService>;

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

  // Helper function to setup successful cache initialization
  const setupSuccessfulInit = () => {
    redisService.isConnected.mockReturnValue(true);
    mockedAxios.get.mockResolvedValue({ data: [mockUserGroupDetails[0]] });
    redisService.mset.mockResolvedValue(undefined);
  };

  // Helper function to setup Redis mock
  const setupRedisMock = () => ({
    isConnected: jest.fn(),
    get: jest.fn(),
    mget: jest.fn(),
    mset: jest.fn(),
  });

  // Helper function to setup ConfigService mock
  const setupConfigMock = () => ({
    get: jest.fn().mockImplementation((key: string) => {
      const config = {
        TAZAMA_AUTH_URL: 'http://auth.example.com',
        KEYCLOAK_GROUP_NAME: 'test-group',
      };
      return config[key];
    }),
  });

  beforeEach(async () => {
    jest.clearAllTimers();
    jest.useRealTimers();

    const mockRedisService = setupRedisMock();
    const mockConfigService = setupConfigMock();

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
      ],
    }).compile();

    service = module.get<CacheService>(CacheService);
    redisService = module.get(RedisService);
    configService = module.get(ConfigService);

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

  describe('initializeUserCache', () => {
    it('should initialize cache with users from all roles', async () => {
      setupSuccessfulInit();

      await service.initializeUserCache(0, 'test-token');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://auth.example.com/user/CMS_INVESTIGATOR?groupName=test-group',
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: 'Bearer test-token',
          }),
        }),
      );
      expect(redisService.mset).toHaveBeenCalled();
      const cachedData = (redisService.mset as jest.Mock).mock.calls[0][0];
      expect(cachedData).toBeDefined();
      expect(Object.keys(cachedData).length).toBeGreaterThan(0);
    });

    it('should set cache TTL to 720 hours (30 days)', async () => {
      setupSuccessfulInit();

      await service.initializeUserCache(0, 'test-token');

      expect(redisService.mset).toHaveBeenCalledWith(
        expect.any(Object),
        2592000, // 720 * 3600 seconds
      );
    });

    it('should create correct cache keys with prefix', async () => {
      setupSuccessfulInit();

      await service.initializeUserCache(0, 'test-token');

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

    it('should trim user full names correctly', async () => {
      const userWithSpaces = {
        ...mockUserGroupDetails[0],
        firstName: '  John  ',
        lastName: '  Doe  ',
      };
      redisService.isConnected.mockReturnValue(true);
      mockedAxios.get.mockResolvedValue({ data: [userWithSpaces] });
      redisService.mset.mockResolvedValue(undefined);

      await service.initializeUserCache(0, 'test-token');

      expect(redisService.mset).toHaveBeenCalledWith(
        expect.objectContaining({
          'cms:users:user-1': expect.objectContaining({
            fullName: 'John     Doe',
          }),
        }),
        expect.any(Number),
      );
    });

    it('should cache multiple users from different roles', async () => {
      redisService.isConnected.mockReturnValue(true);
      mockedAxios.get
        .mockResolvedValueOnce({ data: [mockUserGroupDetails[0]] })
        .mockResolvedValueOnce({ data: [mockUserGroupDetails[1]] })
        .mockResolvedValueOnce({ data: [] });
      redisService.mset.mockResolvedValue(undefined);

      await service.initializeUserCache(0, 'test-token');

      expect(mockedAxios.get).toHaveBeenCalledTimes(3); // 3 roles
      expect(redisService.mset).toHaveBeenCalled();
      const cachedData = (redisService.mset as jest.Mock).mock.calls[0][0];
      const userIds = Object.keys(cachedData).map((key) => key.split(':')[2]);
      expect(userIds).toContain('user-1');
      expect(userIds).toContain('user-2');
    });

    it('should skip initialization when Redis is not connected at max retries', async () => {
      redisService.isConnected.mockReturnValue(false);

      await service.initializeUserCache(3, 'test-token');

      expect(mockedAxios.get).not.toHaveBeenCalled();
      expect(Logger.prototype.warn).toHaveBeenCalledWith(
        'Redis not connected after retries, skipping cache initialization',
        'CacheService',
      );
    });

    it('should retry when Redis is not connected', async () => {
      jest.useFakeTimers();
      redisService.isConnected.mockReturnValue(false);
      const initSpy = jest.spyOn(service, 'initializeUserCache');

      await service.initializeUserCache(0, 'test-token');

      jest.advanceTimersByTime(3000);
      await Promise.resolve();

      expect(Logger.prototype.log).toHaveBeenCalledWith('Redis not connected', 'CacheService');

      jest.useRealTimers();
    });

    it('should log error when fetching users for a role fails', async () => {
      redisService.isConnected.mockReturnValue(true);
      mockedAxios.get
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({ data: [mockUserGroupDetails[1]] })
        .mockResolvedValueOnce({ data: [] });
      redisService.mset.mockResolvedValue(undefined);

      await service.initializeUserCache(0, 'test-token');

      expect(Logger.prototype.error).toHaveBeenCalledWith('Failed to fetch users with role CMS_INVESTIGATOR: API error', 'CacheService');
      expect(redisService.mset).toHaveBeenCalled();
    });

    it('should warn when no users are fetched', async () => {
      redisService.isConnected.mockReturnValue(true);
      mockedAxios.get.mockResolvedValue({ data: [] });

      await service.initializeUserCache(0, 'test-token');

      expect(Logger.prototype.warn).toHaveBeenCalledWith('No users fetched for caching', 'CacheService');
      expect(redisService.mset).not.toHaveBeenCalled();
    });

    it('should log initialization message', async () => {
      setupSuccessfulInit();

      await service.initializeUserCache(0, 'test-token');

      expect(Logger.prototype.log).toHaveBeenCalledWith('InitializeUserCache called (attempt 1/4)', 'CacheService');
    });

    it('should handle errors during login gracefully', async () => {
      redisService.isConnected.mockReturnValue(true);
      mockedAxios.get.mockRejectedValue(new Error('Auth failed'));

      await service.initializeUserCache(0, 'test-token');

      expect(Logger.prototype.error).toHaveBeenCalledWith(expect.stringContaining('Auth failed'), 'CacheService');
    });
  });

  describe('getUsersByRole', () => {
    it('should fetch users by role from auth API', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockUserGroupDetails });

      const users = await service.getUsersByRole('test-token', 'CMS_INVESTIGATOR', 'tenant-1');

      expect(users).toEqual(mockUserGroupDetails);
      expect(mockedAxios.get).toHaveBeenCalledWith('http://auth.example.com/user/CMS_INVESTIGATOR?groupName=tenant-1', {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer test-token',
        },
      });
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

      expect(Logger.prototype.log).toHaveBeenCalledWith('Fetching users with role: CMS_INVESTIGATOR');
    });

    it('should handle API errors', async () => {
      mockedAxios.get.mockRejectedValue(new Error('API error'));

      await expect(service.getUsersByRole('token', 'CMS_INVESTIGATOR', 'tenant')).rejects.toThrow('API error');
    });

    it('should use configured TAZAMA_AUTH_URL', async () => {
      configService.get.mockImplementation((key: string) => {
        if (key === 'TAZAMA_AUTH_URL') return 'http://custom-auth.com';
        return '';
      });
      const customModule = await Test.createTestingModule({
        providers: [
          CacheService,
          {
            provide: RedisService,
            useValue: redisService,
          },
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();
      const customService = customModule.get<CacheService>(CacheService);
      mockedAxios.get.mockResolvedValue({ data: [] });

      await customService.getUsersByRole('token', 'ROLE', 'tenant');

      expect(mockedAxios.get).toHaveBeenCalledWith('http://custom-auth.com/user/ROLE?groupName=tenant', expect.any(Object));
    });
  });

  describe('getUserFromCache', () => {
    it('should return user details from cache when found', async () => {
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(mockCachedUserDetails);

      const user = await service.getUserFromCache('user-1');

      expect(user).toEqual(mockCachedUserDetails);
      expect(redisService.get).toHaveBeenCalledWith('cms:users:user-1', true);
      expect(Logger.prototype.debug).toHaveBeenCalledWith('User user-1 found in Redis cache', 'CacheService');
    });

    it('should return null when user not found in cache', async () => {
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(null);

      const user = await service.getUserFromCache('user-999');

      expect(user).toBeNull();
      expect(Logger.prototype.debug).toHaveBeenCalledWith('User user-999 not found in Redis cache', 'CacheService');
    });

    it('should return null when Redis is not connected', async () => {
      redisService.isConnected.mockReturnValue(false);

      const user = await service.getUserFromCache('user-1');

      expect(user).toBeNull();
      expect(Logger.prototype.debug).toHaveBeenCalledWith('Redis not connected, cache unavailable', 'CacheService');
      expect(redisService.get).not.toHaveBeenCalled();
    });

    it('should throw error and log warning when cache lookup fails', async () => {
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockRejectedValue(new Error('Redis error'));

      await expect(service.getUserFromCache('user-1')).rejects.toThrow('Redis error');

      expect(Logger.prototype.warn).toHaveBeenCalledWith('Error getting user user-1 from cache: Redis error', 'CacheService');
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

    it('should return empty string when email is empty string', async () => {
      const userWithEmptyEmail = { ...mockCachedUserDetails, email: '' };
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(userWithEmptyEmail);

      const email = await service.getUserEmailFromCache('user-1');

      expect(email).toBe('');
    });

    test.each([
      ['undefined', undefined],
      ['null', null],
    ])('should return null when email is %s', async (_, emailValue) => {
      const userWithNoEmail = { ...mockCachedUserDetails, email: emailValue as any };
      redisService.isConnected.mockReturnValue(true);
      redisService.get.mockResolvedValue(userWithNoEmail);

      const email = await service.getUserEmailFromCache('user-1');

      expect(email).toBeNull();
    });
  });

  describe('Integration scenarios', () => {
    it('should handle complete initialization flow with multiple users', async () => {
      redisService.isConnected.mockReturnValue(true);
      mockedAxios.get
        .mockResolvedValueOnce({ data: [mockUserGroupDetails[0]] })
        .mockResolvedValueOnce({ data: [mockUserGroupDetails[1]] })
        .mockResolvedValueOnce({ data: [] });
      redisService.mset.mockResolvedValue(undefined);

      await service.initializeUserCache(0, 'test-token');

      expect(Logger.prototype.log).toHaveBeenCalledWith('InitializeUserCache called (attempt 1/4)', 'CacheService');
      expect(redisService.mset).toHaveBeenCalled();
    });

    it('should cache users with correct structure', async () => {
      setupSuccessfulInit();

      await service.initializeUserCache(0, 'test-token');

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

    it('should handle partial success when some role fetches fail', async () => {
      redisService.isConnected.mockReturnValue(true);
      mockedAxios.get
        .mockRejectedValueOnce(new Error('Role 1 failed'))
        .mockResolvedValueOnce({ data: [mockUserGroupDetails[1]] })
        .mockRejectedValueOnce(new Error('Role 3 failed'));
      redisService.mset.mockResolvedValue(undefined);

      await service.initializeUserCache(0, 'test-token');

      expect(Logger.prototype.error).toHaveBeenCalledTimes(2);
      expect(redisService.mset).toHaveBeenCalled(); // Should still cache successful role
    });
  });
});
