import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { validateTokenAndClaims } from '@tazama-lf/auth-lib';
import * as jwt from 'jsonwebtoken';
import type { AuthenticatedUser, ClaimValidationResult, CMSToken } from '../utils/types/auth.types';
import { CLAIMS_KEY, IS_PUBLIC_KEY, ANY_CLAIMS_KEY, AUTHENTICATED_ONLY_KEY } from '../decorators/auth.decorator';

@Injectable()
export class TazamaAuthGuard implements CanActivate {
  private readonly logger = new Logger(TazamaAuthGuard.name);

  constructor(private readonly reflector: Reflector) { }

  canActivate(context: ExecutionContext): boolean {
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

    if (authenticatedOnly) {
      return this.handleAuthenticatedOnly(authHeader, request, logContext);
    }

    return this.handleClaimsValidation(authHeader, request, requiredClaims, anyRequiredClaims, logContext);
  }

  private handleAuthenticatedOnly(authHeader: string, request: any, logContext: string): boolean {
    try {
      const [, token] = authHeader.split(' ');
      const decodedToken = this.extractTokenPayload(token);
      const claims = validateTokenAndClaims(token, decodedToken.claims);

      const authenticatedUser: AuthenticatedUser = {
        token: decodedToken,
        validatedClaims: claims,
      };

      // eslint-disable-next-line no-param-reassign -- Attaching authenticated user to request
      request.user = authenticatedUser;
      return true;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Authentication failed: ${err.name}: ${err.message}`, logContext);
      throw new UnauthorizedException('Token validation failed');
    }
  }

  private handleClaimsValidation(
    authHeader: string,
    request: any,
    requiredClaims: string[] | undefined,
    anyRequiredClaims: string[] | undefined,
    logContext: string,
  ): boolean {
    try {
      const [, token] = authHeader.split(' ');

      const claimsToValidate = requiredClaims?.length ? requiredClaims : anyRequiredClaims?.length ? anyRequiredClaims : [];

      const validated: ClaimValidationResult = validateTokenAndClaims(token, claimsToValidate);

      const { hasValidAccess, invalidClaims } = this.validateClaims(validated, requiredClaims, anyRequiredClaims, logContext);

      if (!hasValidAccess) {
        throw new UnauthorizedException(`Missing or invalid claims: ${invalidClaims.join(', ')}`);
      }

      const decodedToken = this.extractTokenPayload(token);

      const authenticatedUser: AuthenticatedUser = {
        token: decodedToken,
        validatedClaims: validated,
      };

      // eslint-disable-next-line no-param-reassign -- Attaching authenticated user to request
      request.user = authenticatedUser;

      this.logger.log('Authentication Successful', logContext);
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

  private validateClaims(
    validated: ClaimValidationResult,
    requiredClaims: string[] | undefined,
    anyRequiredClaims: string[] | undefined,
    logContext: string,
  ): { hasValidAccess: boolean; invalidClaims: string[] } {
    let hasValidAccess = false;
    let invalidClaims: string[] = [];

    if (requiredClaims?.length) {
      const hasAllClaims = requiredClaims.every((claim) => validated[claim]);
      invalidClaims = requiredClaims.filter((claim) => !validated[claim]);
      hasValidAccess = hasAllClaims;

      if (!hasAllClaims) {
        this.logger.warn(
          `User missing required claims. Required: [${requiredClaims.join(', ')}], Invalid: [${invalidClaims.join(', ')}]`,
          logContext,
        );
      }
    } else if (anyRequiredClaims?.length) {
      const hasAnyClaim = anyRequiredClaims.some((claim) => validated[claim]);
      invalidClaims = anyRequiredClaims.filter((claim) => !validated[claim]);
      hasValidAccess = hasAnyClaim;

      if (!hasAnyClaim) {
        this.logger.warn(
          `User missing any required claims. Required (any of): [${anyRequiredClaims.join(', ')}], Invalid: [${invalidClaims.join(', ')}]`,
          logContext,
        );
      }
    }

    return { hasValidAccess, invalidClaims };
  }

  private extractTokenPayload(token: string): CMSToken {
    try {
      const decoded = jwt.decode(token) as unknown as Record<string, unknown>;
      const nestedDecoded = jwt.decode(decoded.tokenString as string) as unknown as Record<string, unknown>;

      if (!decoded.clientId && !decoded.tenantId && !decoded.claims) {
        throw new Error('Token missing details');
      }

      const tenantName = this.extractTenantName(nestedDecoded.tenant_details as string[]);

      const result: CMSToken = {
        ...(decoded as CMSToken),
        email: nestedDecoded.email as string,
        firstName: (nestedDecoded.firstName as string | undefined) ?? undefined,
        lastName: nestedDecoded.lastName as string | undefined,
        fullName: nestedDecoded.name as string | undefined,
        tenantName,
      };
      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to extract token payload: ${err.message}`);
      throw new UnauthorizedException('Invalid token format');
    }
  }

  private extractTenantName(tenantDetails: string[]): string {
    if (tenantDetails.length === 0) {
      this.logger.error('Tenant details array is empty or undefined');
      throw new UnauthorizedException('Invalid tenant details');
    }
    // const tenantName = tenantDetails[0].split('/').filter((part) => part.length > 0)[0];
    const tenantName = tenantDetails[0].split('/').find((part) => part.length > 0);
    if (!tenantName) {
      this.logger.error('Failed to extract tenant name from tenant details');
      throw new UnauthorizedException('Invalid tenant details format');
    }
    return tenantName;
  }
}
