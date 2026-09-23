import { UnauthorizedException } from '@nestjs/common';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

import {
    validateTazamaToken,
    evaluateClaimResult,
    extractTokenPayload,
    extractInnerToken,
    extractTenantName,
} from '../src/guards/tazama-token-validator';
import type { ClaimValidationResult } from '@tazama-lf/auth-lib';

// Mock @tazama-lf/auth-lib (outer-token validation only - unrelated to the inner-token fix below)
jest.mock('@tazama-lf/auth-lib', () => ({
    validateTokenAndClaims: jest.fn(),
}));

// Mock jwks-rsa - the inner token is a real Keycloak-issued token, verified against
// Keycloak's JWKS. getSigningKey is a stable jest.fn() so tests can reconfigure its
// behaviour without needing the jwksClient() factory itself to be re-invoked (the
// module under test memoizes its client after the first call).
const mockGetSigningKey = jest.fn();
jest.mock('jwks-rsa', () => jest.fn(() => ({ getSigningKey: mockGetSigningKey })));

// Import the mocked function
const { validateTokenAndClaims } = require('@tazama-lf/auth-lib') as {
    validateTokenAndClaims: jest.Mock;
};

const TEST_ISSUER = 'http://mock-keycloak.test/realms/tazama';
const TEST_KID = 'test-signing-key';
process.env.KEYCLOAK_ISSUER_URL = TEST_ISSUER;

// Real RSA keypair standing in for Keycloak's actual signing key, so extractInnerToken's
// real-verification path (via the mocked JWKS lookup) can be tested against genuinely
// valid vs. genuinely forged signatures, not just decodable-vs-undecodable JWT shapes.
const serverKeys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});
const attackerKeys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
});

/**
 * Builds a synthetic outer CMS token (a real JWT string that jwt.decode can parse)
 * wrapping an inner Keycloak-shaped token with the given claims/fields.
 */
function buildToken(overrides: {
    claims?: string[];
    clientId?: string;
    tenantId?: string;
    email?: string;
    innerEmail?: string;
    innerName?: string;
    // unknown (rather than string[]/string) so tests can also build tokens with malformed
    // claim shapes - a wrong JWT client/IdP payload is untrusted input the validator must
    // handle without crashing.
    realmRoles?: unknown;
    tenantDetails?: unknown;
    status?: unknown;
    innerTokenString?: string;
    // Sign the inner token with this private key instead of Keycloak's real one -
    // used to simulate a forged inner token (attacker-controlled or no valid key at all).
    innerSigningKey?: string;
    // Override the inner token's issuer - used to test the issuer-pinning check.
    innerIssuer?: string;
    innerKid?: string | null;
}): string {
    const innerPayload: Record<string, unknown> = {
        email: overrides.innerEmail ?? 'user@example.com',
        name: overrides.innerName ?? 'Test User',
        realm_access: { roles: overrides.realmRoles ?? ['CMS_INVESTIGATOR'] },
        tenant_details: overrides.tenantDetails ?? ['tenant-a/realm1'],
    };
    if (overrides.status !== undefined) {
        innerPayload.status = overrides.status;
    }

    const signOptions: jwt.SignOptions = {
        algorithm: 'RS256',
        issuer: overrides.innerIssuer ?? TEST_ISSUER,
    };
    if (overrides.innerKid !== null) {
        signOptions.keyid = overrides.innerKid ?? TEST_KID;
    }

    const innerToken =
        overrides.innerTokenString ??
        jwt.sign(innerPayload, overrides.innerSigningKey ?? serverKeys.privateKey, signOptions);

    const outerPayload = {
        claims: overrides.claims ?? ['CMS_INVESTIGATOR'],
        clientId: overrides.clientId ?? 'user-123',
        tenantId: overrides.tenantId ?? 'tenant-a',
        email: overrides.email ?? 'user@example.com',
        tenantName: 'tenant-a',
        tokenString: innerToken,
    };

    return jwt.sign(outerPayload, 'outer-secret');
}

