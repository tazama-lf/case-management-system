import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
<<<<<<< HEAD
<<<<<<< HEAD
import * as fs from 'fs';

// Define the JWT payload interface
interface JwtPayload {
  sub: string;
  username?: string;
  realm_access?: { roles: string[] };
  claims?: string[];
  tenantId?: string;
  clientId?: string;
  [key: string]: any;
}
=======
>>>>>>> 63fc0de (feat:implementing the auth service)
=======
import * as fs from 'fs';
import * as path from 'path';
>>>>>>> 8017cec (feat:auth)

// Define the JWT payload interface
interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  permissions: string[];
  tenantId: string;
  
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 8017cec (feat:auth)
    const keyPath = process.env.AUTH_PUBLIC_KEY_PATH;
    if (!keyPath) {
      throw new Error('AUTH_PUBLIC_KEY_PATH environment variable is not set');
    }
    let publicKey: string | undefined;
    try {
      publicKey = fs.readFileSync(keyPath, 'utf8');
<<<<<<< HEAD
    } catch {
      throw new Error('Public key file not found or unreadable');
    }
    if (!publicKey) {
      throw new Error('Public key for JWT verification is not set');
=======
    const publicKey = process.env.AUTH_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error('AUTH_PUBLIC_KEY environment variable is not set');
>>>>>>> 63fc0de (feat:implementing the auth service)
=======
    } catch (err) {
      throw new Error('Public key file not found or unreadable');
    }
    if (!publicKey) {
      throw new Error('Public key for JWT verification is not set');
>>>>>>> 8017cec (feat:auth)
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
    });
  }
<<<<<<< HEAD
  /**
   * Validate the JWT payload and extract user information.
   * @param payload The JWT payload containing user information.
   * @returns An object containing the username, roles, permissions, and tenantId.
   */
  async validate(payload: JwtPayload) {
    console.log('JWT payload:', JSON.stringify(payload, null, 2));
    const user_id = payload.sub || payload.clientId;
    const tenantId = payload.tenant_id || payload.tenantId;
    const roles = payload.realm_access?.roles || payload.claims || [];

    if (!user_id) {
      throw new Error('Invalid token: missing sub user_id or clientId');
    }
    if (!tenantId) {
      throw new Error('Invalid token: missing tenant_id or tenantId');
    }
    if (!roles.length) {
      throw new Error('Invalid token: missing roles in realm_access or claims');
    }

    return {
      role: roles,
      permissions: roles,
      tenantId,
      user_id,
    };
  }
}
=======

  async validate(payload: JwtPayload) {
    // Validate required claims
    if (!payload.role || !payload.permissions || !payload.tenantId) {
      throw new Error('Invalid token: missing required claims');
    }
    return payload;
  }
}
>>>>>>> 63fc0de (feat:implementing the auth service)
