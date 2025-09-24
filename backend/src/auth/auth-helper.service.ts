import { Injectable, BadRequestException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';

@Injectable()
export class AuthHelperService {
  constructor(private readonly httpService: HttpService) {}

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
}
