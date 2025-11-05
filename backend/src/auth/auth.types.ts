import { Request } from 'express';
import { TazamaToken, ClaimValidationResult } from '@tazama-lf/auth-lib';

export interface CMSToken extends TazamaToken {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  tenantName: string;
}

export interface AuthenticatedUser {
  token: CMSToken;
  validatedClaims: ClaimValidationResult;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  [key: string]: unknown;
}

export { ClaimValidationResult };
