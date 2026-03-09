import { describe, it, expect, vi, beforeEach } from 'vitest';
import userService from '../userService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getUsersByRole', () => {
    it('gets users by role', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          username: 'investigator1',
          email: 'inv1@test.com',
          firstName: 'John',
          lastName: 'Doe',
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockUsers);

      const result = await userService.getUsersByRole('CMS_INVESTIGATOR');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/v1/user/list-by-role/CMS_INVESTIGATOR',
      );
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-1');
      expect(result[0].name).toBe('John Doe');
      expect(result[0].role).toBe('CMS_INVESTIGATOR');
    });

    it('handles users without firstName/lastName', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          username: 'investigator1',
          email: 'inv1@test.com',
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockUsers);

      const result = await userService.getUsersByRole('CMS_INVESTIGATOR');

      expect(result[0].name).toBe('investigator1');
    });

    it('handles users with only email', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          email: 'inv1@test.com',
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockUsers);

      const result = await userService.getUsersByRole('CMS_INVESTIGATOR');

      expect(result[0].name).toBe('inv1@test.com');
    });

    it('filters out users without IDs', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          username: 'investigator1',
          firstName: 'John',
          lastName: 'Doe',
        },
        {
          username: 'investigator2',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockUsers);

      const result = await userService.getUsersByRole('CMS_INVESTIGATOR');

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('user-1');
    });

    it('handles errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue(new Error('Network error'));

      const result = await userService.getUsersByRole('CMS_INVESTIGATOR');

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('getUserDetailsById', () => {
    it('gets user details from investigators', async () => {
      const mockInvestigators = [
        {
          id: 'user-1',
          username: 'investigator1',
          firstName: 'John',
          lastName: 'Doe',
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockInvestigators);

      const result = await userService.getUserDetailsById('user-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/v1/user/list-by-role/CMS_INVESTIGATOR',
      );
      expect(result).toEqual(mockInvestigators[0]);
    });

    it('gets user details from supervisors if not found in investigators', async () => {
      const mockInvestigators: any[] = [];
      const mockSupervisors = [
        {
          id: 'user-1',
          username: 'supervisor1',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      ];
      (apiClient.get as vi.Mock)
        .mockResolvedValueOnce(mockInvestigators)
        .mockResolvedValueOnce(mockSupervisors);

      const result = await userService.getUserDetailsById('user-1');

      expect(apiClient.get).toHaveBeenCalledWith(
        '/v1/user/list-by-role/CMS_INVESTIGATOR',
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        '/v1/user/list-by-role/CMS_SUPERVISOR',
      );
      expect(result).toEqual(mockSupervisors[0]);
    });

    it('returns null if user not found', async () => {
      (apiClient.get as vi.Mock)
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await userService.getUserDetailsById('user-1');

      expect(result).toBeNull();
    });

    it('handles errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue(new Error('Network error'));

      const result = await userService.getUserDetailsById('user-1');

      expect(result).toBeNull();
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  describe('formatUserName', () => {
    it('formats user name correctly with firstName and lastName', () => {
      const user = {
        id: 'user-1',
        firstName: 'John',
        lastName: 'Doe',
        username: 'investigator1',
        email: 'inv1@test.com',
      } as any;

      expect(userService.formatUserName(user)).toBe('John Doe');
    });

    it('returns username if no firstName/lastName', () => {
      const user = {
        id: 'user-1',
        username: 'investigator1',
        email: 'inv1@test.com',
      } as any;

      expect(userService.formatUserName(user)).toBe('investigator1');
    });

    it('returns email if no username or name', () => {
      const user = {
        id: 'user-1',
        email: 'inv1@test.com',
      } as any;

      expect(userService.formatUserName(user)).toBe('inv1@test.com');
    });

    it('returns Unknown for null user', () => {
      expect(userService.formatUserName(null)).toBe('Unknown');
    });

    it('handles empty firstName/lastName', () => {
      const user = {
        id: 'user-1',
        firstName: '',
        lastName: '',
        username: 'investigator1',
      } as any;

      expect(userService.formatUserName(user)).toBe('investigator1');
    });
  });

  describe('getInvestigators', () => {
    it('calls getUsersByRole with CMS_INVESTIGATOR', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          username: 'investigator1',
          firstName: 'John',
          lastName: 'Doe',
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockUsers);

      const result = await userService.getInvestigators();

      expect(apiClient.get).toHaveBeenCalledWith(
        '/v1/user/list-by-role/CMS_INVESTIGATOR',
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getSupervisors', () => {
    it('calls getUsersByRole with CMS_SUPERVISOR', async () => {
      const mockUsers = [
        {
          id: 'user-1',
          username: 'supervisor1',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      ];
      (apiClient.get as vi.Mock).mockResolvedValue(mockUsers);

      const result = await userService.getSupervisors();

      expect(apiClient.get).toHaveBeenCalledWith(
        '/v1/user/list-by-role/CMS_SUPERVISOR',
      );
      expect(result).toHaveLength(1);
    });
  });

  describe('getAllUsers', () => {
    it('combines investigators and supervisors', async () => {
      const mockInvestigators = [
        {
          id: 'user-1',
          username: 'investigator1',
          firstName: 'John',
          lastName: 'Doe',
        },
      ];
      const mockSupervisors = [
        {
          id: 'user-2',
          username: 'supervisor1',
          firstName: 'Jane',
          lastName: 'Smith',
        },
      ];
      (apiClient.get as vi.Mock)
        .mockResolvedValueOnce(mockInvestigators)
        .mockResolvedValueOnce(mockSupervisors);

      const result = await userService.getAllUsers();

      expect(result).toHaveLength(2);
      // Users are sorted by name, so Alice comes before Bob
      expect(result[0].id).toBe('user-2');
      expect(result[1].id).toBe('user-1');
    });

    it('removes duplicate users', async () => {
      const mockInvestigators = [
        {
          id: 'user-1',
          username: 'investigator1',
          firstName: 'John',
          lastName: 'Doe',
        },
      ];
      const mockSupervisors = [
        {
          id: 'user-1',
          username: 'investigator1',
          firstName: 'John',
          lastName: 'Doe',
        },
      ];
      (apiClient.get as vi.Mock)
        .mockResolvedValueOnce(mockInvestigators)
        .mockResolvedValueOnce(mockSupervisors);

      const result = await userService.getAllUsers();

      expect(result).toHaveLength(1);
    });

    it('sorts users by name', async () => {
      const mockInvestigators = [
        {
          id: 'user-2',
          username: 'investigator2',
          firstName: 'Bob',
          lastName: 'Smith',
        },
      ];
      const mockSupervisors = [
        {
          id: 'user-1',
          username: 'supervisor1',
          firstName: 'Alice',
          lastName: 'Doe',
        },
      ];
      (apiClient.get as vi.Mock)
        .mockResolvedValueOnce(mockInvestigators)
        .mockResolvedValueOnce(mockSupervisors);

      const result = await userService.getAllUsers();

      expect(result[0].name).toBe('Alice Doe');
      expect(result[1].name).toBe('Bob Smith');
    });

    it('handles errors gracefully', async () => {
      const consoleErrorSpy = vi
        .spyOn(console, 'error')
        .mockImplementation(() => {});
      (apiClient.get as vi.Mock).mockRejectedValue(new Error('Network error'));

      const result = await userService.getAllUsers();

      expect(result).toEqual([]);
      expect(consoleErrorSpy).toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });
});
