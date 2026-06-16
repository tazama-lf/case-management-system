import { HttpService } from '@nestjs/axios';
import { Injectable, UnauthorizedException, ServiceUnavailableException, BadRequestException, NotFoundException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { firstValueFrom } from 'rxjs';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import type { AxiosError, AxiosResponse } from 'axios';
import { AuthLoginResponse, AuthServiceUserResponse, AuthUser } from 'src/utils/interfaces/Auth.interface';
import { CacheService } from '../shared/cache.service';
import { TazamaAuthGuard } from 'src/guards/tazama-auth.guard';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
    private readonly cacheService: CacheService,
    private readonly authGuard: TazamaAuthGuard,
    private readonly prisma: PrismaService,
  ) {}

  async login(username: string, password: string): Promise<{ message: string; token: string; expiresIn: number | null }> {
    const authUrl = this.configService.get<string>('TAZAMA_AUTH_URL');
    if (!authUrl) {
      throw new ServiceUnavailableException('Authentication service unavailable');
    }
    try {
      const response: AxiosResponse<AuthLoginResponse | string | null> = await firstValueFrom(
        this.httpService.post<AuthLoginResponse | string | null>(`${authUrl}/login`, { username, password }),
      );
      const { data } = response;

      if (data === null) {
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
        throw new ServiceUnavailableException('Authentication service unavailable');
      }

      if (expiresIn === null) {
        const derivedExpiry = this.getTokenTimeToExpiry(token);
        if (derivedExpiry > 0) {
          expiresIn = derivedExpiry;
        }
      }

      this.logger.log('Login successful');

      this.storeUserName(token).catch((error: unknown) => {
        if (error instanceof Error) {
          this.logger.error('Error storing user name:', error);
        }
      });

      /* This implementation will happen after successful login and token retrieval in auth.service.
       * Add Method here use tazama-auth.guard extractInnerToken to get name etc
       * extractInnerToken.name gets you the the name and tenant_id
       * sub gets the innerToken
       * Check in DB if this userId exist, if it does check if name matches,
       * if it does not match update the name in DB with the name from token,
       * if it does not exist create a new record with userId and name from token.
       * This is to ensure that we have the latest name for the user in our DB,
       * as the name can be updated in Keycloak and we want to reflect that in our
       * system without requiring the user to login again after the name change.
       */
      // Add delay to ensure all services (especially Redis) are initialized
      setTimeout(() => {
        this.cacheService.initializeUserCache(0, token).catch((error: unknown) => {
          if (error instanceof Error) {
            this.logger.error('Cache initialization error:', error);
            this.logger.warn(`Cache initialization failed (non-blocking): ${error.message}`, CacheService.name);
          } else {
            this.logger.error('Cache initialization failed with non-error value:', error);
          }
        });
      }, 2000); // Wait 2 seconds before initializing cache

      return {
        message: 'Login successful',
        token,
        expiresIn,
      };
    } catch (error: unknown) {
      if (this.hasStatus(error, 401)) {
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
    return typeof payload === 'object' && payload !== null && 'exp' in payload && typeof payload.exp === 'number';
  }

  async getUserRolesFromAuthService(userId: string): Promise<string[]> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    try {
      const authServiceUrl = this.getAuthServiceBaseUrl();
      const url = `${authServiceUrl}/users/${encodeURIComponent(userId)}/roles`;

      const { data } = await firstValueFrom(
        this.httpService.get<{ roles: string[] }>(url, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      return Array.isArray(data.roles) ? data.roles : [];
    } catch (error) {
      return this.handleAuthServiceError('fetch user roles', error, userId);
    }
  }

  async getUserDetailsFromAuthService(userId: string): Promise<AuthUser> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    try {
      const authServiceUrl = this.getAuthServiceBaseUrl();
      const url = `${authServiceUrl}/users/${encodeURIComponent(userId)}`;

      const { data } = await firstValueFrom(
        this.httpService.get<AuthServiceUserResponse>(url, {
          headers: { 'Content-Type': 'application/json' },
        }),
      );

      if (!data.id) {
        throw new BadRequestException(`User ${userId} not found`);
      }

      return this.mapAuthServiceUser(data);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.handleAuthServiceError('fetch user details', error, userId);
      throw new BadRequestException(`User ${userId} not found`);
    }
  }

  async userExists(userId: string): Promise<boolean> {
    if (!userId) {
      return false;
    }

    try {
      await this.getUserDetailsFromAuthService(userId);
      return true;
    } catch {
      return false;
    }
  }

  private mapAuthServiceUser(user: AuthServiceUserResponse): AuthUser {
    return {
      id: user.id,
      username: user.username ?? '',
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? '',
      email: user.email ?? '',
      roles: Array.isArray(user.roles) ? user.roles : [],
    };
  }

  private getAuthServiceBaseUrl(): string {
    const authUrl = this.configService.get<string>('TAZAMA_AUTH_URL');
    if (!authUrl) {
      this.logger.error('TAZAMA_AUTH_URL is not set in environment variables', AuthService.name);
      throw new ServiceUnavailableException('Authentication service configuration missing');
    }
    // Remove /v1/auth/login suffix if present and replace with base path

    const baseUrl = authUrl.replace(/\/v1\/auth\/login\/?$/v, '');
    return baseUrl;
  }

  private handleAuthServiceError(operation: string, error: unknown, context?: string): never {
    const axiosError = error as AxiosError | undefined;
    const status = axiosError?.response?.status;
    const errorData = axiosError?.response?.data as { message?: string; error?: string } | string | undefined;

    // Extract error message - handle both object and string responses
    let errorMessage: string;
    let statusText: string;
    if (typeof errorData === 'string') {
      errorMessage = errorData;
      statusText = errorData;
    } else if (errorData && typeof errorData === 'object') {
      errorMessage = errorData.message ?? errorData.error ?? JSON.stringify(errorData);
      statusText = errorMessage;
    } else {
      statusText = axiosError?.response?.statusText ?? axiosError?.message ?? 'Unknown error';
      errorMessage = statusText;
    }

    const contextMsg = context ? ` (${context})` : '';
    this.logger.error(`Auth-service ${operation} failed${contextMsg}: ${status ?? 'N/A'} ${statusText}`, AuthService.name);

    if (status === 404) {
      this.logger.warn('Auth-service endpoint not found. The auth-service may not implement this endpoint yet.', AuthService.name);
      throw new NotFoundException(`User data not found${contextMsg}`);
    }

    if (status === 500) {
      // Log the detailed error message
      this.logger.error(`Auth-service error details: ${errorMessage}`, AuthService.name);

      // Provide more specific error messages based on common issues
      if (typeof errorMessage === 'string' && (errorMessage.includes('No group found') || errorMessage.includes('No subgroup found'))) {
        throw new NotFoundException(
          `Role ${contextMsg} not found in Keycloak. Please ensure the role exists and is properly configured in the Keycloak group structure.`,
        );
      }

      throw new ServiceUnavailableException(
        `Authentication service error: ${errorMessage}. Please check the role configuration in Keycloak.`,
      );
    }

    throw new ServiceUnavailableException('Authentication service unavailable');
  }

  private async storeUserName(token: string): Promise<void> {
    this.logger.log('Storing user name from token into database if needed');

    const innerDecoded = this.authGuard.extractInnerToken(token);
    const userId = innerDecoded.sub as string;
    const name = innerDecoded.name as string;
    const tenantId = innerDecoded.tenant_id as string;

    const userDetails = await this.prisma.cms_usernames.findFirst({
      where: {
        user_id: userId,
      },
    });

    if (userDetails) {
      if (userDetails.name !== name) {
        await this.prisma.cms_usernames.update({
          where: { id: userDetails.id },
          data: { name, updated_at: new Date() },
        });
        this.logger.log(`Updated name for user ${userId} in database`);
      }
    } else {
      // Create a new user record
      await this.prisma.cms_usernames.create({
        data: {
          user_id: userId,
          name,
          tenant_id: tenantId,
          created_at: new Date(),
        },
      });
      this.logger.log(`Created new user ${userId} in database`);
    }
  }
}
