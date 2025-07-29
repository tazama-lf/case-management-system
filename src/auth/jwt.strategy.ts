import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';

// Define the JWT payload interface
interface JwtPayload {
  sub: string;
  username: string;
  role: string;
  permissions: string[];
  tenantId: string;
  // ...other claims as needed
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor() {
    const publicKey = process.env.AUTH_PUBLIC_KEY;
    if (!publicKey) {
      throw new Error('AUTH_PUBLIC_KEY environment variable is not set');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: publicKey,
      algorithms: ['RS256'],
    });
  }

  async validate(payload: JwtPayload) {
    // Validate required claims
    if (!payload.role || !payload.permissions || !payload.tenantId) {
      throw new Error('Invalid token: missing required claims');
    }
    return payload;
  }
}