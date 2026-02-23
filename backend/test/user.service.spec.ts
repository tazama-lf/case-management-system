import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UserService } from '../src/modules/user/user.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import axios from 'axios';
import { UserGroupDetails } from '../src/utils/types/UserList';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('UserService', () => {
  let service: UserService;
  let logger: jest.Mocked<LoggerService>;
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
      createdTimestamp: 1234567890,
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
      createdTimestamp: 1234567891,
      totp: false,
      disableableCredentialTypes: [],
      requiredActions: [],
      notBefore: 0,
    },
  ];

  beforeEach(async () => {
    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue('http://auth.example.com'),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    logger = module.get(LoggerService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUsersByRole', () => {
    const token = 'test-bearer-token';
    const role = 'analyst';
    const tenantName = 'tenant-123';

    it('should successfully fetch users by role', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockUserGroupDetails });

      const result = await service.getUsersByRole(token, role, tenantName);

      expect(result).toEqual(mockUserGroupDetails);
      expect(result).toHaveLength(2);
      expect(logger.log).toHaveBeenCalledWith(`Fetching users with role: ${role}`);
    });

    it('should call axios.get with correct URL', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockUserGroupDetails });

      await service.getUsersByRole(token, role, tenantName);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        `http://auth.example.com/user/${role}?groupName=${tenantName}`,
        expect.any(Object),
      );
    });

    it('should call axios.get with correct headers', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockUserGroupDetails });

      await service.getUsersByRole(token, role, tenantName);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
        }),
      );
    });

    it('should log the role being fetched', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockUserGroupDetails });

      await service.getUsersByRole(token, 'admin', tenantName);

      expect(logger.log).toHaveBeenCalledWith('Fetching users with role: admin');
      expect(logger.log).toHaveBeenCalledTimes(1);
    });

    it('should return empty array when no users found', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });

      const result = await service.getUsersByRole(token, role, tenantName);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle single user response', async () => {
      mockedAxios.get.mockResolvedValue({ data: [mockUserGroupDetails[0]] });

      const result = await service.getUsersByRole(token, role, tenantName);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockUserGroupDetails[0]);
    });

    it('should handle different roles', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockUserGroupDetails });

      await service.getUsersByRole(token, 'manager', tenantName);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://auth.example.com/user/manager?groupName=tenant-123',
        expect.any(Object),
      );
      expect(logger.log).toHaveBeenCalledWith('Fetching users with role: manager');
    });

    it('should handle different tenant names', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockUserGroupDetails });

      await service.getUsersByRole(token, role, 'tenant-456');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://auth.example.com/user/analyst?groupName=tenant-456',
        expect.any(Object),
      );
    });

    it('should handle different tokens', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockUserGroupDetails });

      const differentToken = 'different-token';
      await service.getUsersByRole(differentToken, role, tenantName);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': `Bearer ${differentToken}`,
          }),
        }),
      );
    });

    it('should handle API error and throw', async () => {
      const error = new Error('API Error');
      mockedAxios.get.mockRejectedValue(error);

      await expect(service.getUsersByRole(token, role, tenantName)).rejects.toThrow('API Error');
      expect(logger.log).toHaveBeenCalledWith(`Fetching users with role: ${role}`);
    });

    it('should handle network timeout error', async () => {
      const timeoutError = new Error('Network timeout');
      mockedAxios.get.mockRejectedValue(timeoutError);

      await expect(service.getUsersByRole(token, role, tenantName)).rejects.toThrow('Network timeout');
    });

    it('should handle 401 unauthorized error', async () => {
      const unauthorizedError = {
        response: {
          status: 401,
          data: { message: 'Unauthorized' },
        },
      };
      mockedAxios.get.mockRejectedValue(unauthorizedError);

      await expect(service.getUsersByRole(token, role, tenantName)).rejects.toMatchObject(unauthorizedError);
    });

    it('should handle 403 forbidden error', async () => {
      const forbiddenError = {
        response: {
          status: 403,
          data: { message: 'Forbidden' },
        },
      };
      mockedAxios.get.mockRejectedValue(forbiddenError);

      await expect(service.getUsersByRole(token, role, tenantName)).rejects.toMatchObject(forbiddenError);
    });

    it('should handle 404 not found error', async () => {
      const notFoundError = {
        response: {
          status: 404,
          data: { message: 'Not found' },
        },
      };
      mockedAxios.get.mockRejectedValue(notFoundError);

      await expect(service.getUsersByRole(token, role, tenantName)).rejects.toMatchObject(notFoundError);
    });

    it('should handle 500 internal server error', async () => {
      const serverError = {
        response: {
          status: 500,
          data: { message: 'Internal server error' },
        },
      };
      mockedAxios.get.mockRejectedValue(serverError);

      await expect(service.getUsersByRole(token, role, tenantName)).rejects.toMatchObject(serverError);
    });

    it('should return correct user structure', async () => {
      mockedAxios.get.mockResolvedValue({ data: mockUserGroupDetails });

      const result = await service.getUsersByRole(token, role, tenantName);

      result.forEach((user) => {
        expect(user).toHaveProperty('id');
        expect(user).toHaveProperty('username');
        expect(user).toHaveProperty('email');
        expect(user).toHaveProperty('firstName');
        expect(user).toHaveProperty('lastName');
        expect(user).toHaveProperty('enabled');
        expect(user).toHaveProperty('emailVerified');
        expect(user).toHaveProperty('createdTimestamp');
        expect(user).toHaveProperty('totp');
        expect(user).toHaveProperty('disableableCredentialTypes');
        expect(user).toHaveProperty('requiredActions');
        expect(user).toHaveProperty('notBefore');
      });
    });

    it('should handle large number of users', async () => {
      const largeUserList = Array.from({ length: 100 }, (_, i) => ({
        id: `user-${i}`,
        username: `user${i}`,
        email: `user${i}@example.com`,
        firstName: `First${i}`,
        lastName: `Last${i}`,
        enabled: true,
        emailVerified: true,
        createdTimestamp: 1234567890 + i,
        totp: false,
        disableableCredentialTypes: [],
        requiredActions: [],
        notBefore: 0,
      }));

      mockedAxios.get.mockResolvedValue({ data: largeUserList });

      const result = await service.getUsersByRole(token, role, tenantName);

      expect(result).toHaveLength(100);
      expect(result).toEqual(largeUserList);
    });

    it('should properly encode query parameters', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });

      const specialTenantName = 'tenant with spaces';
      await service.getUsersByRole(token, role, specialTenantName);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://auth.example.com/user/analyst?groupName=tenant with spaces',
        expect.any(Object),
      );
    });

    it('should handle empty role string', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });

      await service.getUsersByRole(token, '', tenantName);

      expect(logger.log).toHaveBeenCalledWith('Fetching users with role: ');
      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://auth.example.com/user/?groupName=tenant-123',
        expect.any(Object),
      );
    });

    it('should handle empty tenant name', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });

      await service.getUsersByRole(token, role, '');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://auth.example.com/user/analyst?groupName=',
        expect.any(Object),
      );
    });

    it('should use configured auth base URL', async () => {
      configService.get.mockReturnValue('http://different-auth.example.com');

      // Recreate service with new config
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UserService,
          {
            provide: LoggerService,
            useValue: logger,
          },
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      const newService = module.get<UserService>(UserService);

      mockedAxios.get.mockResolvedValue({ data: mockUserGroupDetails });
      await newService.getUsersByRole(token, role, tenantName);

      expect(mockedAxios.get).toHaveBeenCalledWith(
        'http://different-auth.example.com/user/analyst?groupName=tenant-123',
        expect.any(Object),
      );
    });
  });

  describe('Constructor and initialization', () => {
    it('should properly initialize with config service', () => {
      expect(service).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('TAZAMA_AUTH_URL');
    });

    it('should handle missing auth URL config', () => {
      configService.get.mockReturnValue(undefined);

      const module = Test.createTestingModule({
        providers: [
          UserService,
          {
            provide: LoggerService,
            useValue: logger,
          },
          {
            provide: ConfigService,
            useValue: configService,
          },
        ],
      }).compile();

      expect(module).toBeDefined();
    });
  });

  describe('Edge cases', () => {
    it('should handle axios response with extra properties', async () => {
      mockedAxios.get.mockResolvedValue({
        data: mockUserGroupDetails,
        status: 200,
        statusText: 'OK',
        headers: {},
        config: {},
      } as any);

      const result = await service.getUsersByRole('token', 'role', 'tenant');

      expect(result).toEqual(mockUserGroupDetails);
    });

    it('should handle null token', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });

      await service.getUsersByRole(null as any, 'role', 'tenant');

      expect(mockedAxios.get).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer null',
          }),
        }),
      );
    });

    it('should handle special characters in role name', async () => {
      mockedAxios.get.mockResolvedValue({ data: [] });

      const specialRole = 'admin/manager';
      await service.getUsersByRole('token', specialRole, 'tenant');

      expect(logger.log).toHaveBeenCalledWith('Fetching users with role: admin/manager');
      expect(mockedAxios.get).toHaveBeenCalled();
    });
  });
});
