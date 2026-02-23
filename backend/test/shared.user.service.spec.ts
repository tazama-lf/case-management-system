import { Test, TestingModule } from '@nestjs/testing';
import { UserService, UserDetails } from '../src/modules/shared/user.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { Logger } from '@nestjs/common';

describe('UserService (Shared)', () => {
  let service: UserService;
  let authService: jest.Mocked<AuthService>;

  const mockUserAuthDetails = {
    id: 'user-123',
    username: 'john.doe',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john.doe@example.com',
    roles: ['analyst', 'viewer'],
  };

  beforeEach(async () => {
    const mockAuthService = {
      getUserDetailsFromAuthService: jest.fn(),
      userExists: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    authService = module.get(AuthService);

    // Suppress logger output during tests
    jest.spyOn(Logger.prototype, 'error').mockImplementation();
    jest.spyOn(Logger.prototype, 'log').mockImplementation();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getUserEmail', () => {
    it('should return user email when user details are found', async () => {
      authService.getUserDetailsFromAuthService.mockResolvedValue(mockUserAuthDetails);

      const email = await service.getUserEmail('user-123');

      expect(email).toBe('john.doe@example.com');
      expect(authService.getUserDetailsFromAuthService).toHaveBeenCalledWith('user-123');
    });

    it('should return null and log error when authService throws Error', async () => {
      const error = new Error('User not found');
      authService.getUserDetailsFromAuthService.mockRejectedValue(error);

      const email = await service.getUserEmail('user-999');

      expect(email).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to get email for user user-999: User not found',
        'UserService',
      );
    });

    it('should return null and log error when authService throws non-Error', async () => {
      authService.getUserDetailsFromAuthService.mockRejectedValue('String error');

      const email = await service.getUserEmail('user-999');

      expect(email).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to get email for user user-999: String error',
        'UserService',
      );
    });

    it('should handle null or undefined error messages', async () => {
      authService.getUserDetailsFromAuthService.mockRejectedValue(null);

      const email = await service.getUserEmail('user-999');

      expect(email).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalled();
    });

    it('should call authService with correct userId parameter', async () => {
      authService.getUserDetailsFromAuthService.mockResolvedValue(mockUserAuthDetails);

      await service.getUserEmail('custom-user-id');

      expect(authService.getUserDetailsFromAuthService).toHaveBeenCalledWith('custom-user-id');
    });
  });

  describe('getUserDetails', () => {
    it('should return full user details when user is found', async () => {
      authService.getUserDetailsFromAuthService.mockResolvedValue(mockUserAuthDetails);

      const details = await service.getUserDetails('user-123');

      expect(details).toEqual({
        id: 'user-123',
        username: 'john.doe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        roles: ['analyst', 'viewer'],
      });
      expect(authService.getUserDetailsFromAuthService).toHaveBeenCalledWith('user-123');
    });

    it('should return null and log error when authService throws Error', async () => {
      const error = new Error('User not found');
      authService.getUserDetailsFromAuthService.mockRejectedValue(error);

      const details = await service.getUserDetails('user-999');

      expect(details).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to get details for user user-999: User not found',
        'UserService',
      );
    });

    it('should return null and log error when authService throws non-Error', async () => {
      authService.getUserDetailsFromAuthService.mockRejectedValue('String error');

      const details = await service.getUserDetails('user-999');

      expect(details).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to get details for user user-999: String error',
        'UserService',
      );
    });

    it('should map all user detail fields correctly', async () => {
      const customUserDetails = {
        id: 'custom-id',
        username: 'custom.user',
        firstName: 'Custom',
        lastName: 'User',
        email: 'custom@example.com',
        roles: ['admin', 'superuser'],
      };
      authService.getUserDetailsFromAuthService.mockResolvedValue(customUserDetails);

      const details = await service.getUserDetails('custom-id');

      expect(details?.id).toBe('custom-id');
      expect(details?.username).toBe('custom.user');
      expect(details?.firstName).toBe('Custom');
      expect(details?.lastName).toBe('User');
      expect(details?.email).toBe('custom@example.com');
      expect(details?.roles).toEqual(['admin', 'superuser']);
    });

    it('should handle empty roles array', async () => {
      const userWithNoRoles = { ...mockUserAuthDetails, roles: [] };
      authService.getUserDetailsFromAuthService.mockResolvedValue(userWithNoRoles);

      const details = await service.getUserDetails('user-123');

      expect(details?.roles).toEqual([]);
    });
  });

  describe('getUserFullName', () => {
    it('should return full name when user is found', async () => {
      authService.getUserDetailsFromAuthService.mockResolvedValue(mockUserAuthDetails);

      const fullName = await service.getUserFullName('user-123');

      expect(fullName).toBe('John Doe');
      expect(authService.getUserDetailsFromAuthService).toHaveBeenCalledWith('user-123');
    });

    it('should trim whitespace from full name', async () => {
      const userWithSpaces = {
        ...mockUserAuthDetails,
        firstName: '  John  ',
        lastName: '  Doe  ',
      };
      authService.getUserDetailsFromAuthService.mockResolvedValue(userWithSpaces);

      const fullName = await service.getUserFullName('user-123');

      expect(fullName).toBe('John     Doe');
    });

    it('should handle user with only firstName', async () => {
      const userWithFirstNameOnly = {
        ...mockUserAuthDetails,
        firstName: 'John',
        lastName: '',
      };
      authService.getUserDetailsFromAuthService.mockResolvedValue(userWithFirstNameOnly);

      const fullName = await service.getUserFullName('user-123');

      expect(fullName).toBe('John');
    });

    it('should handle user with only lastName', async () => {
      const userWithLastNameOnly = {
        ...mockUserAuthDetails,
        firstName: '',
        lastName: 'Doe',
      };
      authService.getUserDetailsFromAuthService.mockResolvedValue(userWithLastNameOnly);

      const fullName = await service.getUserFullName('user-123');

      expect(fullName).toBe('Doe');
    });

    it('should return null and log error when authService throws Error', async () => {
      const error = new Error('User not found');
      authService.getUserDetailsFromAuthService.mockRejectedValue(error);

      const fullName = await service.getUserFullName('user-999');

      expect(fullName).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to get name for user user-999: User not found',
        'UserService',
      );
    });

    it('should return null and log error when authService throws non-Error', async () => {
      authService.getUserDetailsFromAuthService.mockRejectedValue('String error');

      const fullName = await service.getUserFullName('user-999');

      expect(fullName).toBeNull();
      expect(Logger.prototype.error).toHaveBeenCalledWith(
        'Failed to get name for user user-999: String error',
        'UserService',
      );
    });
  });

  describe('userExists', () => {
    it('should return true when user exists', async () => {
      authService.userExists.mockResolvedValue(true);

      const exists = await service.userExists('user-123');

      expect(exists).toBe(true);
      expect(authService.userExists).toHaveBeenCalledWith('user-123');
    });

    it('should return false when user does not exist', async () => {
      authService.userExists.mockResolvedValue(false);

      const exists = await service.userExists('user-999');

      expect(exists).toBe(false);
      expect(authService.userExists).toHaveBeenCalledWith('user-999');
    });

    it('should call authService.userExists with correct userId', async () => {
      authService.userExists.mockResolvedValue(true);

      await service.userExists('custom-user-id');

      expect(authService.userExists).toHaveBeenCalledWith('custom-user-id');
    });

    it('should handle multiple calls independently', async () => {
      authService.userExists.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

      const exists1 = await service.userExists('user-1');
      const exists2 = await service.userExists('user-2');

      expect(exists1).toBe(true);
      expect(exists2).toBe(false);
    });
  });

  describe('getBatchUserEmails', () => {
    it('should return email map for all valid users', async () => {
      const user1 = { ...mockUserAuthDetails, id: 'user-1', email: 'user1@example.com' };
      const user2 = { ...mockUserAuthDetails, id: 'user-2', email: 'user2@example.com' };
      const user3 = { ...mockUserAuthDetails, id: 'user-3', email: 'user3@example.com' };

      authService.getUserDetailsFromAuthService
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2)
        .mockResolvedValueOnce(user3);

      const emailMap = await service.getBatchUserEmails(['user-1', 'user-2', 'user-3']);

      expect(emailMap.size).toBe(3);
      expect(emailMap.get('user-1')).toBe('user1@example.com');
      expect(emailMap.get('user-2')).toBe('user2@example.com');
      expect(emailMap.get('user-3')).toBe('user3@example.com');
    });

    it('should exclude users whose email lookup fails', async () => {
      const user1 = { ...mockUserAuthDetails, id: 'user-1', email: 'user1@example.com' };

      authService.getUserDetailsFromAuthService
        .mockResolvedValueOnce(user1)
        .mockRejectedValueOnce(new Error('User not found'))
        .mockRejectedValueOnce(new Error('User not found'));

      const emailMap = await service.getBatchUserEmails(['user-1', 'user-2', 'user-3']);

      expect(emailMap.size).toBe(1);
      expect(emailMap.get('user-1')).toBe('user1@example.com');
      expect(emailMap.has('user-2')).toBe(false);
      expect(emailMap.has('user-3')).toBe(false);
    });

    it('should return empty map when all users fail', async () => {
      authService.getUserDetailsFromAuthService
        .mockRejectedValueOnce(new Error('Not found'))
        .mockRejectedValueOnce(new Error('Not found'));

      const emailMap = await service.getBatchUserEmails(['user-1', 'user-2']);

      expect(emailMap.size).toBe(0);
    });

    it('should return empty map for empty user array', async () => {
      const emailMap = await service.getBatchUserEmails([]);

      expect(emailMap.size).toBe(0);
      expect(authService.getUserDetailsFromAuthService).not.toHaveBeenCalled();
    });

    it('should process users in parallel', async () => {
      const user1 = { ...mockUserAuthDetails, id: 'user-1', email: 'user1@example.com' };
      const user2 = { ...mockUserAuthDetails, id: 'user-2', email: 'user2@example.com' };

      authService.getUserDetailsFromAuthService
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);

      await service.getBatchUserEmails(['user-1', 'user-2']);

      // Both calls should have been initiated (parallel execution)
      expect(authService.getUserDetailsFromAuthService).toHaveBeenCalledTimes(2);
    });

    it('should handle single user correctly', async () => {
      const user1 = { ...mockUserAuthDetails, id: 'user-1', email: 'user1@example.com' };
      authService.getUserDetailsFromAuthService.mockResolvedValue(user1);

      const emailMap = await service.getBatchUserEmails(['user-1']);

      expect(emailMap.size).toBe(1);
      expect(emailMap.get('user-1')).toBe('user1@example.com');
    });
  });

  describe('getBatchUserDetails', () => {
    it('should return details map for all valid users', async () => {
      const user1 = { ...mockUserAuthDetails, id: 'user-1', username: 'user1' };
      const user2 = { ...mockUserAuthDetails, id: 'user-2', username: 'user2' };
      const user3 = { ...mockUserAuthDetails, id: 'user-3', username: 'user3' };

      authService.getUserDetailsFromAuthService
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2)
        .mockResolvedValueOnce(user3);

      const detailsMap = await service.getBatchUserDetails(['user-1', 'user-2', 'user-3']);

      expect(detailsMap.size).toBe(3);
      expect(detailsMap.get('user-1')?.username).toBe('user1');
      expect(detailsMap.get('user-2')?.username).toBe('user2');
      expect(detailsMap.get('user-3')?.username).toBe('user3');
    });

    it('should include all user detail fields in the map', async () => {
      const user1 = {
        id: 'user-1',
        username: 'john.doe',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        roles: ['admin'],
      };
      authService.getUserDetailsFromAuthService.mockResolvedValue(user1);

      const detailsMap = await service.getBatchUserDetails(['user-1']);

      const details = detailsMap.get('user-1');
      expect(details?.id).toBe('user-1');
      expect(details?.username).toBe('john.doe');
      expect(details?.firstName).toBe('John');
      expect(details?.lastName).toBe('Doe');
      expect(details?.email).toBe('john@example.com');
      expect(details?.roles).toEqual(['admin']);
    });

    it('should exclude users whose details lookup fails', async () => {
      const user1 = { ...mockUserAuthDetails, id: 'user-1' };

      authService.getUserDetailsFromAuthService
        .mockResolvedValueOnce(user1)
        .mockRejectedValueOnce(new Error('User not found'))
        .mockRejectedValueOnce(new Error('User not found'));

      const detailsMap = await service.getBatchUserDetails(['user-1', 'user-2', 'user-3']);

      expect(detailsMap.size).toBe(1);
      expect(detailsMap.has('user-1')).toBe(true);
      expect(detailsMap.has('user-2')).toBe(false);
      expect(detailsMap.has('user-3')).toBe(false);
    });

    it('should return empty map when all users fail', async () => {
      authService.getUserDetailsFromAuthService
        .mockRejectedValueOnce(new Error('Not found'))
        .mockRejectedValueOnce(new Error('Not found'));

      const detailsMap = await service.getBatchUserDetails(['user-1', 'user-2']);

      expect(detailsMap.size).toBe(0);
    });

    it('should return empty map for empty user array', async () => {
      const detailsMap = await service.getBatchUserDetails([]);

      expect(detailsMap.size).toBe(0);
      expect(authService.getUserDetailsFromAuthService).not.toHaveBeenCalled();
    });

    it('should process users in parallel', async () => {
      const user1 = { ...mockUserAuthDetails, id: 'user-1' };
      const user2 = { ...mockUserAuthDetails, id: 'user-2' };

      authService.getUserDetailsFromAuthService
        .mockResolvedValueOnce(user1)
        .mockResolvedValueOnce(user2);

      await service.getBatchUserDetails(['user-1', 'user-2']);

      // Both calls should have been initiated (parallel execution)
      expect(authService.getUserDetailsFromAuthService).toHaveBeenCalledTimes(2);
    });

    it('should handle single user correctly', async () => {
      const user1 = { ...mockUserAuthDetails, id: 'user-1' };
      authService.getUserDetailsFromAuthService.mockResolvedValue(user1);

      const detailsMap = await service.getBatchUserDetails(['user-1']);

      expect(detailsMap.size).toBe(1);
      expect(detailsMap.has('user-1')).toBe(true);
    });

    it('should handle mixed success and failure scenarios', async () => {
      const user1 = { ...mockUserAuthDetails, id: 'user-1', username: 'user1' };
      const user3 = { ...mockUserAuthDetails, id: 'user-3', username: 'user3' };

      authService.getUserDetailsFromAuthService
        .mockResolvedValueOnce(user1)
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce(user3);

      const detailsMap = await service.getBatchUserDetails(['user-1', 'user-2', 'user-3']);

      expect(detailsMap.size).toBe(2);
      expect(detailsMap.get('user-1')?.username).toBe('user1');
      expect(detailsMap.has('user-2')).toBe(false);
      expect(detailsMap.get('user-3')?.username).toBe('user3');
    });
  });

  describe('Error logging', () => {
    it('should log errors with correct service name', async () => {
      authService.getUserDetailsFromAuthService.mockRejectedValue(new Error('Test error'));

      await service.getUserEmail('user-123');

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('Test error'),
        'UserService',
      );
    });

    it('should include userId in error messages', async () => {
      authService.getUserDetailsFromAuthService.mockRejectedValue(new Error('Not found'));

      await service.getUserDetails('test-user-id');

      expect(Logger.prototype.error).toHaveBeenCalledWith(
        expect.stringContaining('test-user-id'),
        'UserService',
      );
    });
  });
});
