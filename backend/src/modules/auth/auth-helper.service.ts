/* eslint-disable complexity */
import { Injectable, BadRequestException, ServiceUnavailableException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import type { AxiosError } from 'axios';
import { LoggerService } from '@tazama-lf/frms-coe-lib';

export interface AuthUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

interface AuthServiceUserResponse {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roles?: string[];
}

interface KeycloakGroup {
  id: string;
  name: string;
}

interface KeycloakSubGroup extends KeycloakGroup {
  realmRoles?: string[];
}

interface KeycloakGroupMember {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

@Injectable()
export class AuthHelperService {
  constructor(
    private readonly http: HttpService,
    private readonly configService: ConfigService,
    private readonly logger: LoggerService,
  ) {}

  async getAllUsersWithRole(roleName: string, token?: string, groupName?: string): Promise<AuthUser[]> {
    const normalizedRole = roleName.trim();
    if (!normalizedRole) {
      throw new BadRequestException('Role name is required');
    }

    const effectiveGroupName = groupName || this.configService.get<string>('KEYCLOAK_GROUP_NAME');

    try {
      const authServiceUrl = this.getAuthServiceBaseUrl();
      // Auth-service endpoint: GET /v1/auth/user/:rolename?groupName=xxx
      let url = `${authServiceUrl}/user/${encodeURIComponent(normalizedRole)}`;
      if (effectiveGroupName) {
        url += `?groupName=${encodeURIComponent(effectiveGroupName)}`;
      }

      this.logger.log(
        `Fetching users with role ${normalizedRole} from auth-service at ${url}${token ? ' (with Bearer token)' : ' (no token provided)'}`,
        AuthHelperService.name,
      );

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const { data } = await firstValueFrom(
        this.http.get<AuthServiceUserResponse[]>(url, {
          headers,
          timeout: 5000,
        }),
      );

      if (!Array.isArray(data)) {
        this.logger.warn(`Auth-service returned non-array response for role ${normalizedRole}`, AuthHelperService.name);
        return [];
      }

      this.logger.log(`Found ${data.length} users with role ${normalizedRole}`, AuthHelperService.name);

      return data.map((user) => this.mapAuthServiceUser(user));
    } catch (error) {
      const axiosError = error as AxiosError;

      // Log the auth-service error with details
      const status = axiosError.response?.status;
      const errorData = axiosError.response?.data as { message?: string; error?: string } | string | undefined;

      // Extract error message - handle both object and string responses
      let errorMessage: string;
      if (typeof errorData === 'string') {
        errorMessage = errorData;
      } else if (errorData && typeof errorData === 'object') {
        errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
      } else {
        errorMessage = axiosError.message;
      }

      // Log the full error data for debugging
      this.logger.warn(
        `Auth-service call failed for role '${normalizedRole}': ${status ?? 'No response'} - ${errorMessage}`,
        AuthHelperService.name,
      );

      // Check if this is a role not found error - no need for fallback in this case
      if (status === 500 && errorMessage && typeof errorMessage === 'string') {
        if (errorMessage.includes('No group found') || errorMessage.includes('No subgroup found')) {
          this.logger.warn(`Role '${normalizedRole}' not found in Keycloak. Skipping fallback.`, AuthHelperService.name);
          throw new NotFoundException(
            `Role '${normalizedRole}' not found in Keycloak. Please ensure the role exists and is properly configured in the Keycloak group structure.`,
          );
        }
      }

      // Try fallback for network errors or 5xx errors
      if (!axiosError.response || (status && status >= 500)) {
        const fallbackUsers = await this.fetchUsersByRoleFromKeycloak(normalizedRole, effectiveGroupName);
        if (fallbackUsers !== null) {
          this.logger.log(
            `Successfully retrieved ${fallbackUsers.length} users via Keycloak fallback for role '${normalizedRole}'`,
            AuthHelperService.name,
          );
          return fallbackUsers;
        }
        this.logger.error(
          `Both auth-service and Keycloak fallback failed for role '${normalizedRole}'. ` +
            'Please check: 1) auth-service is running and configured correctly, ' +
            '2) CLIENT_ID and CLIENT_SECRET are valid Keycloak service account credentials with admin permissions.',
          AuthHelperService.name,
        );
      }

      if (status === 404) {
        this.logger.warn(
          `Auth-service endpoint returned 404 for role '${normalizedRole}'. The role may not exist or no users are assigned to it.`,
          AuthHelperService.name,
        );
        return [];
      }
      if (status === 401) {
        this.logger.error(
          `Auth-service returned 401 Unauthorized when fetching users for role '${normalizedRole}'. Make sure a valid bearer token is provided.`,
          AuthHelperService.name,
        );
        return [];
      }
      return this.handleAuthServiceError('fetch users by role', error, roleName);
    }
  }

  async getUserRolesFromAuthService(userId: string): Promise<string[]> {
    if (!userId) {
      throw new BadRequestException('User ID is required');
    }

    try {
      const authServiceUrl = this.getAuthServiceBaseUrl();
      const url = `${authServiceUrl}/users/${encodeURIComponent(userId)}/roles`;

      const { data } = await firstValueFrom(
        this.http.get<{ roles: string[] }>(url, {
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
        this.http.get<AuthServiceUserResponse>(url, {
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

  async userHasRole(userId: string, requiredRole: string): Promise<boolean> {
    if (!userId || !requiredRole) {
      throw new BadRequestException('User ID and role are required');
    }

    try {
      const roles = await this.getUserRolesFromAuthService(userId);
      return roles.includes(requiredRole);
    } catch {
      this.logger.warn(`Error checking role ${requiredRole} for user ${userId}`, AuthHelperService.name);
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
      this.logger.error('TAZAMA_AUTH_URL is not set in environment variables', AuthHelperService.name);
      throw new ServiceUnavailableException('Authentication service configuration missing');
    }
    // Remove /v1/auth/login suffix if present and replace with base path
    const baseUrl = authUrl.replace(/\/v1\/auth\/login\/?$/, '');
    return `${baseUrl}`;
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
      errorMessage = errorData.message || errorData.error || JSON.stringify(errorData);
      statusText = errorMessage;
    } else {
      statusText = axiosError?.response?.statusText ?? axiosError?.message ?? 'Unknown error';
      errorMessage = statusText;
    }

    const contextMsg = context ? ` (${context})` : '';
    this.logger.error(`Auth-service ${operation} failed${contextMsg}: ${status ?? 'N/A'} ${statusText}`, AuthHelperService.name);

    if (status === 404) {
      this.logger.warn('Auth-service endpoint not found. The auth-service may not implement this endpoint yet.', AuthHelperService.name);
      throw new NotFoundException(`User data not found${contextMsg}`);
    }

    if (status === 500) {
      // Log the detailed error message
      this.logger.error(`Auth-service error details: ${errorMessage}`, AuthHelperService.name);

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

  private async fetchUsersByRoleFromKeycloak(roleName: string, groupName?: string): Promise<AuthUser[] | null> {
    const AUTH_URL = this.configService.get<string>('AUTH_URL');
    const KEYCLOAK_REALM = this.configService.get<string>('KEYCLOAK_REALM');
    const CLIENT_ID = this.configService.get<string>('CLIENT_ID');
    const CLIENT_SECRET = this.configService.get<string>('CLIENT_SECRET');
    const effectiveGroupName = groupName || this.configService.get<string>('KEYCLOAK_GROUP_NAME');

    // Check for missing or placeholder values
    const isPlaceholder = (value: string | undefined): boolean => {
      if (!value) return true;
      const lower = value.toLowerCase();
      return lower.includes('your-') || lower.includes('placeholder') || lower.includes('replace-me') || lower === 'changeme';
    };

    if (
      !AUTH_URL ||
      !KEYCLOAK_REALM ||
      !CLIENT_ID ||
      !CLIENT_SECRET ||
      !effectiveGroupName ||
      isPlaceholder(CLIENT_ID) ||
      isPlaceholder(CLIENT_SECRET)
    ) {
      this.logger.warn(
        'Skipping direct Keycloak fallback: required configuration (AUTH_URL, KEYCLOAK_REALM, CLIENT_ID, CLIENT_SECRET, KEYCLOAK_GROUP_NAME) is missing or contains placeholder values. ' +
          `CLIENT_ID=${CLIENT_ID ? '***' : 'missing'}, CLIENT_SECRET=${CLIENT_SECRET ? '***' : 'missing'}`,
        AuthHelperService.name,
      );
      return null;
    }

    const baseUrl = AUTH_URL.replace(/\/$/, '');

    try {
      const serviceToken = await this.requestKeycloakServiceToken(baseUrl, KEYCLOAK_REALM, CLIENT_ID, CLIENT_SECRET);
      const group = await this.getKeycloakGroup(baseUrl, KEYCLOAK_REALM, effectiveGroupName, serviceToken);
      if (!group) {
        this.logger.warn(`Keycloak group '${effectiveGroupName}' not found when resolving role '${roleName}'`, AuthHelperService.name);
        return [];
      }

      const subGroup = await this.getKeycloakSubGroupWithRole(baseUrl, KEYCLOAK_REALM, group.id, roleName, serviceToken);
      if (!subGroup) {
        this.logger.warn(
          `Role '${roleName}' not found within group '${effectiveGroupName}' while using Keycloak fallback`,
          AuthHelperService.name,
        );
        return [];
      }

      const members = await this.getKeycloakGroupMembers(baseUrl, KEYCLOAK_REALM, subGroup.id, serviceToken);

      this.logger.log(
        `Keycloak fallback resolved ${members.length} users for role '${roleName}' in group '${effectiveGroupName}'`,
        AuthHelperService.name,
      );

      return members.map((member) => ({
        id: member.id,
        username: member.username ?? '',
        firstName: member.firstName ?? '',
        lastName: member.lastName ?? '',
        email: member.email ?? '',
        roles: [],
      }));
    } catch (fallbackError) {
      const err = fallbackError instanceof Error ? fallbackError : new Error('Unknown Keycloak fallback error');
      this.logger.error(`Direct Keycloak fallback failed for role '${roleName}': ${err.message}`, AuthHelperService.name);
      return null;
    }
  }

  private async requestKeycloakServiceToken(baseUrl: string, realm: string, clientId: string, clientSecret: string): Promise<string> {
    const tokenUrl = `${baseUrl}/realms/${realm}/protocol/openid-connect/token`;
    const params = new URLSearchParams();
    params.append('grant_type', 'client_credentials');
    params.append('client_id', clientId);
    params.append('client_secret', clientSecret);

    const { data } = await firstValueFrom(
      this.http.post<{ access_token?: string }>(tokenUrl, params.toString(), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 5000,
      }),
    );

    if (!data.access_token) {
      throw new Error('Keycloak token endpoint did not return an access_token');
    }

    return data.access_token;
  }

  private async getKeycloakGroup(baseUrl: string, realm: string, groupName: string, token: string): Promise<KeycloakGroup | null> {
    const groupUrl = `${baseUrl}/admin/realms/${realm}/groups?search=${encodeURIComponent(groupName)}`;

    const { data } = await firstValueFrom(
      this.http.get<KeycloakGroup[]>(groupUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        timeout: 5000,
      }),
    );

    if (!Array.isArray(data) || data.length === 0) {
      return null;
    }

    return data.find((group) => group.name === groupName) ?? data[0];
  }

  private async getKeycloakSubGroupWithRole(
    baseUrl: string,
    realm: string,
    groupId: string,
    roleName: string,
    token: string,
  ): Promise<KeycloakSubGroup | null> {
    const subgroupUrl = `${baseUrl}/admin/realms/${realm}/groups/${groupId}/children`;

    const { data } = await firstValueFrom(
      this.http.get<KeycloakSubGroup[]>(subgroupUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        timeout: 5000,
      }),
    );

    if (!Array.isArray(data)) {
      return null;
    }

    return data.find((subGroup) => Array.isArray(subGroup.realmRoles) && subGroup.realmRoles.includes(roleName)) ?? null;
  }

  private async getKeycloakGroupMembers(baseUrl: string, realm: string, subGroupId: string, token: string): Promise<KeycloakGroupMember[]> {
    const membersUrl = `${baseUrl}/admin/realms/${realm}/groups/${subGroupId}/members`;

    const { data } = await firstValueFrom(
      this.http.get<KeycloakGroupMember[]>(membersUrl, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/json',
        },
        timeout: 5000,
      }),
    );

    if (!Array.isArray(data)) {
      return [];
    }

    return data;
  }
}
