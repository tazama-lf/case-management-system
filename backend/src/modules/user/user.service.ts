import { Injectable } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { UserGroupDetails } from './types/UserList';

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
        const users = await axios.get<UserGroupDetails[]>(`${this.AuthBaseUrl}/auth/user/${role}?groupName=${tenantName}`, {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });
        return users.data;
    }

    async getUser(token: string, role: string, tenantName: string, userId: string): Promise<UserGroupDetails | undefined> {
        const users = await this.getUsersByRole(token, role, tenantName);
        return users.find(user => user.id === userId);
    }
}
