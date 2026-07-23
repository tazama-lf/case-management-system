import type { Request } from 'express';
import type { TazamaToken, ClaimValidationResult } from '@tazama-lf/auth-lib';

export interface CMSToken extends TazamaToken {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  tenantName: string;
}

export interface AuthenticatedUser {
  token: TazamaToken;
  validated: ClaimValidationResult;
  validClaims: string[];
  tenantId: string;
  userId: string;
  actorName?: string;
  actorRole: string;
  actorEmail?: string;
  sourceIP?: string;
  allowedStatuses?: string[];
  tenantName: string;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  [key: string]: unknown;
}

export type { ClaimValidationResult };
