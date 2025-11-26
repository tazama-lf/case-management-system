import { describe, it, expect, vi, beforeEach } from 'vitest';
import userService from '../userService';
import apiClient from '../../../../shared/services/apiClient';

vi.mock('../../../../shared/services/apiClient');

describe('UserService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

    expect(apiClient.get).toHaveBeenCalledWith('/v1/user/list-by-role/CMS_INVESTIGATOR');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('user-1');
    expect(result[0].name).toBe('John Doe');
  });

  it('gets user details by ID', async () => {
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

    expect(result).toEqual(mockInvestigators[0]);
  });

  it('formats user name correctly', () => {
    const user = {
      id: 'user-1',
      firstName: 'John',
      lastName: 'Doe',
      username: 'investigator1',
      email: 'inv1@test.com',
    } as any;

    expect(userService.formatUserName(user)).toBe('John Doe');
  });

  it('returns Unknown for null user', () => {
    expect(userService.formatUserName(null)).toBe('Unknown');
  });
});

