import { SetMetadata } from '@nestjs/common';

export const CLAIMS_KEY = 'claims';
export const IS_PUBLIC_KEY = 'isPublic';
export const ANY_CLAIMS_KEY = 'anyClaims'; // New key for "any of these claims" logic

/**
 * Decorator to specify required claims for a route
 * @param claims - Array of required claims (all must be present)
 */
export const RequireClaims = (...claims: string[]) => SetMetadata(CLAIMS_KEY, claims);

/**
 * Decorator to specify claims where ANY of them can satisfy the requirement
 * @param claims - Array of claims (user needs at least one)
 */
export const RequireAnyClaims = (...claims: string[]) => SetMetadata(ANY_CLAIMS_KEY, claims);

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
  ALERT_TRIAGE: 'alert-triage',
  CMS_TEST_ROLE: 'CMS-TEST-ROLE', // Legacy claim for backward compatibility
  CMS_INVESTIGATOR: 'CMS_INVESTIGATOR',
  CMS_SUPERVISOR: 'CMS_SUPERVISOR',
  MANAGE_ACCOUNT: 'manage-account',
  MANAGE_ACCOUNT_LINKS: 'manage-account-links',
  VIEW_PROFILE: 'view-profile',
  DEFAULT_ROLES_TAZAMA_CMS: 'default-roles-tazama-cms',
  OFFLINE_ACCESS: 'offline_access',
  UMA_AUTHORIZATION: 'uma_authorization',
  CMS_ADMIN: 'CMS_ADMIN',
  CMS_ANALYST: 'CMS_ANALYST',
} as const;

/**
 * Convenience decorators for common Tazama roles
 */

export const RequireAdminRole = () =>
    RequireAnyClaims(TazamaClaims.CMS_ADMIN);

export const RequireAnalystRole = () =>
    RequireAnyClaims(TazamaClaims.CMS_ANALYST);
export const RequireAlertTriageRole = () => RequireAnyClaims(TazamaClaims.ALERT_TRIAGE, TazamaClaims.CMS_TEST_ROLE);
export const RequireInvestigatorRole = () => RequireAnyClaims(TazamaClaims.CMS_INVESTIGATOR);
export const RequireSupervisorRole = () => RequireAnyClaims(TazamaClaims.CMS_SUPERVISOR);
export const RequireInvestigatorOrSupervisorRole = () => RequireAnyClaims(TazamaClaims.CMS_INVESTIGATOR, TazamaClaims.CMS_SUPERVISOR);
export const RequireAnyValidRole = () =>
  RequireAnyClaims(TazamaClaims.ALERT_TRIAGE, TazamaClaims.CMS_TEST_ROLE, TazamaClaims.CMS_INVESTIGATOR, TazamaClaims.CMS_SUPERVISOR);
export const RequireAccountManagement = () => RequireClaims(TazamaClaims.MANAGE_ACCOUNT, TazamaClaims.MANAGE_ACCOUNT_LINKS);
