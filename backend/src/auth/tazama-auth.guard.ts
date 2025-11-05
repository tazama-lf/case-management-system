import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { TazamaToken, validateTokenAndClaims } from '@tazama-lf/auth-lib';
import type { AuthenticatedUser, ClaimValidationResult, CMSToken } from './auth.types';
import { CLAIMS_KEY, IS_PUBLIC_KEY, ANY_CLAIMS_KEY } from './auth.decorator';
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

    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader?.startsWith('Bearer ')) {
      this.logger.warn('No Bearer token provided', logContext);
      throw new UnauthorizedException('No Bearer token provided');
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

    this.logger.log(`Extracting tenant name from tenant details array: ${JSON.stringify(tenantDetails)}`);
    const tenantName = tenantDetails[0].split('/').filter((part) => part.length > 0)[0];

    this.logger.log(`Extracting tenant name from tenant details: ${tenantName}`);
    return tenantName;
  }
}

// import { Injectable, CanActivate, ExecutionContext, UnauthorizedException, Logger } from '@nestjs/common';
// import { Reflector } from '@nestjs/core';
// import { validateTokenAndClaims } from '@tazama-lf/auth-lib';
// import * as jwt from 'jsonwebtoken';
// import type { TazamaToken, AuthenticatedUser, AuthenticatedRequest } from './auth.types';
// import { CLAIMS_KEY, IS_PUBLIC_KEY, ANY_CLAIMS_KEY } from './auth.decorator';

// @Injectable()
// export class TazamaAuthGuard implements CanActivate {
//   private readonly logger = new Logger(TazamaAuthGuard.name);

//   constructor(private readonly reflector: Reflector) {}

//   canActivate(context: ExecutionContext): boolean {
//     const logContext = 'TazamaAuthGuard.canActivate';

//     const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
//     if (isPublic) {
//       this.logger.log('Public route accessed, skipping authentication', logContext);
//       return true;
//     }

//     const requiredClaimsRaw = this.reflector.getAllAndOverride<string[]>(CLAIMS_KEY, [context.getHandler(), context.getClass()]);
//     const anyRequiredClaimsRaw = this.reflector.getAllAndOverride<string[]>(ANY_CLAIMS_KEY, [context.getHandler(), context.getClass()]);
//     const requiredClaims = Array.isArray(requiredClaimsRaw) ? requiredClaimsRaw : undefined;
//     const anyRequiredClaims = Array.isArray(anyRequiredClaimsRaw) ? anyRequiredClaimsRaw : undefined;

//     const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
//     const authHeader = request.headers.authorization;

//     if (typeof authHeader !== 'string' || !authHeader.startsWith('Bearer ')) {
//       this.logger.warn('No Bearer token provided', logContext);
//       throw new UnauthorizedException('No Bearer token provided');
//     }

//     try {
//       const token = authHeader.slice('Bearer '.length).trim();

//       let claimsToValidate: string[] = [];
//       if (requiredClaims?.length) {
//         claimsToValidate = requiredClaims;
//       } else if (anyRequiredClaims?.length) {
//         claimsToValidate = anyRequiredClaims;
//       }

//       const isValidToken = Boolean(validateTokenAndClaims(token, claimsToValidate));
//       if (!isValidToken) {
//         throw new UnauthorizedException('Token validation failed');
//       }

//       let validClaims: string[] = [];
//       if (requiredClaims?.length) {
//         validClaims = [...requiredClaims];
//         this.logger.log(`All required claims validated: [${requiredClaims.join(', ')}]`, logContext);
//       } else if (anyRequiredClaims?.length) {
//         validClaims = [...anyRequiredClaims];
//         this.logger.log(`Required claims (any) validated: [${anyRequiredClaims.join(', ')}]`, logContext);
//       } else {
//         this.logger.log('Token validated with no specific claim requirements', logContext);
//       }

//       const decodedToken = this.extractTokenPayload(token);

//       const authenticatedUser: AuthenticatedUser = {
//         token: decodedToken,
//         validClaims,
//       };

//       request.user = authenticatedUser;

