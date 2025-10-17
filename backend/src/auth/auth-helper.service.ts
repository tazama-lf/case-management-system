import { Injectable, BadRequestException } from '@nestjs/common';

@Injectable()
export class AuthHelperService {
  // Simulated Keycloak users with roles
  private mockUsers = [
    // Supervisors
    {
      id: 'b29bda5d-f8b4-4a5d-8f12-5b6d6027cf90',
      username: 'alice.mwangi',
      firstName: 'Alice',
      lastName: 'Mwangi',
      email: 'alice.mwangi@cms.org',
      roles: ['CMS_SUPERVISOR'],
    },
    {
      id: 'f8a2c016-2b8d-41da-bbb9-41ad3c26dfc2',
      username: 'brian.otieno',
      firstName: 'Brian',
      lastName: 'Otieno',
      email: 'brian.otieno@cms.org',
      roles: ['CMS_SUPERVISOR'],
    },
    {
      id: 'a60b4fa7-b4e2-4651-8a6b-d3d024ba89f1',
      username: 'clara.kamau',
      firstName: 'Clara',
      lastName: 'Kamau',
      email: 'clara.kamau@cms.org',
      roles: ['CMS_SUPERVISOR'],
    },

    // Analysts
    {
      id: 'c3c23b1d-ff1c-4922-9f16-89e6d5f334bb',
      username: 'felix.mutiso',
      firstName: 'Felix',
      lastName: 'Mutiso',
      email: 'felix.mutiso@cms.org',
      roles: ['CMS_ANALYST'],
    },
    {
      id: 'e0ff568c-b2a8-4b46-88f9-96a89952c3ef',
      username: 'grace.otieno',
      firstName: 'Grace',
      lastName: 'Otieno',
      email: 'grace.otieno@cms.org',
      roles: ['CMS_ANALYST'],
    },
    {
      id: 'fa9e32a9-441f-4a7c-91a7-173a81d55472',
      username: 'henry.wambua',
      firstName: 'Henry',
      lastName: 'Wambua',
      email: 'henry.wambua@cms.org',
      roles: ['CMS_ANALYST'],
    },

    // Investigators
    {
      id: 'c98db341-beb6-457c-98e0-406cc1c71662',
      username: 'karen.mworia',
      firstName: 'Karen',
      lastName: 'Mworia',
      email: 'karen.mworia@cms.org',
      roles: ['CMS_INVESTIGATOR'],
    },
    {
      id: '42c2e610-0a59-4ab7-88cb-6804ed20e3d0',
      username: 'leonard.ochieng',
      firstName: 'Leonard',
      lastName: 'Ochieng',
      email: 'leonard.ochieng@cms.org',
      roles: ['CMS_INVESTIGATOR'],
    },
    {
      id: '0fd2adf8-cf8c-4b7a-9807-03fd1a4e4236',
      username: 'mary.njoki',
      firstName: 'Mary',
      lastName: 'Njoki',
      email: 'mary.njoki@cms.org',
      roles: ['CMS_INVESTIGATOR'],
    },

    // Admins
    {
      id: '67f83c76-b39a-4b9e-bf61-10a9f231d3a5',
      username: 'emily.njeri',
      firstName: 'Emily',
      lastName: 'Njeri',
      email: 'emily.njeri@cms.org',
      roles: ['CMS_ADMIN'],
    },
    {
      id: 'bc176cd4-0f6e-402c-8ac0-6cbafc67a7e8',
      username: 'nicholas.mwenda',
      firstName: 'Nicholas',
      lastName: 'Mwenda',
      email: 'nicholas.mwenda@cms.org',
      roles: ['CMS_ADMIN'],
    },
    {
      id: 'aab4c061-2041-4a4f-89c2-51fd7799c9df',
      username: 'olivia.mutua',
      firstName: 'Olivia',
      lastName: 'Mutua',
      email: 'olivia.mutua@cms.org',
      roles: ['CMS_ADMIN'],
    },
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

  async getUserDetailsFromAuthService(userId: string): Promise<any> {
    const user = this.mockUsers.find((u) => u.id === userId);
    if (!user) throw new BadRequestException(`User ${userId} not found`);
    return user;
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
