import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { JwtPayload } from 'jsonwebtoken';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from 'prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

  logAudit(action: string, user: any, details?: any) {
    this.logger.log(`[AUDIT] ${action} by user ${user?.sub || 'unknown'} (tenant: ${user?.tenantId || 'unknown'})`, details);
    // In production, persist to DB or external audit log
  }
    async getCasesForTenant(user: JwtPayload) {
    return this.prisma.case.findMany({
      where: { tenantId: user.tenantId },
    });
  }

  async login(username: string, password: string) {
    // Use ConfigService to get the Tazama Auth Service endpoint
    const authUrl = this.configService.get<string>('TAZAMA_AUTH_URL') || 'https://tazama-auth.example.com/api/login';
    try {
      const response = await firstValueFrom(
        this.httpService.post(authUrl, { username, password })
      );
      const { token, user } = response.data;
      // Optionally decode token to get claims if needed
      return { token, user };
    } catch (error) {
      this.logger.warn(`Tazama Auth Service login failed: ${error.message}`);
      throw new Error('Authentication failed');
    }
  }
}