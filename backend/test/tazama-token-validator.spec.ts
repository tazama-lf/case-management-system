import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';

import {
    validateTazamaToken,
    evaluateClaimResult,
    extractTokenPayload,
    extractInnerToken,
    extractTenantName,
} from '../src/guards/tazama-token-validator';
import type { ClaimValidationResult } from '@tazama-lf/auth-lib';

// Mock @tazama-lf/auth-lib
jest.mock('@tazama-lf/auth-lib', () => ({
    validateTokenAndClaims: jest.fn(),
}));

// Import the mocked function
const { validateTokenAndClaims } = require('@tazama-lf/auth-lib') as {
    validateTokenAndClaims: jest.Mock;
};

/**
 * Builds a synthetic outer CMS token (a real JWT string that jwt.decode can parse)
 * wrapping an inner Keycloak token with the given claims/fields.
 */
function buildToken(overrides: {
    claims?: string[];
    clientId?: string;
    tenantId?: string;
    email?: string;
    innerEmail?: string;
    innerName?: string;
    realmRoles?: string[];
    tenantDetails?: string[];
    status?: string;
    innerTokenString?: string;
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

    const innerToken = overrides.innerTokenString ?? jwt.sign(innerPayload, 'inner-secret');

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
        it('should extract the inner token from a valid outer token', () => {
            const token = buildToken({ innerEmail: 'inner@example.com' });
            const inner = extractInnerToken(token);

            expect(inner.email).toBe('inner@example.com');
        });

        it('should return the outer token itself when no tokenString field exists', () => {
            const outerPayload = { foo: 'bar', clientId: 'user-123' };
            const token = jwt.sign(outerPayload, 'secret');
            const result = extractInnerToken(token);

            expect(result.foo).toBe('bar');
        });

        it('should throw UnauthorizedException for an invalid outer token', () => {
            expect(() => extractInnerToken('invalid')).toThrow(UnauthorizedException);
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
        it('should return a fully populated AuthenticatedUser on a valid token', () => {
            const token = buildToken({
                claims: ['CMS_INVESTIGATOR'],
                realmRoles: ['CMS_INVESTIGATOR'],
                status: 'OPEN,CLOSED',
            });

            const validated: ClaimValidationResult = { CMS_INVESTIGATOR: true };
            validateTokenAndClaims.mockReturnValue(validated);

            const user = validateTazamaToken(token, [], ['CMS_INVESTIGATOR']);

            expect(user.userId).toBe('user-123');
            expect(user.tenantId).toBe('tenant-a');
            expect(user.actorRole).toBe('CMS_INVESTIGATOR');
            expect(user.actorEmail).toBe('user@example.com');
            expect(user.actorName).toBe('Test User');
            expect(user.tenantName).toBe('tenant-a');
            expect(user.allowedStatuses).toEqual(['OPEN', 'CLOSED']);
            expect(user.validClaims).toEqual(['CMS_INVESTIGATOR']);
        });

        it('should throw UnauthorizedException when token validation fails with TokenExpiredError', () => {
            const token = buildToken({});
            const expiredError = new Error('jwt expired');
            expiredError.name = 'TokenExpiredError';
            validateTokenAndClaims.mockImplementation(() => {
                throw expiredError;
            });

            expect(() => validateTazamaToken(token, [], [])).toThrow(UnauthorizedException);
            expect(() => validateTazamaToken(token, [], [])).toThrow('Token has expired');
        });

        it('should throw UnauthorizedException when token validation fails with a generic error', () => {
            const token = buildToken({});
            validateTokenAndClaims.mockImplementation(() => {
                throw new Error('something went wrong');
            });

            expect(() => validateTazamaToken(token, [], [])).toThrow(UnauthorizedException);
            expect(() => validateTazamaToken(token, [], [])).toThrow('Token validation failed');
        });

        it('should throw UnauthorizedException when required claims are missing', () => {
            const token = buildToken({ claims: ['CMS_INVESTIGATOR'] });
            const validated: ClaimValidationResult = { CMS_INVESTIGATOR: true };
            validateTokenAndClaims.mockReturnValue(validated);

            expect(() => validateTazamaToken(token, ['CMS_SUPERVISOR'], [])).toThrow(UnauthorizedException);
            expect(() => validateTazamaToken(token, ['CMS_SUPERVISOR'], [])).toThrow('Missing or invalid claims');
        });

        it('should throw UnauthorizedException when no supported CMS role is found', () => {
            const token = buildToken({ realmRoles: ['UNKNOWN_ROLE'] });
            const validated: ClaimValidationResult = {};
            validateTokenAndClaims.mockReturnValue(validated);

            expect(() => validateTazamaToken(token, [], [])).toThrow(UnauthorizedException);
            expect(() => validateTazamaToken(token, [], [])).toThrow('No supported CMS role found in token');
        });

        it('should set allowedStatuses to undefined when token has no status field', () => {
            const token = buildToken({ status: undefined as unknown as string });
            const validated: ClaimValidationResult = { CMS_INVESTIGATOR: true };
            validateTokenAndClaims.mockReturnValue(validated);

            const user = validateTazamaToken(token, [], ['CMS_INVESTIGATOR']);
            expect(user.allowedStatuses).toBeUndefined();
        });

        it('should handle CMS_ADMIN as a supported role', () => {
            const token = buildToken({ realmRoles: ['CMS_ADMIN'] });
            const validated: ClaimValidationResult = { CMS_ADMIN: true };
            validateTokenAndClaims.mockReturnValue(validated);

            const user = validateTazamaToken(token, [], ['CMS_ADMIN']);
            expect(user.actorRole).toBe('CMS_ADMIN');
        });

        it('should handle CMS_SUPERVISOR as a supported role', () => {
            const token = buildToken({ realmRoles: ['CMS_SUPERVISOR'] });
            const validated: ClaimValidationResult = { CMS_SUPERVISOR: true };
            validateTokenAndClaims.mockReturnValue(validated);

            const user = validateTazamaToken(token, [], ['CMS_SUPERVISOR']);
            expect(user.actorRole).toBe('CMS_SUPERVISOR');
        });

        it('should handle CMS_COMPLIANCE_OFFICER as a supported role', () => {
            const token = buildToken({ realmRoles: ['CMS_COMPLIANCE_OFFICER'] });
            const validated: ClaimValidationResult = { CMS_COMPLIANCE_OFFICER: true };
            validateTokenAndClaims.mockReturnValue(validated);

            const user = validateTazamaToken(token, [], ['CMS_COMPLIANCE_OFFICER']);
            expect(user.actorRole).toBe('CMS_COMPLIANCE_OFFICER');
        });

        it('should throw when extractTokenPayload receives an invalid token', () => {
            expect(() => validateTazamaToken('invalid-token', [], [])).toThrow(UnauthorizedException);
        });
    });
});
