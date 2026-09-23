import { UnauthorizedException, Logger } from '@nestjs/common';
import { promisify } from 'node:util';
import * as jwt from 'jsonwebtoken';
import jwksClient from 'jwks-rsa';
import { validateTokenAndClaims } from '@tazama-lf/auth-lib';

import type { AuthenticatedUser, ClaimValidationResult, CMSToken } from '../utils/types/auth.types';

const logger = new Logger('TazamaTokenValidator');

// jwt.verify has multiple overloads (sync / callback-based); wrapping it in a single,
// unambiguous callback signature first lets promisify infer a clean Promise-returning type.
function verifyJwtCallback(
  token: string,
  getKey: jwt.GetPublicKeyOrSecret,
  options: jwt.VerifyOptions,
  callback: jwt.VerifyCallback<jwt.JwtPayload | string>,
): void {
  jwt.verify(token, getKey, options, callback);
}
const verifyJwt = promisify(verifyJwtCallback);

// The inner token (tokenString) is a real Keycloak-issued access token, signed by
// Keycloak's own key - a different keypair from the one that signs the outer Tazama
// token. It must be verified against Keycloak's JWKS, resolved from this pre-configured,
// trusted issuer - never from the token's own `iss` claim, which a forged token could
// set to anything. Created lazily (not at module load) so it reads the env var after
// dotenv has actually populated process.env.
let cachedJwksClient: ReturnType<typeof jwksClient> | undefined;
function getJwksClient(): ReturnType<typeof jwksClient> {
  if (!cachedJwksClient) {
    const issuer = process.env.KEYCLOAK_ISSUER_URL;
    if (!issuer) {
      throw new Error('KEYCLOAK_ISSUER_URL is not configured');
    }
    cachedJwksClient = jwksClient({
      jwksUri: `${issuer}/protocol/openid-connect/certs`,
      cache: true,
      rateLimit: true,
    });
  }
  return cachedJwksClient;
}

/**
 * Verifies a Keycloak-issued access token's signature against that realm's JWKS.
 * Rejects (rather than fetches JWKS for) any token whose `iss` doesn't exactly match
 * the pre-configured KEYCLOAK_ISSUER_URL, so a forged token can't point `iss` at an
 * attacker-controlled server and have us trust whatever key it serves.
 */
async function verifyKeycloakToken(token: string): Promise<Record<string, unknown>> {
  const expectedIssuer = process.env.KEYCLOAK_ISSUER_URL;
  if (!expectedIssuer) {
    throw new Error('KEYCLOAK_ISSUER_URL is not configured');
  }

  const unverifiedPayload = jwt.decode(token) as Record<string, unknown> | null;
  if (unverifiedPayload?.iss !== expectedIssuer) {
    throw new Error('Inner token issuer does not match the configured Keycloak issuer');
  }

  const client = getJwksClient();
  const getKey: jwt.GetPublicKeyOrSecret = (header, callback) => {
    if (!header.kid) {
      callback(new Error('Inner token header is missing kid'));
      return;
    }
    client.getSigningKey(header.kid, (err, key) => {
      if (err ?? !key) {
        callback(err ?? new Error('No signing key found for kid'));
        return;
      }
      callback(null, key.getPublicKey());
    });
  };

  const decoded = await verifyJwt(token, getKey, { algorithms: ['RS256'], issuer: expectedIssuer });
  if (!decoded || typeof decoded === 'string') {
    throw new Error('Inner token verification returned no payload');
  }
  return decoded;
}

/**
 * Transport-agnostic core of CMS token validation, shared by TazamaAuthGuard (HTTP requests)
 * and CaseEventsGateway (WebSocket handshake). Decodes the outer token, validates it (and any
 * required claims) via @tazama-lf/auth-lib, decodes the inner token, and resolves the
 * authenticated user's role/tenant. Throws UnauthorizedException on any failure - this must
 * stay byte-for-byte equivalent to TazamaAuthGuard's original inline logic.
 *
 * sourceIP is intentionally left unset here (it's HTTP-request-specific); callers that have
 * one available (the HTTP guard) set it themselves on the returned object afterward.
 */