//       this.logger.log(
//         `Authentication successful for clientId: ${decodedToken.clientId}, tenantId: ${decodedToken.tenantId}, claims: [${validClaims.join(', ')}]`,
//         logContext,
//       );

//       return true;
//     } catch (error) {
//       const err = error as Error;
//       this.logger.error(`Authentication failed: ${err.message}`, logContext);
//       throw err instanceof UnauthorizedException ? err : new UnauthorizedException('Authentication failed');
//     }
//   }

//   private extractTokenPayload(token: string): TazamaToken {
//     const logContext = 'TazamaAuthGuard.extractTokenPayload';

//     try {
//       const decoded = jwt.decode(token);
//       if (!decoded || typeof decoded !== 'object') {
//         throw new Error('Failed to decode token');
//       }

//       const payload = decoded as Record<string, unknown>;
//       const nestedPayload = this.decodeNestedPayload(payload, logContext);

//       const clientIdFromPayload = this.getStringFieldFromPayload(payload, 'clientId', 'azp');
//       const clientIdFromNested = this.getStringFieldFromPayload(nestedPayload, 'clientId', 'azp');
//       const clientId = clientIdFromPayload ?? clientIdFromNested;
//       if (!clientId) {
//         throw new Error('Token missing clientId');
//       }

//       const tenantIdFromPayload = this.getStringFieldFromPayload(payload, 'tenantId', 'tenant_id');
//       const tenantIdFromNested = this.getStringFieldFromPayload(nestedPayload, 'tenantId', 'tenant_id');
//       const tenantId = tenantIdFromPayload ?? tenantIdFromNested;

//       const directClaims = this.extractClaims(payload);
//       const nestedClaims = this.extractClaims(nestedPayload);
//       const resourceRoles = this.extractResourceRoles(payload);
//       const nestedResourceRoles = this.extractResourceRoles(nestedPayload);
//       const realmRoles = this.extractRealmRoles(payload, nestedPayload);
//       const combinedClaims = Array.from(
//         new Set([...directClaims, ...nestedClaims, ...resourceRoles, ...nestedResourceRoles, ...realmRoles]),
//       );

//       if (combinedClaims.length === 0) {
//         throw new Error('Token missing claims array');
//       }

//       const preferredUsernameFromPayload = this.getStringFieldFromPayload(payload, 'preferred_username');
//       const preferredUsernameFromNested = this.getStringFieldFromPayload(nestedPayload, 'preferred_username');
//       const preferredUsername = preferredUsernameFromPayload ?? preferredUsernameFromNested;

//       const emailFromPayload = this.getStringFieldFromPayload(payload, 'email');
//       const emailFromNested = this.getStringFieldFromPayload(nestedPayload, 'email');
//       const email = emailFromPayload ?? emailFromNested;

//       const firstNameFromPayload = this.getStringFieldFromPayload(payload, 'given_name');
//       const firstNameFromNested = this.getStringFieldFromPayload(nestedPayload, 'given_name');
//       const firstName = firstNameFromPayload ?? firstNameFromNested;

//       const lastNameFromPayload = this.getStringFieldFromPayload(payload, 'family_name');
//       const lastNameFromNested = this.getStringFieldFromPayload(nestedPayload, 'family_name');
//       const lastName = lastNameFromPayload ?? lastNameFromNested;

//       const fullNameFromPayload = this.getStringFieldFromPayload(payload, 'name');
//       const fullNameFromNested = this.getStringFieldFromPayload(nestedPayload, 'name');
//       const fullName = fullNameFromPayload ?? fullNameFromNested;

//       const subjectFromPayload = this.getStringFieldFromPayload(payload, 'sub');
//       const subjectFromNested = this.getStringFieldFromPayload(nestedPayload, 'sub');
//       const subject = subjectFromPayload ?? subjectFromNested;

//       const issuerFromPayload = this.getStringFieldFromPayload(payload, 'iss');
//       const issuerFromNested = this.getStringFieldFromPayload(nestedPayload, 'iss');
//       const issuer = issuerFromPayload ?? issuerFromNested;

//       const expiresAtFromPayload = this.getNumberFieldFromPayload(payload, 'exp');
//       const expiresAtFromNested = this.getNumberFieldFromPayload(nestedPayload, 'exp');
//       const expiresAt = expiresAtFromPayload ?? expiresAtFromNested;

