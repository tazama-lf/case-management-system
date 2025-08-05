import { HttpService } from '@nestjs/axios';
import {
  Injectable,
  Logger,
  UnauthorizedException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import * as fs from 'fs';

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

      const refreshToken =
        response.data?.refresh_token || response.data?.refreshToken;

      this.logger.log('Login successful');
      return {
        token,
        refreshToken,
        expiresIn: response.data?.expires_in || response.data?.expiresIn,
      };
    } catch (error) {
      // Distinguish between invalid credentials and service errors
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

  async refreshToken(refreshToken: string) {
    const authUrl = this.configService.get<string>('TAZAMA_AUTH_URL');
    const refreshUrl = this.configService.get<string>(
      'TAZAMA_AUTH_REFRESH_URL',
    );

    if (!authUrl) {
      this.logger.error('TAZAMA_AUTH_URL is not set in environment variables');
      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    }

    // Use configured refresh URL or construct from auth URL
    const tokenRefreshUrl =
      refreshUrl ||
      authUrl.replace('/login', '/refresh') ||
      `${authUrl}/refresh`;

    try {
      const response = await firstValueFrom(
        this.httpService.post(tokenRefreshUrl, {
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        }),
      );

      const newToken =
        typeof response.data === 'string'
          ? response.data
          : response.data?.token ||
            response.data?.access_token ||
            response.data?.jwt ||
            response.data?.user?.token;

      const newRefreshToken =
        response.data?.refresh_token ||
        response.data?.refreshToken ||
        refreshToken;

      this.logger.log('Token refresh successful');
      return {
        token: newToken,
        refreshToken: newRefreshToken,
        expiresIn: response.data?.expires_in || response.data?.expiresIn,
      };
    } catch (error) {
      // Distinguish between invalid/expired refresh token and service errors
      if (error.response && error.response.status === 401) {
        this.logger.warn('Invalid or expired refresh token');
        throw new UnauthorizedException('Invalid or expired refresh token');
      }
      this.logger.error(
        `Auth service error during token refresh: ${error.message}`,
      );
      throw new ServiceUnavailableException(
        'Authentication service unavailable',
      );
    }
  }

  private async validateToken(token: string): Promise<boolean> {
    try {
      const keyPath = process.env.AUTH_PUBLIC_KEY_PATH;
      if (!keyPath) {
        throw new Error('AUTH_PUBLIC_KEY_PATH environment variable is not set');
      }
      const publicKey = fs.readFileSync(keyPath, 'utf8');
      jwt.verify(token, publicKey, { algorithms: ['RS256'] });
      return true;
    } catch (error) {
      this.logger.warn(`Token validation failed: ${error.message}`);
      return false;
    }
  }

  private async getTokenExpiry(token: string): Promise<Date | null> {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        return new Date(decoded.exp * 1000); // Convert from seconds to milliseconds
      }
      return null;
    } catch (error) {
      this.logger.warn(`Failed to get token expiry: ${error.message}`);
      return null;
    }
  }

  public isTokenExpired(token: string): boolean {
    try {
      const decoded = jwt.decode(token) as any;
      if (decoded && decoded.exp) {
        const currentTime = Math.floor(Date.now() / 1000);
        return decoded.exp < currentTime;
      }
      return true; // If we can't determine expiry, consider it expired
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
        return Math.max(0, decoded.exp - currentTime); // Return seconds until expiry
      }
      return 0;
    } catch (error) {
      this.logger.warn(`Failed to get time to expiry: ${error.message}`);
      return 0;
    }
  }
}