export async function validateTazamaToken(token: string, requiredClaims: string[], anyClaims: string[]): Promise<AuthenticatedUser> {
  const logContext = 'validateTazamaToken()';

  const decoded = extractTokenPayload(token);
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
      logger.warn('Token has expired', logContext);
      throw new UnauthorizedException('Token has expired. Please log in again.');
    }
    logger.error(`Token validation failed: ${err.message}`, logContext);
    throw new UnauthorizedException('Token validation failed');
  }

  const { status, valid, invalid } = evaluateClaimResult(requiredClaims, anyClaims, validated, logContext);

  if (!status) {
    throw new UnauthorizedException(`Missing or invalid claims: ${invalid.join(', ')}`);
  }

  const innerDecoded = await extractInnerToken(token);

  const actorEmail = innerDecoded.email as string | undefined;
  const actorName = innerDecoded.name as string | undefined;
  const tenantName = extractTenantName(innerDecoded.tenant_details);

  const realmAccess = innerDecoded.realm_access as { roles?: unknown } | undefined;
  const realmRoles = Array.isArray(realmAccess?.roles) ? realmAccess.roles : undefined;

  const supportedRoles = new Set(['CMS_INVESTIGATOR', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER', 'CMS_ADMIN']);
  const actorRole = realmRoles?.find((role: unknown): role is string => typeof role === 'string' && supportedRoles.has(role));
  if (!actorRole) {
    throw new UnauthorizedException('No supported CMS role found in token');
  }

  const allowedStatuses =
    typeof innerDecoded.status === 'string' && innerDecoded.status.length > 0
      ? innerDecoded.status
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      : undefined;

  if (allowedStatuses) {
    logger.log(`Extracted ${allowedStatuses.length} allowed statuses: ${allowedStatuses.join(', ')}`, logContext);
  } else {
    logger.warn('No status field found in token', logContext);
  }

  return {
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
    allowedStatuses,
    tenantName,
  };
}

/**
 * Note: required claims take precedence over any claims.
 * If both are specified, only required claims are evaluated.
 * Use either @RequireClaims OR @RequireAnyClaims, not both.
 */
export function evaluateClaimResult(
  required: string[],
  any: string[],
  validated: ClaimValidationResult,
  ctx: string,
): { status: boolean; valid: string[]; invalid: string[] } {
  // If no claims specified on endpoint, allow authenticated users
  if (required.length === 0 && any.length === 0) {
    logger.log('No claims required for this endpoint, allowing authenticated user', ctx);
    return { status: true, valid: [], invalid: [] };
  }

  // Check all required claims (must have ALL)
  if (required.length > 0) {
    const valid = required.filter((c) => validated[c]);
    const invalid = required.filter((c) => !validated[c]);

    if (invalid.length > 0) {
      logger.warn(`User missing required claims. Required: [${required.join(', ')}], Invalid: [${invalid.join(', ')}]`, ctx);
      return { status: false, valid, invalid };
    }

    return { status: true, valid, invalid };
  }

  // Check any claims (must have AT LEAST ONE)
  const valid = any.filter((c) => validated[c]);
  const invalid = any.filter((c) => !validated[c]);

  if (valid.length === 0) {
    logger.warn(`User missing any required claims. Required (any): [${any.join(', ')}], Invalid: [${invalid.join(', ')}]`, ctx);
    return { status: false, valid, invalid };
  }

  return { status: true, valid, invalid };
}

export function extractTokenPayload(token: string): CMSToken {
  const decoded = jwt.decode(token) as CMSToken | null;

  if (!decoded) {
    throw new UnauthorizedException('Invalid token format');
  }

  return decoded;
}

export async function extractInnerToken(outerToken: string): Promise<Record<string, unknown>> {
  try {
    const outerDecoded = jwt.decode(outerToken) as Record<string, unknown> | null;

    if (!outerDecoded) {
      logger.warn('Failed to decode outer token');
      throw new UnauthorizedException('Invalid token format');
    }

    logger.debug(`Outer token has ${Object.keys(outerDecoded).length} claims`);

    if (!outerDecoded.tokenString) {
      logger.warn('No tokenString field in outer token, returning outer token itself');
      return outerDecoded; // Return outer token if there's no inner token
    }

    return await verifyKeycloakToken(outerDecoded.tokenString as string);
  } catch (error) {
    const err = error as Error;
    logger.warn(`Failed to extract inner token payload: ${err.message}`);
    throw new UnauthorizedException('Invalid token format');
  }
}

export function extractTenantName(tenantDetails: unknown): string {
  if (!Array.isArray(tenantDetails) || tenantDetails.length === 0 || typeof tenantDetails[0] !== 'string') {
    logger.error('Tenant details is missing, not an array, or has a non-string entry');
    throw new UnauthorizedException('Invalid tenant details');
  }
  const tenantName = tenantDetails[0].split('/').find((part) => part.length > 0);
  if (!tenantName) {
    logger.error('Failed to extract tenant name from tenant details');
    throw new UnauthorizedException('Invalid tenant details format');
  }
  return tenantName;
}