//       const issuedAtFromPayload = this.getNumberFieldFromPayload(payload, 'iat');
//       const issuedAtFromNested = this.getNumberFieldFromPayload(nestedPayload, 'iat');
//       const issuedAt = issuedAtFromPayload ?? issuedAtFromNested;

//       return {
//         clientId,
//         tenantId,
//         claims: combinedClaims,
//         realmRoles,
//         preferredUsername,
//         email,
//         firstName,
//         lastName,
//         fullName,
//         subject,
//         issuer,
//         expiresAt,
//         issuedAt,
//         raw: payload,
//       };
//     } catch (error) {
//       const err = error as Error;
//       this.logger.error(`Failed to extract token payload: ${err.message}`, logContext);
//       throw new UnauthorizedException('Invalid token format');
//     }
//   }

//   private extractClaims(source: Record<string, unknown> | undefined): string[] {
//     if (!source) {
//       return [];
//     }

//     const claims = source['claims'];
//     if (!Array.isArray(claims)) {
//       return [];
//     }

//     return claims.filter((claim): claim is string => typeof claim === 'string' && claim.trim().length > 0);
//   }

//   private extractResourceRoles(source: Record<string, unknown> | undefined): string[] {
//     if (!source || typeof source !== 'object') {
//       return [];
//     }

//     const resourceAccess = source['resource_access'];
//     if (!resourceAccess || typeof resourceAccess !== 'object') {
//       return [];
//     }

//     const accumulator = new Set<string>();
//     Object.values(resourceAccess as Record<string, unknown>).forEach((clientRoles) => {
//       const roles = (clientRoles as { roles?: unknown[] } | undefined)?.roles;
//       if (!Array.isArray(roles)) {
//         return;
//       }

//       roles.forEach((role) => {
//         if (typeof role === 'string' && role.trim().length > 0) {
//           accumulator.add(role);
//         }
//       });
//     });

//     return Array.from(accumulator);
//   }

//   private extractRealmRoles(...sources: Array<Record<string, unknown> | undefined>): string[] {
//     const roles = new Set<string>();

//     sources.forEach((source) => {
//       if (!source) {
//         return;
//       }

//       this.collectRealmRoles(source['realm_access'], roles);
//     });

//     return Array.from(roles);
//   }

//   private collectRealmRoles(source: unknown, accumulator: Set<string>): void {
//     if (!source || typeof source !== 'object') {
//       return;
//     }

//     const realmAccess = source as { roles?: unknown[] };
//     if (!Array.isArray(realmAccess.roles)) {
//       return;
//     }

//     realmAccess.roles.forEach((role) => {
//       if (typeof role === 'string' && role.trim().length > 0) {
//         accumulator.add(role);
//       }
//     });
//   }

//   private decodeNestedPayload(payload: Record<string, unknown>, logContext: string): Record<string, unknown> | undefined {
//     const tokenStringRaw = payload['tokenString'];
//     if (typeof tokenStringRaw !== 'string') {
//       return undefined;
//     }

//     try {
//       const decoded = jwt.decode(tokenStringRaw);
//       if (decoded && typeof decoded === 'object') {
//         return decoded as Record<string, unknown>;
//       }

//       this.logger.warn('tokenString did not decode to an object payload', logContext);
//       return undefined;
//     } catch (error) {
//       const err = error as Error;
//       this.logger.warn(`Failed to decode nested tokenString: ${err.message}`, logContext);
//       return undefined;
//     }
//   }

//   private getStringFieldFromPayload(payload: Record<string, unknown> | undefined, ...keys: string[]): string | undefined {
//     if (!payload) {
//       return undefined;
//     }

//     for (const key of keys) {
//       const value = payload[key];
//       if (typeof value === 'string' && value.trim().length > 0) {
//         return value;
//       }
//     }

//     return undefined;
//   }

//   private getNumberFieldFromPayload(payload: Record<string, unknown> | undefined, key: string): number | undefined {
//     if (!payload) {
//       return undefined;
//     }

//     const value = payload[key];
//     return typeof value === 'number' ? value : undefined;
//   }
// }
