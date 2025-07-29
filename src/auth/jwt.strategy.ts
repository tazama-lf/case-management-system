import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as fs from 'fs';
import * as path from 'path';

// Define the JWT payload interface
interface JwtPayload {
  sub: string;
  username?: string;
  realm_access?: { roles: string[] };
  claims?: string[];
  tenantId?: string;
  [key: string]: any;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const keyPath = process.env.AUTH_PUBLIC_KEY_PATH;
    if (!keyPath) {
      throw new Error('AUTH_PUBLIC_KEY_PATH environment variable is not set');
    }
    let publicKey: string | undefined;
    try {
      publicKey = fs.readFileSync(keyPath, 'utf8');
    } catch (err) {
      throw new Error('Public key file not found or unreadable');
    }
    if (!publicKey) {
      throw new Error('Public key for JWT verification is not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
    });
  }
async validate(payload: JwtPayload) {
  console.log('JWT payload:', payload);

  const roles = payload.realm_access?.roles || payload.claims || [];
  const permissions = payload.claims || [];
  const tenantId = payload.tenantId;
  const username = payload.username || payload.preferred_username || payload.sub;

  if (!tenantId) {
    throw new Error('Invalid token: missing tenantId');
  }

  if (!roles || roles.length === 0) {
    throw new Error('Invalid token: missing roles');
  }

  return {
    ...payload,
    username,
    role: roles,
    permissions,
    tenantId,
  };
}


}