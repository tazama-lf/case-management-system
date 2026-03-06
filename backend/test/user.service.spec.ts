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

  const AUTH_BASE = 'http://auth.example.com';
  const TOKEN = 'test-bearer-token';
  const ROLE = 'analyst';
  const TENANT = 'tenant-123';

  const mockUsers: UserGroupDetails[] = [
    {
      id: 'user-1',
      username: 'john.doe',
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      enabled: true,
      emailVerified: true,
      createdTimestamp: 1_234_567_890,
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
      createdTimestamp: 1_234_567_891,
      totp: false,
      disableableCredentialTypes: [],
      requiredActions: [],
      notBefore: 0,
    },
  ];

  // â”€â”€ shared module factory â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const buildModule = async (authUrl: string = AUTH_BASE): Promise<TestingModule> => {
    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
    };

    const mockConfigService = {
      get: jest.fn().mockReturnValue(authUrl),
    };

    const module = await Test.createTestingModule({
      providers: [UserService, { provide: LoggerService, useValue: mockLogger }, { provide: ConfigService, useValue: mockConfigService }],
    }).compile();

    return module;
  };

  beforeEach(async () => {
    const module = await buildModule();
    service = module.get<UserService>(UserService);
    logger = module.get(LoggerService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // â”€â”€ constructor â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('constructor', () => {
    it('should read TAZAMA_AUTH_URL from config on instantiation', () => {
      expect(service).toBeDefined();
      expect(configService.get).toHaveBeenCalledWith('TAZAMA_AUTH_URL');
    });
  });

  // â”€â”€ getUsersByRole â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  describe('getUsersByRole', () => {
    describe('success path', () => {
      beforeEach(() => {
        mockedAxios.get.mockResolvedValue({ data: mockUsers });
      });

      it('should return the users array from the API response', async () => {
        const result = await service.getUsersByRole(TOKEN, ROLE, TENANT);

        expect(result).toEqual(mockUsers);
        expect(result).toHaveLength(2);
      });

      it('should build the correct request URL from config + params', async () => {
        await service.getUsersByRole(TOKEN, ROLE, TENANT);

        expect(mockedAxios.get).toHaveBeenCalledWith(`${AUTH_BASE}/user/${ROLE}?groupName=${TENANT}`, expect.any(Object));
      });

      it('should pass Content-Type and Bearer token headers', async () => {
        await service.getUsersByRole(TOKEN, ROLE, TENANT);

        expect(mockedAxios.get).toHaveBeenCalledWith(expect.any(String), {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${TOKEN}`,
          },
        });
      });

      it('should log the role before making the request', async () => {
        await service.getUsersByRole(TOKEN, ROLE, TENANT);

        expect(logger.log).toHaveBeenCalledWith(`Fetching users with role: ${ROLE}`);
        expect(logger.log).toHaveBeenCalledTimes(1);
      });

      it('should return an empty array when the API returns no results', async () => {
        mockedAxios.get.mockResolvedValue({ data: [] });

        const result = await service.getUsersByRole(TOKEN, ROLE, TENANT);

        expect(result).toEqual([]);
      });

      it('should reflect the correct auth base URL when config differs', async () => {
        const altBase = 'http://other-auth.example.com';
        const altModule = await buildModule(altBase);
        const altService = altModule.get<UserService>(UserService);
        mockedAxios.get.mockResolvedValue({ data: [] });

        await altService.getUsersByRole(TOKEN, ROLE, TENANT);

        expect(mockedAxios.get).toHaveBeenCalledWith(`${altBase}/user/${ROLE}?groupName=${TENANT}`, expect.any(Object));
      });
    });

    describe('error handling', () => {
      it('should propagate network-level errors thrown by axios', async () => {
        mockedAxios.get.mockRejectedValue(new Error('Network Error'));

        await expect(service.getUsersByRole(TOKEN, ROLE, TENANT)).rejects.toThrow('Network Error');
      });

      it('should propagate HTTP 4xx / 5xx error objects from axios', async () => {
        const httpError = { response: { status: 401, data: { message: 'Unauthorized' } } };
        mockedAxios.get.mockRejectedValue(httpError);

        await expect(service.getUsersByRole(TOKEN, ROLE, TENANT)).rejects.toMatchObject(httpError);
      });
    });
  });
});
