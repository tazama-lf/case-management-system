import { SetMetadata } from '@nestjs/common';

export const CLAIMS_KEY = 'claims';
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to specify required claims for a route
 * @param claims - Array of required claims (all must be present)
 */
export const RequireClaims = (...claims: string[]) => SetMetadata(CLAIMS_KEY, claims);

/**
 * Decorator to mark a route as public (no authentication required)
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Decorator to specify a single claim requirement
 * @param claim - Single required claim
 */
export const RequireClaim = (claim: string) => SetMetadata(CLAIMS_KEY, [claim]);

/**
 * Common Tazama claims for convenience
 */
export const TazamaClaims = {
  CMS_TEST_ROLE: 'CMS-TEST-ROLE',
  MANAGE_ACCOUNT: 'manage-account',
  MANAGE_ACCOUNT_LINKS: 'manage-account-links',
  VIEW_PROFILE: 'view-profile',
  DEFAULT_ROLES_TAZAMA_CMS: 'default-roles-tazama-cms',
  OFFLINE_ACCESS: 'offline_access',
  UMA_AUTHORIZATION: 'uma_authorization',
} as const;

/**
 * Convenience decorators for common Tazama roles
 */
export const RequireCMSTestRole = () => RequireClaim(TazamaClaims.CMS_TEST_ROLE);
export const RequireAccountManagement = () => RequireClaims(TazamaClaims.MANAGE_ACCOUNT, TazamaClaims.MANAGE_ACCOUNT_LINKS);
