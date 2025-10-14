import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class AuthHelperService {
  // Simulated Keycloak users with roles
  private mockUsers = [
    // Supervisors
    { id: 'f47ac10b-58cc-4372-a567-0e02b2c3d479', username: 'cms_supervisor_1', roles: ['CMS_SUPERVISOR'] },
    { id: '1bd442a2-3ff1-403a-b3d7-01d6cc79aac0', username: 'cms_supervisor_2', roles: ['CMS_SUPERVISOR'] },
    { id: '1617473c-93e6-46c6-97d2-cfecc92b0425', username: 'cms_supervisor_3', roles: ['CMS_SUPERVISOR'] },
    { id: '238efe62-f6b5-4b45-b53f-0dcd9f07b937', username: 'cms_supervisor_4', roles: ['CMS_SUPERVISOR'] },
    { id: '68908891-2b9f-482f-a350-5da839c23482', username: 'cms_supervisor_5', roles: ['CMS_SUPERVISOR'] },

    // Analysts
    { id: 'c97109de-fda6-48e0-bd6b-0fa8919056ae', username: 'cms_analyst_1', roles: ['CMS_ANALYST'] },
    { id: '46292c24-b3ca-4c08-9ff0-9e036fd5eb75', username: 'cms_analyst_2', roles: ['CMS_ANALYST'] },
    { id: '0d9967da-ba97-4471-993f-6a3404579f44', username: 'cms_analyst_3', roles: ['CMS_ANALYST'] },
    { id: '63a21931-9bdb-4151-a9f4-1297c3c4e202', username: 'cms_analyst_4', roles: ['CMS_ANALYST'] },
    { id: 'fd38a9d8-115c-4ae4-81e3-25d96b524299', username: 'cms_analyst_5', roles: ['CMS_ANALYST'] },

    // Investigators
    { id: 'c0eb00c7-6f7c-444c-ab74-1c4223dbee02', username: 'cms_investigator_1', roles: ['CMS_INVESTIGATOR'] },
    { id: 'd9c5a0a0-1395-4d81-ba8f-99efaa7dfaf5', username: 'cms_investigator_2', roles: ['CMS_INVESTIGATOR'] },
    { id: '875e1911-fe1b-451d-877f-4f771ef85f58', username: 'cms_investigator_3', roles: ['CMS_INVESTIGATOR'] },
    { id: '36febe5b-49fe-4abd-b294-f7afc995574e', username: 'cms_investigator_4', roles: ['CMS_INVESTIGATOR'] },
    { id: 'acf06a8d-8cd1-4285-97a8-c4d16f7c8348', username: 'cms_investigator_5', roles: ['CMS_INVESTIGATOR'] },
    
    // Additional user for unassignment
    { id: '085b7a75-c39d-44f8-868f-6c419f578627', username: 'cms_user_for_unassign', roles: ['CMS_SUPERVISOR', 'CMS_INVESTIGATOR'] },
  ];

  /**
   * Mock: Return all users with a specific role.
   */
  async getAllUsersWithRole(roleName: string): Promise<any[]> {
    return this.mockUsers.filter((u) => u.roles.includes(roleName));
  }

  /**
   * Mock: Return roles for a given user.
   */
  async getUserRolesFromAuthService(userId: string): Promise<string[]> {
    const user = this.mockUsers.find((u) => u.id === userId);
    if (!user) throw new BadRequestException(`User ${userId} not found`);
    return user.roles;
  }

  /**
   * Mock: Check if user exists.
   */
  async userExists(userId: string): Promise<boolean> {
    return this.mockUsers.some((u) => u.id === userId);
  }

  /**
   * Mock: Check if a user has a given role.
   */
  async userHasRole(userId: string, requiredRole: string): Promise<boolean> {
    const user = this.mockUsers.find((u) => u.id === userId);
    if (!user) throw new BadRequestException(`User ${userId} not found`);
    return user.roles.includes(requiredRole);
  }
}