describe('tazama-token-validator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        // Default: behave like Keycloak's real JWKS endpoint - resolve any kid to the
        // test server's public key. Individual tests can override with mockImplementationOnce.
        mockGetSigningKey.mockImplementation(
            (_kid: string, callback: (err: Error | null, key?: { getPublicKey: () => string }) => void) => {
                callback(null, { getPublicKey: () => serverKeys.publicKey });
            },
        );
    });

    // ─── extractTokenPayload ──────────────────────────────────────────────

    describe('extractTokenPayload', () => {
        it('should decode a valid JWT token', () => {
            const token = buildToken({});
            const decoded = extractTokenPayload(token);

            expect(decoded.clientId).toBe('user-123');
            expect(decoded.tenantId).toBe('tenant-a');
            expect(decoded.claims).toEqual(['CMS_INVESTIGATOR']);
        });

        it('should throw UnauthorizedException for an invalid token format', () => {
            expect(() => extractTokenPayload('not-a-jwt')).toThrow(UnauthorizedException);
            expect(() => extractTokenPayload('not-a-jwt')).toThrow('Invalid token format');
        });

        it('should throw UnauthorizedException for null decode result', () => {
            // jwt.decode returns null for non-string input
            expect(() => extractTokenPayload('')).toThrow(UnauthorizedException);
        });
    });

    // ─── extractInnerToken ────────────────────────────────────────────────

    describe('extractInnerToken', () => {
        it('should extract the inner token from a valid outer token', async () => {
            const token = buildToken({ innerEmail: 'inner@example.com' });
            const inner = await extractInnerToken(token);

            expect(inner.email).toBe('inner@example.com');
        });

        it('should return the outer token itself when no tokenString field exists', async () => {
            const outerPayload = { foo: 'bar', clientId: 'user-123' };
            const token = jwt.sign(outerPayload, 'secret');
            const result = await extractInnerToken(token);

            expect(result.foo).toBe('bar');
        });

        it('should throw UnauthorizedException for an invalid outer token', async () => {
            await expect(extractInnerToken('invalid')).rejects.toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException when the inner token fails to decode', async () => {
            const token = buildToken({ innerTokenString: 'not-a-valid-jwt' });

            // The specific 'Invalid inner token format' throw is itself caught by this
            // function's own try/catch and rethrown with this generic message instead.
            await expect(extractInnerToken(token)).rejects.toThrow(UnauthorizedException);
            await expect(extractInnerToken(token)).rejects.toThrow('Invalid token format');
        });

        // ─── Security regression: inner token must be signature-verified, not just decoded ───
        // See tazama-lf/case-management-system#294 - the inner token was previously read via
        // jwt.decode() with no signature check, so a caller with any valid outer token could
        // embed a self-forged inner token claiming elevated realm_access.roles. The inner token
        // is a genuine Keycloak-issued token, so it must be verified against Keycloak's JWKS
        // (identified by a pinned, pre-configured issuer) - not decoded, and not verified
        // against Tazama's own key.

        it('should reject a well-formed but forged inner token signed with an attacker-controlled key', async () => {
            const token = buildToken({
                realmRoles: ['CMS_ADMIN'], // attacker-claimed elevated role
                innerSigningKey: attackerKeys.privateKey, // NOT Keycloak's real key
            });

            await expect(extractInnerToken(token)).rejects.toThrow(UnauthorizedException);
            await expect(extractInnerToken(token)).rejects.toThrow('Invalid token format');
        });

        it('should reject an inner token with alg=none (unsigned)', async () => {
            const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
            const payload = Buffer.from(
                JSON.stringify({
                    iss: TEST_ISSUER,
                    realm_access: { roles: ['CMS_ADMIN'] },
                    tenant_details: ['tenant-a/realm1'],
                }),
            ).toString('base64url');
            const noneAlgInnerToken = `${header}.${payload}.`;
            const token = buildToken({ innerTokenString: noneAlgInnerToken });

            await expect(extractInnerToken(token)).rejects.toThrow(UnauthorizedException);
        });

        it('should reject an inner token whose issuer does not match the configured Keycloak issuer', async () => {
            // Even with a perfectly valid signature, a token from an unexpected issuer must
            // not be trusted - otherwise a forged token could point `iss` anywhere and have
            // its embedded key silently fetched and trusted.
            const token = buildToken({
                realmRoles: ['CMS_ADMIN'],
                innerIssuer: 'http://attacker-controlled.example/realms/fake',
            });

            await expect(extractInnerToken(token)).rejects.toThrow(UnauthorizedException);
            // The JWKS client must never even be consulted for a mismatched issuer.
            expect(mockGetSigningKey).not.toHaveBeenCalled();
        });

        it('should throw UnauthorizedException when the JWKS lookup fails for the given kid', async () => {
            mockGetSigningKey.mockImplementationOnce(
                (_kid: string, callback: (err: Error | null, key?: { getPublicKey: () => string }) => void) => {
                    callback(new Error('Unable to find a signing key that matches'));
                },
            );
            const token = buildToken({ innerKid: 'unknown-kid' });

            await expect(extractInnerToken(token)).rejects.toThrow(UnauthorizedException);
        });

        it('should accept a genuine inner token properly signed by the Keycloak test key', async () => {
            const token = buildToken({ realmRoles: ['CMS_INVESTIGATOR'] });
            const inner = await extractInnerToken(token);

            const roles = (inner.realm_access as { roles?: string[] })?.roles;
            expect(roles).toEqual(['CMS_INVESTIGATOR']);
        });
    });

    // ─── extractTenantName ────────────────────────────────────────────────

    describe('extractTenantName', () => {
        it('should extract the tenant name from tenant details', () => {
            const result = extractTenantName(['tenant-a/realm1']);
            expect(result).toBe('tenant-a');
        });

        it('should throw UnauthorizedException for an empty array', () => {
            expect(() => extractTenantName([])).toThrow(UnauthorizedException);
            expect(() => extractTenantName([])).toThrow('Invalid tenant details');
        });

        it('should throw UnauthorizedException for a malformed entry', () => {
            expect(() => extractTenantName(['/'])).toThrow(UnauthorizedException);
            expect(() => extractTenantName(['/'])).toThrow('Invalid tenant details format');
        });

        it('should throw UnauthorizedException (not a raw TypeError) when tenant_details is not an array', () => {
            expect(() => extractTenantName(12345)).toThrow(UnauthorizedException);
            expect(() => extractTenantName(12345)).toThrow('Invalid tenant details');
            expect(() => extractTenantName('tenant-a/realm1')).toThrow(UnauthorizedException);
            expect(() => extractTenantName({ tenant: 'tenant-a' })).toThrow(UnauthorizedException);
        });

        it('should throw UnauthorizedException (not a raw TypeError) when the first entry is not a string', () => {
            expect(() => extractTenantName([123, 'tenant-a/realm1'])).toThrow(UnauthorizedException);
            expect(() => extractTenantName([123, 'tenant-a/realm1'])).toThrow('Invalid tenant details');
        });
    });

    // ─── evaluateClaimResult ──────────────────────────────────────────────

    describe('evaluateClaimResult', () => {
        const ctx = 'test-context';
        const makeValidated = (claims: string[]): ClaimValidationResult =>
            claims.reduce((acc, c) => {
                acc[c] = true;
                return acc;
            }, {} as ClaimValidationResult);

        it('should allow any authenticated user when no claims are required', () => {
            const validated = makeValidated([]);
            const result = evaluateClaimResult([], [], validated, ctx);

            expect(result.status).toBe(true);
            expect(result.valid).toEqual([]);
            expect(result.invalid).toEqual([]);
        });

        it('should pass when all required claims are present', () => {
            const validated = makeValidated(['CMS_INVESTIGATOR', 'CMS_SUPERVISOR']);
            const result = evaluateClaimResult(['CMS_INVESTIGATOR'], [], validated, ctx);

            expect(result.status).toBe(true);
            expect(result.valid).toEqual(['CMS_INVESTIGATOR']);
            expect(result.invalid).toEqual([]);
        });

        it('should fail when a required claim is missing', () => {
            const validated = makeValidated(['CMS_INVESTIGATOR']);
            const result = evaluateClaimResult(['CMS_INVESTIGATOR', 'CMS_SUPERVISOR'], [], validated, ctx);

            expect(result.status).toBe(false);
            expect(result.valid).toEqual(['CMS_INVESTIGATOR']);
            expect(result.invalid).toEqual(['CMS_SUPERVISOR']);
        });

        it('should pass when at least one any-claim is present', () => {
            const validated = makeValidated(['CMS_INVESTIGATOR']);
            const result = evaluateClaimResult([], ['CMS_INVESTIGATOR', 'CMS_SUPERVISOR'], validated, ctx);

            expect(result.status).toBe(true);
            expect(result.valid).toEqual(['CMS_INVESTIGATOR']);
        });

        it('should fail when no any-claim is present', () => {
            const validated = makeValidated([]);
            const result = evaluateClaimResult([], ['CMS_INVESTIGATOR', 'CMS_SUPERVISOR'], validated, ctx);

            expect(result.status).toBe(false);
            expect(result.valid).toEqual([]);
            expect(result.invalid).toEqual(['CMS_INVESTIGATOR', 'CMS_SUPERVISOR']);
        });

        it('should prioritise required claims over any claims when both are specified', () => {
            const validated = makeValidated(['CMS_INVESTIGATOR']);
            // required takes precedence: CMS_SUPERVISOR is missing → fail
            const result = evaluateClaimResult(['CMS_SUPERVISOR'], ['CMS_INVESTIGATOR'], validated, ctx);

            expect(result.status).toBe(false);
            expect(result.invalid).toEqual(['CMS_SUPERVISOR']);
        });
    });

    // ─── validateTazamaToken ──────────────────────────────────────────────

    describe('validateTazamaToken', () => {
        it('should return a fully populated AuthenticatedUser on a valid token', async () => {
            const token = buildToken({
                claims: ['CMS_INVESTIGATOR'],
                realmRoles: ['CMS_INVESTIGATOR'],
                status: 'OPEN,CLOSED',
            });

            const validated: ClaimValidationResult = { CMS_INVESTIGATOR: true };
            validateTokenAndClaims.mockReturnValue(validated);

            const user = await validateTazamaToken(token, [], ['CMS_INVESTIGATOR']);

            expect(user.userId).toBe('user-123');
            expect(user.tenantId).toBe('tenant-a');
            expect(user.actorRole).toBe('CMS_INVESTIGATOR');
            expect(user.actorEmail).toBe('user@example.com');
            expect(user.actorName).toBe('Test User');
            expect(user.tenantName).toBe('tenant-a');
            expect(user.allowedStatuses).toEqual(['OPEN', 'CLOSED']);
            expect(user.validClaims).toEqual(['CMS_INVESTIGATOR']);
        });

        it('should throw UnauthorizedException when token validation fails with TokenExpiredError', async () => {
            const token = buildToken({});
            const expiredError = new Error('jwt expired');
            expiredError.name = 'TokenExpiredError';
            validateTokenAndClaims.mockImplementation(() => {
                throw expiredError;
            });

            await expect(validateTazamaToken(token, [], [])).rejects.toThrow(UnauthorizedException);
            await expect(validateTazamaToken(token, [], [])).rejects.toThrow('Token has expired');
        });

        it('should throw UnauthorizedException when token validation fails with a generic error', async () => {
            const token = buildToken({});
            validateTokenAndClaims.mockImplementation(() => {
                throw new Error('something went wrong');
            });

            await expect(validateTazamaToken(token, [], [])).rejects.toThrow(UnauthorizedException);
            await expect(validateTazamaToken(token, [], [])).rejects.toThrow('Token validation failed');
        });

        it('should throw UnauthorizedException when required claims are missing', async () => {
            const token = buildToken({ claims: ['CMS_INVESTIGATOR'] });
            const validated: ClaimValidationResult = { CMS_INVESTIGATOR: true };
            validateTokenAndClaims.mockReturnValue(validated);

            await expect(validateTazamaToken(token, ['CMS_SUPERVISOR'], [])).rejects.toThrow(UnauthorizedException);
            await expect(validateTazamaToken(token, ['CMS_SUPERVISOR'], [])).rejects.toThrow('Missing or invalid claims');
        });

        it('should throw UnauthorizedException when no supported CMS role is found', async () => {
            const token = buildToken({ realmRoles: ['UNKNOWN_ROLE'] });
            const validated: ClaimValidationResult = {};
            validateTokenAndClaims.mockReturnValue(validated);

            await expect(validateTazamaToken(token, [], [])).rejects.toThrow(UnauthorizedException);
            await expect(validateTazamaToken(token, [], [])).rejects.toThrow('No supported CMS role found in token');
        });

        it('should set allowedStatuses to undefined when token has no status field', async () => {
            const token = buildToken({ status: undefined });
            const validated: ClaimValidationResult = { CMS_INVESTIGATOR: true };
            validateTokenAndClaims.mockReturnValue(validated);

            const user = await validateTazamaToken(token, [], ['CMS_INVESTIGATOR']);
            expect(user.allowedStatuses).toBeUndefined();
        });

        it('should throw UnauthorizedException (not a raw TypeError) when tenant_details is not an array', async () => {
            const token = buildToken({ tenantDetails: 12345 });
            const validated: ClaimValidationResult = { CMS_INVESTIGATOR: true };
            validateTokenAndClaims.mockReturnValue(validated);

            await expect(validateTazamaToken(token, [], ['CMS_INVESTIGATOR'])).rejects.toThrow(UnauthorizedException);
            await expect(validateTazamaToken(token, [], ['CMS_INVESTIGATOR'])).rejects.toThrow('Invalid tenant details');
        });

        it('should throw UnauthorizedException (not a raw TypeError) when realm_access.roles is not an array', async () => {
            const token = buildToken({ realmRoles: 'CMS_INVESTIGATOR' });
            const validated: ClaimValidationResult = { CMS_INVESTIGATOR: true };
            validateTokenAndClaims.mockReturnValue(validated);

            await expect(validateTazamaToken(token, [], ['CMS_INVESTIGATOR'])).rejects.toThrow(UnauthorizedException);
            await expect(validateTazamaToken(token, [], ['CMS_INVESTIGATOR'])).rejects.toThrow(
                'No supported CMS role found in token',
            );
        });

        it('should skip non-string entries and still find a valid role when realm_access.roles has mixed element types', async () => {
            const token = buildToken({ realmRoles: [123, { role: 'nope' }, 'CMS_SUPERVISOR'] });
            const validated: ClaimValidationResult = { CMS_SUPERVISOR: true };
            validateTokenAndClaims.mockReturnValue(validated);

            const user = await validateTazamaToken(token, [], ['CMS_SUPERVISOR']);
            expect(user.actorRole).toBe('CMS_SUPERVISOR');
        });

        it('should set allowedStatuses to undefined (not throw) when status is not a string', async () => {
            const token = buildToken({ status: 12345 });
            const validated: ClaimValidationResult = { CMS_INVESTIGATOR: true };
            validateTokenAndClaims.mockReturnValue(validated);

            const user = await validateTazamaToken(token, [], ['CMS_INVESTIGATOR']);
            expect(user.allowedStatuses).toBeUndefined();
        });

        it('should handle CMS_ADMIN as a supported role', async () => {
            const token = buildToken({ realmRoles: ['CMS_ADMIN'] });
            const validated: ClaimValidationResult = { CMS_ADMIN: true };
            validateTokenAndClaims.mockReturnValue(validated);

            const user = await validateTazamaToken(token, [], ['CMS_ADMIN']);
            expect(user.actorRole).toBe('CMS_ADMIN');
        });

        it('should handle CMS_SUPERVISOR as a supported role', async () => {
            const token = buildToken({ realmRoles: ['CMS_SUPERVISOR'] });
            const validated: ClaimValidationResult = { CMS_SUPERVISOR: true };
            validateTokenAndClaims.mockReturnValue(validated);

            const user = await validateTazamaToken(token, [], ['CMS_SUPERVISOR']);
            expect(user.actorRole).toBe('CMS_SUPERVISOR');
        });

        it('should handle CMS_COMPLIANCE_OFFICER as a supported role', async () => {
            const token = buildToken({ realmRoles: ['CMS_COMPLIANCE_OFFICER'] });
            const validated: ClaimValidationResult = { CMS_COMPLIANCE_OFFICER: true };
            validateTokenAndClaims.mockReturnValue(validated);

            const user = await validateTazamaToken(token, [], ['CMS_COMPLIANCE_OFFICER']);
            expect(user.actorRole).toBe('CMS_COMPLIANCE_OFFICER');
        });

        it('should throw when extractTokenPayload receives an invalid token', async () => {
            await expect(validateTazamaToken('invalid-token', [], [])).rejects.toThrow(UnauthorizedException);
        });

        it('should reject a forged inner token claiming CMS_ADMIN end-to-end (see #294)', async () => {
            const token = buildToken({
                realmRoles: ['CMS_ADMIN'],
                innerSigningKey: attackerKeys.privateKey,
            });
            const validated: ClaimValidationResult = {};
            validateTokenAndClaims.mockReturnValue(validated);

            await expect(validateTazamaToken(token, [], [])).rejects.toThrow(UnauthorizedException);
            await expect(validateTazamaToken(token, [], [])).rejects.toThrow('Invalid token format');
        });
    });
});
