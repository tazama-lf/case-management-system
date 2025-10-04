import { Request } from 'express';

export interface TazamaToken {
  clientId: string;
  tenantId?: string;
  claims?: string[];
  // ...other fields as needed
}

export interface AuthenticatedUser {
  token: TazamaToken;
  validClaims: string[];
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  [key: string]: any;
}
