import { SetMetadata } from '@nestjs/common';

export const CLAIMS_KEY = 'claims';
export const IS_PUBLIC_KEY = 'isPublic';
export const ANY_CLAIMS_KEY = 'anyClaims';
export const AUTHENTICATED_ONLY_KEY = 'authenticatedOnly';

/**
 * Decorator to specify required claims for a route
 * @param claims
 */
export const RequireClaims = (...claims: string[]) => SetMetadata(CLAIMS_KEY, claims);

/**
 * Decorator to specify claims where ANY of them can satisfy the requirement
 * @param claims
 */
export const RequireAnyClaims = (...claims: string[]) => SetMetadata(ANY_CLAIMS_KEY, claims);

/**
 * Decorator to mark a route as public (no authentication required)
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Decorator to specify a single claim requirement
 * @param claim
 */
export const RequireClaim = (claim: string) => SetMetadata(CLAIMS_KEY, [claim]);

/**
 * Common Tazama claims for convenience
 */
export const TazamaClaims = {
  ALERT_TRIAGE: 'alert-triage',
  CMS_TEST_ROLE: 'CMS-TEST-ROLE',
  CMS_INVESTIGATOR: 'CMS_INVESTIGATOR',
  CMS_SUPERVISOR: 'CMS_SUPERVISOR',
  MANAGE_ACCOUNT: 'manage-account',
  MANAGE_ACCOUNT_LINKS: 'manage-account-links',
  VIEW_PROFILE: 'view-profile',
  DEFAULT_ROLES_TAZAMA_CMS: 'default-roles-tazama-cms',
  OFFLINE_ACCESS: 'offline_access',
  UMA_AUTHORIZATION: 'uma_authorization',
  CMS_ADMIN: 'CMS_ADMIN',
  CMS_COMPLIANCE_OFFICER: 'CMS_COMPLIANCE_OFFICER',
} as const;

/**
 * Convenience decorators for common Tazama roles
 */

export const RequireAdminRole = () => RequireAnyClaims(TazamaClaims.CMS_ADMIN);

export const RequireAlertTriageRole = () => RequireAnyClaims(TazamaClaims.ALERT_TRIAGE, TazamaClaims.CMS_TEST_ROLE);
export const RequireInvestigatorRole = () => RequireAnyClaims(TazamaClaims.CMS_INVESTIGATOR);
export const RequireSupervisorRole = () => RequireAnyClaims(TazamaClaims.CMS_SUPERVISOR);
export const RequireInvestigatorOrSupervisorRole = () => RequireAnyClaims(TazamaClaims.CMS_INVESTIGATOR, TazamaClaims.CMS_SUPERVISOR);
export const RequireInvestigatorOrSupervisorRoleOrComplianceRole = () =>
  RequireAnyClaims(TazamaClaims.CMS_INVESTIGATOR, TazamaClaims.CMS_SUPERVISOR, TazamaClaims.CMS_COMPLIANCE_OFFICER);

export const RequireCMSComplianceOfficerRole = () => RequireAnyClaims(TazamaClaims.CMS_COMPLIANCE_OFFICER);

/**
 * Allows any authenticated user (no specific role required).
 * This is preferred over hardcoding specific roles.
 * If you need role-based access control, use specific role decorators instead.
 */
export const RequireAuthenticated = () => SetMetadata(AUTHENTICATED_ONLY_KEY, []);

/**
 * @deprecated Use RequireAuthenticated() instead for any authenticated user,
 * or use specific role decorators (RequireAdminRole, RequireAnalystRole, etc.)
 * for role-based access control. This decorator has a hardcoded list of roles
 * which requires maintenance and may become outdated.
 */
export const RequireAnyValidRole = () =>
  RequireAnyClaims(TazamaClaims.ALERT_TRIAGE, TazamaClaims.CMS_TEST_ROLE, TazamaClaims.CMS_INVESTIGATOR, TazamaClaims.CMS_SUPERVISOR);

export const RequireAccountManagement = () => RequireClaims(TazamaClaims.MANAGE_ACCOUNT, TazamaClaims.MANAGE_ACCOUNT_LINKS);
