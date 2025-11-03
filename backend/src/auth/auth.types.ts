import { Request } from 'express';
import { TazamaToken as BaseTazamaToken } from '@tazama-lf/auth-lib';

export interface TazamaToken extends Partial<BaseTazamaToken> {
  clientId: string;
  claims: string[];
  tenantId?: string;
  realmRoles?: string[];
  preferredUsername?: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  subject?: string;
  issuer?: string;
  expiresAt?: number;
  issuedAt?: number;
  raw?: Record<string, unknown>;
}

export interface AuthenticatedUser {
  token: TazamaToken;
  validClaims: string[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  [key: string]: unknown;
}
