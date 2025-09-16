import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validateTokenAndClaims } from '@tazama-lf/auth-lib';
import type { TazamaToken, ClaimValidationResult, AuthenticatedUser } from './auth.types';
import { CLAIMS_KEY, IS_PUBLIC_KEY, ANY_CLAIMS_KEY } from './auth.decorator';

@Injectable()
export class TazamaAuthGuard implements CanActivate {
  private readonly logger = new Logger(TazamaAuthGuard.name);

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const logContext = 'TazamaAuthGuard.canActivate()';

    // Check if route is public
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      this.logger.log('Public route accessed, skipping authentication', logContext);
      return true;
    }

    // Get required claims from decorator
    const requiredClaims = this.reflector.getAllAndOverride<string[]>(CLAIMS_KEY, [context.getHandler(), context.getClass()]);
    const anyRequiredClaims = this.reflector.getAllAndOverride<string[]>(ANY_CLAIMS_KEY, [context.getHandler(), context.getClass()]);

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    // Validate authorization header
    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.warn('No Bearer token provided', logContext);
      throw new UnauthorizedException('No Bearer token provided');
    }

    // Check if we have either type of claims requirement
    if ((!requiredClaims || requiredClaims.length === 0) && (!anyRequiredClaims || anyRequiredClaims.length === 0)) {
      this.logger.warn('No required claims specified for protected route', logContext);
      throw new UnauthorizedException('No required claims specified');
    }

    try {
      const token = authHeader.split(' ')[1];

      // Determine which claims to validate
      const claimsToValidate = requiredClaims || anyRequiredClaims || [];

      // Validate token and claims using tazama-auth-lib
      const validationRaw = validateTokenAndClaims(token, claimsToValidate);

      // Fix: Ensure correct types for isValid and errors
      const validated: ClaimValidationResult = {
        isValid: typeof validationRaw.isValid === 'boolean' ? validationRaw.isValid : false,
        errors: Array.isArray(validationRaw.errors) ? validationRaw.errors : [],
        ...validationRaw,
      };

      let hasValidAccess = false;
      let validClaims: string[] = [];
      let invalidClaims: string[] = [];

      if (requiredClaims && requiredClaims.length > 0) {
        // ALL required claims must be present
        const hasAllClaims = requiredClaims.every((claim) => validated[claim] === true);
        validClaims = requiredClaims.filter((claim) => validated[claim] === true);
        invalidClaims = requiredClaims.filter((claim) => !validated[claim]);
        hasValidAccess = hasAllClaims;

        if (!hasAllClaims) {
          this.logger.warn(
            `User missing required claims. Required: [${requiredClaims.join(', ')}], Invalid: [${invalidClaims.join(', ')}]`,
            logContext,
          );
        }
      } else if (anyRequiredClaims && anyRequiredClaims.length > 0) {
        // ANY of the required claims can satisfy the requirement
        const hasAnyClaim = anyRequiredClaims.some((claim) => validated[claim] === true);
        validClaims = anyRequiredClaims.filter((claim) => validated[claim] === true);
        invalidClaims = anyRequiredClaims.filter((claim) => !validated[claim]);
        hasValidAccess = hasAnyClaim;

        if (!hasAnyClaim) {
          this.logger.warn(
            `User missing any required claims. Required (any of): [${anyRequiredClaims.join(', ')}], Invalid: [${invalidClaims.join(', ')}]`,
            logContext,
          );
        }
      }

      if (!hasValidAccess) {
        throw new UnauthorizedException(`Missing or invalid claims: ${invalidClaims.join(', ')}`);
      }

      // Extract token payload (you might need to decode the JWT to get the full TazamaToken)
      const decodedToken = this.extractTokenPayload(token);

      // Create authenticated user object
      const authenticatedUser: AuthenticatedUser = {
        token: decodedToken,
        validated,
        validClaims,
      };

      // Attach user to request for use in controllers
      request.user = authenticatedUser;

      this.logger.log(
        `Authentication successful for clientId: ${decodedToken.clientId}, tenantId: ${decodedToken.tenantId}, claims: [${validClaims.join(', ')}]`,
        logContext,
      );

      return true;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Authentication failed: ${err.name}: ${err.message}`, logContext);

      if (error instanceof UnauthorizedException) {
        throw error;
      }

      throw new UnauthorizedException('Token validation failed');
    }
  }

  private extractTokenPayload(token: string): TazamaToken {
    try {
      // Decode JWT without verification (since validation is done by tazama-auth-lib)
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token) as TazamaToken;

      if (!decoded) {
        throw new Error('Failed to decode token');
      }

      // Validate required TazamaToken fields
      if (!decoded.clientId) {
        throw new Error('Token missing clientId');
      }

      if (!decoded.tenantId) {
        throw new Error('Token missing tenantId');
      }

      if (!decoded.claims || !Array.isArray(decoded.claims)) {
        throw new Error('Token missing or invalid claims array');
      }

      return decoded;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to extract token payload: ${err.message}`);
      throw new UnauthorizedException('Invalid token format');
    }
  }
}
