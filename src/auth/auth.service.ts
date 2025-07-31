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
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

 

      async login(username: string, password: string) {
      const authUrl = this.configService.get<string>('TAZAMA_AUTH_URL');
      if (!authUrl) {
        this.logger.error('TAZAMA_AUTH_URL is not set in environment variables');
        throw new Error('Authentication service unavailable');
      }
      try {
        const response = await firstValueFrom(
          this.httpService.post(authUrl, { username, password })
        );
        const token = typeof response.data === 'string'
          ? response.data
          : response.data?.token || response.data?.access_token || response.data?.jwt || response.data?.user?.token;
        this.logger.log('Login successful');
        return { token };
      } catch (error) {
        this.logger.warn(`Tazama Auth Service login failed: ${error.message}`);
        throw new Error('Authentication failed');
      }
    }
}