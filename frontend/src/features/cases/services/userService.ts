import apiClient from '@/shared/services/apiClient';

export interface UserOption {
  id: string;
  name: string;
  role?: string;
  firstName: string;
  lastName: string;
}

export interface UserDetails {
  id: string;
  createdTimestamp: number;
  username: string;
  enabled: boolean;
  totp: boolean;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
  email: string;
  disableableCredentialTypes: string[];
  requiredActions: string[];
  notBefore: number;
}

class UserService {
  private readonly baseUrl = '/v1/user';

  async getUsersByRole(role: string): Promise<UserOption[]> {
    try {
      const response = await apiClient.get<any[]>(
        `${this.baseUrl}/list-by-role/${role}`,
      );

      // Transform the response to match our UserOption interface
      return response
        .map((user: any) => ({
          id: user.userId || user.id || '',
          name: user.displayName || user.username || user.name || 'Unknown',
          role: user.role,
          firstName: user.firstName,
          lastName: user.lastName,
        }))
        .filter((user) => user.id); // Filter out users without IDs
    } catch (error) {
      console.error(`Failed to fetch users with role ${role}:`, error);
      return [];
    }
  }

  async getUserDetailsById(userId: string): Promise<UserDetails | null> {
    try {
      // First try to get from investigators
      const investigators = await apiClient.get<UserDetails[]>(
        `${this.baseUrl}/list-by-role/CMS_INVESTIGATOR`,
      );
      const investigator = investigators.find((user) => user.id === userId);
      if (investigator) return investigator;

      // Then try supervisors
      const supervisors = await apiClient.get<UserDetails[]>(
        `${this.baseUrl}/list-by-role/CMS_SUPERVISOR`,
      );
      const supervisor = supervisors.find((user) => user.id === userId);
      if (supervisor) return supervisor;

      return null;
    } catch (error) {
      console.error(`Failed to fetch user details for ${userId}:`, error);
      return null;
    }
  }

  formatUserName(user: UserDetails | null): string {
    if (!user) return 'Unknown';
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
    return fullName || user.username || user.email || 'Unknown';
  }

  async getInvestigators(): Promise<UserOption[]> {
    return await this.getUsersByRole('CMS_INVESTIGATOR');
  }

  async getSupervisors(): Promise<UserOption[]> {
    return await this.getUsersByRole('CMS_SUPERVISOR');
  }

  async getComplianceOfficers(): Promise<UserOption[]> {
    return await this.getUsersByRole('CMS_COMPLIANCE_OFFICER');
  }

  async getAllUsers(): Promise<UserOption[]> {
    try {
      // Fetch both investigators and supervisors
      const [investigators, supervisors] = await Promise.all([
        this.getInvestigators(),
        this.getSupervisors(),
      ]);

      // Combine and remove duplicates
      const combined = [...investigators, ...supervisors];
      const uniqueUsers = Array.from(
        new Map(combined.map((u) => [u.id, u])).values(),
      );

      return uniqueUsers.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error('Failed to fetch all users:', error);
      return [];
    }
  }
}

export default new UserService();
