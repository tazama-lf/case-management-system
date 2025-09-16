import { Request } from 'express';

export interface TazamaToken {
  clientId: string;
  tenantId?: string;
  claims?: string[];
  // ...other fields as needed
}

export interface ClaimValidationResult {
  isValid?: boolean;
  errors?: string[];
  [claim: string]: boolean | string[] | boolean | undefined;
}

export interface AuthenticatedUser {
  token: TazamaToken;
  validated: ClaimValidationResult;
  validClaims: string[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  [key: string]: any;
}
