import { Injectable } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { UserGroupDetails } from '../../utils/types/UserList';

@Injectable()
export class UserService {
  private readonly AuthBaseUrl: string;
  constructor(
    private readonly logger: LoggerService,
    private readonly configService: ConfigService,
  ) {
    this.AuthBaseUrl = this.configService.get<string>('TAZAMA_AUTH_URL')!;
  }

  async getUsersByRole(token: string, role: string, tenantName: string): Promise<UserGroupDetails[]> {
    this.logger.log(`Fetching users with role: ${role}`);
    try {
      const users = await axios.get<UserGroupDetails[]>(`${this.AuthBaseUrl}/user/${role}?groupName=${tenantName}`, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      return users.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Auth service error fetching users by role: ${error.response?.status} ${JSON.stringify(error.response?.data)}`);
        throw new Error(`Failed to fetch users with role ${role}: upstream returned ${error.response?.status}`, { cause: error });
      }
      throw error;
    }
  }
}
