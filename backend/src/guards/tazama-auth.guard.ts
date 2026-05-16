import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as jwt from 'jsonwebtoken';
import { validateTokenAndClaims } from '@tazama-lf/auth-lib';

import type { AuthenticatedUser, ClaimValidationResult, CMSToken } from '../utils/types/auth.types';
import { CLAIMS_KEY, IS_PUBLIC_KEY, ANY_CLAIMS_KEY } from '../decorators/auth.decorator';

@Injectable()
export class TazamaAuthGuard implements CanActivate {
  private readonly logger = new Logger(TazamaAuthGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const logContext = 'TazamaAuthGuard.canActivate()';

    if (this.isPublicRoute(context)) return true;

    const request = context.switchToHttp().getRequest();
    const token = this.extractBearerToken(request.headers.authorization, logContext);

    const { requiredClaims, anyClaims } = this.getClaimsFromDecorators(context);

    const decoded = this.extractTokenPayload(token);
    const allTokenClaims = Array.isArray(decoded.claims) ? decoded.claims : [];
    const claimsToValidate = [...new Set([...allTokenClaims, ...requiredClaims, ...anyClaims])];

    let validated: ClaimValidationResult;
    try {
      validated = validateTokenAndClaims(token, claimsToValidate);
    } catch (error) {
      const err = error as Error;

      if (
        err.name === 'TokenExpiredError' ||
        err.message.toLowerCase().includes('token expired') ||
        err.message.toLowerCase().includes('jwt expired')
      ) {
        this.logger.warn('Token has expired', logContext);
        throw new UnauthorizedException('Token has expired. Please log in again.');
      }
      this.logger.error(`Token validation failed: ${err.message}`, logContext);
      throw new UnauthorizedException('Token validation failed');
    }

    const { status, valid, invalid } = this.evaluateClaimResult(requiredClaims, anyClaims, validated, logContext);

    if (!status) {
      throw new UnauthorizedException(`Missing or invalid claims: ${invalid.join(', ')}`);
    }

    const innerDecoded = this.extractInnerToken(token);

    const actorEmail = innerDecoded.email as string | undefined;

    const actorName = innerDecoded.name as string | undefined;
    const tenantName = this.extractTenantName(innerDecoded.tenant_details as string[]);

    const realmAccess = innerDecoded.realm_access as { roles?: string[] } | undefined;
    const realmRoles = realmAccess?.roles;

    const supportedRoles = new Set(['CMS_INVESTIGATOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER', 'CMS_ADMIN']);
    const actorRole = realmRoles?.find((role: string) => supportedRoles.has(role));
    if (!actorRole) {
      throw new UnauthorizedException('No supported CMS role found in token');
    }

    const sourceIP =
      request.ip ?? (request.headers['x-forwarded-for'] as string | undefined)?.split(',')[0].trim() ?? request.socket.remoteAddress;

    const allowedStatuses = innerDecoded.status
      ? (innerDecoded.status as string)
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : undefined;

    if (allowedStatuses) {
      this.logger.log(`Extracted ${allowedStatuses.length} allowed statuses: ${allowedStatuses.join(', ')}`, logContext);
    } else {
      this.logger.warn('No status field found in token', logContext);
    }

    const authenticatedUser: AuthenticatedUser = {
      token: {
        ...decoded,
        tokenString: token,
        fullName: actorName, // Add extracted name to token object
        email: actorEmail ?? decoded.email,
      },
      validated,
      validClaims: valid,
      tenantId: decoded.tenantId,
      userId: decoded.clientId,
      actorName,
      actorRole,
      actorEmail,
      sourceIP,
      allowedStatuses,
      tenantName,
    };

    request.user = authenticatedUser;
    return true;
  }

  private isPublicRoute(context: ExecutionContext): boolean {
    return this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
  }

  private extractBearerToken(authHeader: string | undefined, ctx: string): string {
    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.warn('No Bearer token provided', ctx);
      throw new UnauthorizedException('No Bearer token provided');
    }
    return authHeader.split(' ')[1];
  }

  private getClaimsFromDecorators(context: ExecutionContext): {
    requiredClaims: string[];
    anyClaims: string[];
  } {
    const requiredClaims =
      this.reflector.getAllAndOverride<string[] | undefined>(CLAIMS_KEY, [context.getHandler(), context.getClass()]) ?? [];

    const anyClaims =
      this.reflector.getAllAndOverride<string[] | undefined>(ANY_CLAIMS_KEY, [context.getHandler(), context.getClass()]) ?? [];

    return { requiredClaims, anyClaims };
  }

  /**
   * Note: required claims take precedence over any claims.
   * If both are specified, only required claims are evaluated.
   * Use either @RequireClaims OR @RequireAnyClaims, not both.
   */
  private evaluateClaimResult(
    required: string[],
    any: string[],
    validated: ClaimValidationResult,
    ctx: string,
  ): { status: boolean; valid: string[]; invalid: string[] } {
    // If no claims specified on endpoint, allow authenticated users
    if (required.length === 0 && any.length === 0) {
      this.logger.log('No claims required for this endpoint, allowing authenticated user', ctx);
      return { status: true, valid: [], invalid: [] };
    }

    // Check all required claims (must have ALL)
    if (required.length > 0) {
      const valid = required.filter((c) => validated[c]);
      const invalid = required.filter((c) => !validated[c]);

      if (invalid.length > 0) {
        this.logger.warn(`User missing required claims. Required: [${required.join(', ')}], Invalid: [${invalid.join(', ')}]`, ctx);
        return { status: false, valid, invalid };
      }

      return { status: true, valid, invalid };
    }

    // Check any claims (must have AT LEAST ONE)
    const valid = any.filter((c) => validated[c]);
    const invalid = any.filter((c) => !validated[c]);

    if (valid.length === 0) {
      this.logger.warn(`User missing any required claims. Required (any): [${any.join(', ')}], Invalid: [${invalid.join(', ')}]`, ctx);
      return { status: false, valid, invalid };
    }

    return { status: true, valid, invalid };
  }

  private extractTokenPayload(token: string): CMSToken {
    const decoded = jwt.decode(token) as CMSToken | null;

    if (!decoded) {
      throw new UnauthorizedException('Invalid token format');
    }

    return decoded;
  }

  private extractInnerToken(outerToken: string): Record<string, unknown> {
    try {
      const outerDecoded = jwt.decode(outerToken) as Record<string, unknown> | null;

      if (!outerDecoded) {
        this.logger.warn('Failed to decode outer token');
        throw new UnauthorizedException('Invalid token format');
      }

      this.logger.debug(`Outer token has ${Object.keys(outerDecoded).length} claims`);

      if (!outerDecoded.tokenString) {
        this.logger.warn('No tokenString field in outer token, returning outer token itself');
        return outerDecoded; // Return outer token if there's no innerF token
      }

      const innerDecoded = jwt.decode(outerDecoded.tokenString as string) as Record<string, unknown> | null;

      if (!innerDecoded) {
        this.logger.warn('Failed to decode inner token');
        throw new UnauthorizedException('Invalid inner token format');
      }

      return innerDecoded;
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Failed to extract inner token payload: ${err.message}`);
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
