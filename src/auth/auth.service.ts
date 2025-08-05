<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
import { HttpService } from '@nestjs/axios';
<<<<<<< HEAD
<<<<<<< HEAD
import { Injectable, Logger, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

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
      throw new ServiceUnavailableException('Authentication service unavailable');
    }
    try {
      const response = await firstValueFrom(this.httpService.post(authUrl, { username, password }));
      const token =
        typeof response.data === 'string'
  async login(username: string, password: string) {
    const authUrl = this.configService.get<string>('TAZAMA_AUTH_URL');
    if (!authUrl) {
      this.logger.error('TAZAMA_AUTH_URL is not set in environment variables');
      throw new Error('Authentication service unavailable');
    }
    try {
      const response = await firstValueFrom(
        this.httpService.post(authUrl, { username, password }),
      );
      const token =
        typeof response.data === 'string'
          ? response.data
          : response.data?.token || response.data?.access_token || response.data?.jwt || response.data?.user?.token;

      this.logger.log('Login successful');
      return {
        message: 'Login successful',
        token,
        expiresIn: response.data?.expires_in ?? response.data?.expiresIn ?? null,
      };
    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.logger.warn(`Invalid credentials for user ${username}`);
        throw new UnauthorizedException('Invalid credentials');
      }
      this.logger.error(`Auth service error during login: ${error.message}`);
      throw new ServiceUnavailableException('Authentication service unavailable');
    }
  }

  public isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        return decoded.exp < currentTime;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Failed to check token expiry: ${error.message}`);
      return true;
    }
  }

  public getTokenTimeToExpiry(token: string): number {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        return Math.max(0, decoded.exp - currentTime);
      }
      return 0;
    } catch (error) {
      this.logger.warn(`Failed to get time to expiry: ${error.message}`);
      return 0;
    }
  }
}
=======
import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {}
>>>>>>> 977af1c (feat(core): init NestJS with triage mock API)
=======
=======
import { HttpService } from '@nestjs/axios';
>>>>>>> dc05881 (feat:auth)
import { Injectable, Logger } from '@nestjs/common';
=======
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
>>>>>>> 1c9a440 (feat: token refresh functionality implemented)
=======
import {
  Injectable,
  Logger,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
>>>>>>> 4dc8c12 (feat: token refresh functionality implemented)
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {}

<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
  logAudit(action: string, user: any, details?: any) {
    this.logger.log(`[AUDIT] ${action} by user ${user?.sub || 'unknown'} (tenant: ${user?.tenantId || 'unknown'})`, details);
    // In production, persist to DB or external audit log
  }
<<<<<<< HEAD
<<<<<<< HEAD
}
>>>>>>> 63fc0de (feat:implementing the auth service)
=======
    async getCasesForTenant(user: JwtPayload) {
    return this.prisma.case.findMany({
      where: { tenantId: user.tenantId },
    });
  }
<<<<<<< HEAD
}
>>>>>>> 42b4601 (feat:auth)
=======
=======
=======
  // logAudit(action: string, user: any, details?: any) {
  //   this.logger.log(`[AUDIT] ${action} by user ${user?.sub || 'unknown'} (tenant: ${user?.tenantId || 'unknown'})`, details);
  //   // In production, persist to DB or external audit log
  // }
>>>>>>> 37ef2af (feat:auth)
=======
>>>>>>> 94c0713 (feat:Authentication & Authorization)
 
>>>>>>> dd9f997 (feat:auth)

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
<<<<<<< HEAD
<<<<<<< HEAD
<<<<<<< HEAD
    try {
      const response = await firstValueFrom(
        this.httpService.post(authUrl, { username, password })
      );
      this.logger.log('Tazama Auth Service login response received');
      // Always return the token at the top level
      const token = response.data?.token || response.data?.access_token || response.data?.user?.token;
=======
  async login(username: string, password: string) {
    const authUrl = this.configService.get<string>('TAZAMA_AUTH_URL');
    if (!authUrl) {
      this.logger.error('TAZAMA_AUTH_URL is not set in environment variables');
      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    }
    try {
      const response = await firstValueFrom(
        this.httpService.post(authUrl, { username, password }),
      );
      const token =
        typeof response.data === 'string'
          ? response.data
          : response.data?.token ||
            response.data?.access_token ||
            response.data?.jwt ||
            response.data?.user?.token;

      this.logger.log('Login successful');
<<<<<<< HEAD
>>>>>>> ac7173e (feat: Test Coverage)
      return { token };
=======
      return {
        message: 'Login successful',
        token,
        expiresIn:
          response.data?.expires_in ?? response.data?.expiresIn ?? null,
      };
>>>>>>> 1c9a440 (feat: token refresh functionality implemented)
    } catch (error) {
      if (error.response && error.response.status === 401) {
        this.logger.warn(`Invalid credentials for user ${username}`);
        throw new UnauthorizedException('Invalid credentials');
      }
      this.logger.error(`Auth service error during login: ${error.message}`);
      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    }
  }

  public isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        return decoded.exp < currentTime;
      }
      return true;
    } catch (error) {
      this.logger.warn(`Failed to check token expiry: ${error.message}`);
      return true;
    }
  }

  public getTokenTimeToExpiry(token: string): number {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        return Math.max(0, decoded.exp - currentTime);
      }
      return 0;
    } catch (error) {
      this.logger.warn(`Failed to get time to expiry: ${error.message}`);
      return 0;
    }
  }
}
<<<<<<< HEAD
>>>>>>> dc05881 (feat:auth)
=======
}
>>>>>>> 37ef2af (feat:auth)
=======



    
}
>>>>>>> 0842402 (feat:adding auth service)
=======
}
>>>>>>> d0ff41d (feat:adding auth service)
=======
>>>>>>> ac7173e (feat: Test Coverage)
