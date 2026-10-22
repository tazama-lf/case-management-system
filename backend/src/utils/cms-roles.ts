/**
 * One rule for "which CMS role is this person", shared by the token validator (request role), the user cache
 * (cached role) and the case ACL (bypass decisions). A user can hold several CMS roles; the result must not
 * depend on the order Keycloak lists them or on which parallel fetch populated the cache last. Admin ranks highest, then
 * supervisor and compliance officer, then investigator.
 */
export const CMS_ROLE_PRECEDENCE = ['CMS_ADMIN', 'CMS_SUPERVISOR', 'CMS_COMPLIANCE_OFFICER', 'CMS_INVESTIGATOR'] as const;

export const resolveCmsRole = (roles: readonly unknown[] | null | undefined): string | undefined =>
  CMS_ROLE_PRECEDENCE.find((role) => roles?.includes(role));

/** Supervisors and compliance officers bypass the case ACL entirely. */
export const isAclBypassRole = (role: string | null | undefined): boolean => role === 'CMS_SUPERVISOR' || role === 'CMS_COMPLIANCE_OFFICER';
