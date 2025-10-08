import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthHelperService {

  constructor(private readonly httpService: HttpService) {}
  /**
   * Fetch all users from Keycloak and filter by role
   * @param roleName The role to filter by (e.g., 'CMS_INVESTIGATOR')
   */
  async getAllUsersWithRole(roleName: string): Promise<any[]> {
    const { AUTH_URL, KEYCLOAK_REALM, CLIENT_ID, CLIENT_SECRET } = process.env;
    if (!AUTH_URL || !KEYCLOAK_REALM || !CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Missing Keycloak configuration in environment variables');
    }
    const tokenUrl = `${AUTH_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const usersUrl = `${AUTH_URL}/admin/realms/${KEYCLOAK_REALM}/users`;
    // Get access token
    const tokenRes = await this.httpService
      .post(
        tokenUrl,
        new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: String(CLIENT_ID),
          client_secret: String(CLIENT_SECRET),
        }),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
      )
      .toPromise();
    const accessToken = tokenRes?.data?.access_token;
    if (!accessToken) {
      throw new Error('Could not obtain access token');
    }
    // Get all users
    const usersRes = await this.httpService
      .get(usersUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
        params: {
          max: 1000, // adjust as needed
        },
      })
      .toPromise();
    if (!usersRes?.data) {
      throw new Error('Could not fetch users');
    }
    // Filter users by role
    const filteredUsers: any[] = [];
    for (const userObj of usersRes.data) {
      try {
        const roles = await this.getUserRolesFromAuthService(userObj.id);
        if (roles.includes(roleName)) {
          filteredUsers.push(userObj);
        }
      } catch (e) {
        // skip users with role fetch errors
      }
    }
    return filteredUsers;
  }
  

  async getUserRolesFromAuthService(userId: string): Promise<string[]> {
    const { AUTH_URL, KEYCLOAK_REALM, CLIENT_ID, CLIENT_SECRET } = process.env;

    if (!AUTH_URL || !KEYCLOAK_REALM || !CLIENT_ID || !CLIENT_SECRET) {
      throw new BadRequestException('Missing Keycloak configuration in environment variables');
    }

    const tokenUrl = `${AUTH_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const userRolesUrl = `${AUTH_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}/role-mappings/realm`;

    try {
      // Get access token
      const tokenRes = await firstValueFrom(
        this.httpService.post(
          tokenUrl,
          new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: String(CLIENT_ID),
            client_secret: String(CLIENT_SECRET),
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );
      const accessToken = tokenRes.data.access_token;

      // Get user roles
      const rolesRes = await firstValueFrom(
        this.httpService.get(userRolesUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }),
      );

      return rolesRes.data.map((role) => role.name);
    } catch (err) {
      // Optionally log error here
      throw new BadRequestException('Could not validate user roles');
    }
  }


  async userExists(userId: string): Promise<boolean> {
    const { AUTH_URL, KEYCLOAK_REALM, CLIENT_ID, CLIENT_SECRET } = process.env;

    if (!AUTH_URL || !KEYCLOAK_REALM || !CLIENT_ID || !CLIENT_SECRET) {
      throw new BadRequestException('Missing Keycloak configuration in environment variables');
    }

    const tokenUrl = `${AUTH_URL}/realms/${KEYCLOAK_REALM}/protocol/openid-connect/token`;
    const userUrl = `${AUTH_URL}/admin/realms/${KEYCLOAK_REALM}/users/${userId}`;

    try {
      // Get access token
      const tokenRes = await firstValueFrom(
        this.httpService.post(
          tokenUrl,
          new URLSearchParams({
            grant_type: 'client_credentials',
            client_id: String(CLIENT_ID),
            client_secret: String(CLIENT_SECRET),
          }),
          { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
        ),
      );

      const accessToken = tokenRes.data.access_token;
      if (!accessToken) throw new Error('Could not obtain access token');

      // Fetch user from Keycloak
      const userRes = await firstValueFrom(
        this.httpService.get(userUrl, {
          headers: { Authorization: `Bearer ${accessToken}` },
        }),
      );

      return !!userRes?.data?.id;
    } catch (error) {

      if (error.response?.status === 404) {
        return false;
      }
      console.warn(`Error checking user existence for ${userId}:`, error.message);
      throw new BadRequestException('Error verifying user existence in Keycloak');
    }
  }

  async userHasRole(userId: string, requiredRole: string): Promise<boolean> {
    try {
      const roles = await this.getUserRolesFromAuthService(userId);
      return roles.includes(requiredRole);
    } catch (err) {
      console.warn(`Error checking role for user ${userId}:`, err.message);
      throw new BadRequestException('Error verifying user roles in Keycloak');
    }
  }
}
