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
      const users = await axios.get<UserGroupDetails[]>(`${this.AuthBaseUrl}/user/${encodeURIComponent(role)}`, {
        params: {
          groupName: tenantName,
        },
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });
      return users.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        this.logger.error(`Auth service error fetching users by role: ${error.response?.status} ${error.response?.statusText ?? ''}`);
        const cause = error.response?.data ? new Error('Upstream error details redacted') : error;
        throw new Error(`Failed to fetch users with role ${role}: upstream returned ${error.response?.status}`, { cause });
      }
      throw error;
    }
  }
}
