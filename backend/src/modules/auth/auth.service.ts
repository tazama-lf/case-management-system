import { HttpService } from '@nestjs/axios';
import { Injectable, UnauthorizedException, ServiceUnavailableException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { AxiosError, AxiosResponse } from 'axios';

interface AuthLoginResponse {
  token?: string;
  access_token?: string;
  jwt?: string;
  user?: {
    token?: string;
  };
  expires_in?: number;
  expiresIn?: number;
}

@Injectable()
export class AuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async login(username: string, password: string): Promise<{ message: string; token: string; expiresIn: number | null }> {
    const authUrl = this.configService.get<string>('TAZAMA_AUTH_URL');
    if (!authUrl) {
      this.logger.error('TAZAMA_AUTH_URL is not set in environment variables');
      throw new ServiceUnavailableException('Authentication service unavailable');
    }
    try {
      const response: AxiosResponse<AuthLoginResponse | string | null> = await firstValueFrom(
        this.httpService.post<AuthLoginResponse | string | null>(`${authUrl}/login`, { username, password }),
      );
      const { data } = response;

      if (data == null) {
        this.logger.error('Auth service did not return a valid response', AuthService.name);
        throw new ServiceUnavailableException('Authentication service unavailable');
      }
      let token: string | undefined;
      let expiresIn: number | null = null;

      if (typeof data === 'string') {
        token = data;
      } else {
        const loginData: AuthLoginResponse = data;
        token = loginData.token ?? loginData.access_token ?? loginData.jwt ?? loginData.user?.token;
        expiresIn = loginData.expires_in ?? loginData.expiresIn ?? null;
      }

      if (!token) {
        this.logger.error('Auth service response missing token payload', AuthService.name);
        throw new ServiceUnavailableException('Authentication service unavailable');
      }

      if (expiresIn === null) {
        const derivedExpiry = this.getTokenTimeToExpiry(token);
        if (derivedExpiry > 0) {
          expiresIn = derivedExpiry;
        }
      }

      this.logger.log('Login successful');
      return {
        message: 'Login successful',
        token,
        expiresIn,
      };
    } catch (error: unknown) {
      if (this.hasStatus(error, 401)) {
        this.logger.warn(`Invalid credentials for user ${username}`);
        throw new UnauthorizedException('Invalid credentials');
      }
      const message = error instanceof Error ? error.message : 'Unknown authentication service error';
      this.logger.error(`Auth service error during login: ${message}`);
      throw new ServiceUnavailableException('Authentication service unavailable');
    }
  }

  public isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token);
      if (this.hasExpiry(decoded)) {
        const currentTime = Math.floor(Date.now() / 1000);
        return decoded.exp < currentTime;
      }
      return true;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Failed to check token expiry');
      this.logger.warn(`Failed to check token expiry: ${err.message}`);
      return true;
    }
  }

  public getTokenTimeToExpiry(token: string): number {
    try {
      const decoded = jwt.decode(token);
      if (this.hasExpiry(decoded)) {
        const currentTime = Math.floor(Date.now() / 1000);
        return Math.max(0, decoded.exp - currentTime);
      }
      return 0;
    } catch (error: unknown) {
      const err = error instanceof Error ? error : new Error('Failed to get time to expiry');
      this.logger.warn(`Failed to get time to expiry: ${err.message}`);
      return 0;
    }
  }

  private hasStatus(error: unknown, status: number): boolean {
    const axiosError = error as AxiosError | undefined;
    return axiosError?.response?.status === status;
  }

  private hasExpiry(payload: unknown): payload is jwt.JwtPayload & { exp: number } {
    return typeof payload === 'object' && payload !== null && 'exp' in payload && typeof (payload as { exp: unknown }).exp === 'number';
  }
}
