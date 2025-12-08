import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TazamaToken, validateTokenAndClaims } from '@tazama-lf/auth-lib';
import type { AuthenticatedUser, ClaimValidationResult, CMSToken } from '../utils/types/auth.types';
import { CLAIMS_KEY, IS_PUBLIC_KEY, ANY_CLAIMS_KEY, AUTHENTICATED_ONLY_KEY } from '../decorators/auth.decorator';
import { decode } from 'punycode';

@Injectable()
export class TazamaAuthGuard implements CanActivate {
  private readonly logger = new Logger(TazamaAuthGuard.name);

  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const logContext = 'TazamaAuthGuard.canActivate()';

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);

    if (isPublic) {
      this.logger.log('Public route accessed, skipping authentication', logContext);
      return true;
    }

    const requiredClaims = this.reflector.getAllAndOverride<string[]>(CLAIMS_KEY, [context.getHandler(), context.getClass()]);
    const anyRequiredClaims = this.reflector.getAllAndOverride<string[]>(ANY_CLAIMS_KEY, [context.getHandler(), context.getClass()]);
    const authenticatedOnly = this.reflector.getAllAndOverride<boolean>(AUTHENTICATED_ONLY_KEY, [context.getHandler(), context.getClass()]);
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.warn('No Bearer token provided', logContext);
      throw new UnauthorizedException('No Bearer token provided');
    }

    // Handle authenticated-only case (no claims validation)
    if (authenticatedOnly) {
      try {
        const token = authHeader.split(' ')[1];
        const decodedToken = this.extractTokenPayload(token);
        const claims = validateTokenAndClaims(token, decodedToken.claims);

        const authenticatedUser: AuthenticatedUser = {
          token: decodedToken,
          validatedClaims: claims,
        };

        request.user = authenticatedUser;
        return true;
      } catch (error) {
        const err = error as Error;
        this.logger.error(`Authentication failed: ${err.name}: ${err.message}`, logContext);
        throw new UnauthorizedException('Token validation failed');
      }
    }

    if ((!requiredClaims || requiredClaims.length === 0) && (!anyRequiredClaims || anyRequiredClaims.length === 0)) {
      this.logger.warn('No required claims specified for protected route', logContext);
      throw new UnauthorizedException('No required claims specified');
    }

    try {
      const token = authHeader.split(' ')[1];

      const claimsToValidate = requiredClaims || anyRequiredClaims || [];

      const validated: ClaimValidationResult = validateTokenAndClaims(token, claimsToValidate);

      let hasValidAccess = false;
      let validClaims: string[] = [];
      let invalidClaims: string[] = [];

      if (requiredClaims && requiredClaims.length > 0) {
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

      const decodedToken = this.extractTokenPayload(token);

      const authenticatedUser: AuthenticatedUser = {
        token: decodedToken,
        validatedClaims: validated,
      };

      request.user = authenticatedUser;

      this.logger.log(`Authentication Successful`, logContext);
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

  private extractTokenPayload(token: string): CMSToken {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      const nestedDecoded = jwt.decode(decoded.tokenString);

      if (!decoded && !nestedDecoded) {
        throw new Error('Failed to decode token');
      }

      if (!decoded.clientId && !decoded.tenantId && !decoded.claims) {
        throw new Error('Token missing details');
      }

      const tenantName = this.extractTenantName(nestedDecoded?.['tenant_details'] as string[]);

      return {
        ...decoded,
        email: nestedDecoded.email,
        firstName: nestedDecoded.firstName ? nestedDecoded.firstName : undefined,
        lastName: nestedDecoded.lastName,
        fullName: nestedDecoded.name,
        tenantName: tenantName,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to extract token payload: ${err.message}`);
      throw new UnauthorizedException('Invalid token format');
    }
  }

  private extractTenantName(tenantDetails: string[]): string {
    if (!tenantDetails || tenantDetails.length === 0) {
      this.logger.error('Tenant details array is empty or undefined');
      throw new UnauthorizedException('Invalid tenant details');
    }
    const tenantName = tenantDetails[0].split('/').filter((part) => part.length > 0)[0];
    return tenantName;
  }
}
