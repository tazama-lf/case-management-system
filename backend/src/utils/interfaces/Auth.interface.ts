export interface AuthUser {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  roles: string[];
}

export interface AuthServiceUserResponse {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  roles?: string[];
}

export interface KeycloakGroup {
  id: string;
  name: string;
}

export interface KeycloakSubGroup extends KeycloakGroup {
  realmRoles?: string[];
}

export interface KeycloakGroupMember {
  id: string;
  username?: string;
  firstName?: string;
  lastName?: string;
  email?: string;
}

export interface AuthLoginResponse {
  token?: string;
  access_token?: string;
  jwt?: string;
  user?: {
    token?: string;
  };
  expires_in?: number;
  expiresIn?: number;
}

export interface JwtUser {
  sub: string;
  username: string;
  tenantId: string;
  roles: string[];
}
