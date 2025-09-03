/**
 * Role and permission configuration for the frontend application
 */

// Role definitions
export const ROLES = {
  ADMIN: 'admin',
  SUPERVISOR: 'supervisor',
  ANALYST: 'analyst',
  INVESTIGATOR: 'investigator',
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// Permission definitions
export const PERMISSIONS = {
  READ_ALERTS: 'read:alerts',
  WRITE_ALERTS: 'write:alerts',
  READ_CASES: 'read:cases',
  WRITE_CASES: 'write:cases',
  READ_ANALYTICS: 'read:analytics',
  WRITE_ANALYTICS: 'write:analytics',
  MANAGE_USERS: 'manage:users',
  MANAGE_SYSTEM: 'manage:system',
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// Role hierarchy - defines which roles inherit permissions from other roles
export const ROLE_HIERARCHY: Record<Role, Role[]> = {
  [ROLES.ADMIN]: [ROLES.ADMIN, ROLES.SUPERVISOR, ROLES.ANALYST, ROLES.INVESTIGATOR],
  [ROLES.SUPERVISOR]: [ROLES.SUPERVISOR, ROLES.ANALYST, ROLES.INVESTIGATOR],
  [ROLES.ANALYST]: [ROLES.ANALYST, ROLES.INVESTIGATOR],
  [ROLES.INVESTIGATOR]: [ROLES.INVESTIGATOR],
};

// Role-permission mapping
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.ADMIN]: [
    PERMISSIONS.READ_ALERTS,
    PERMISSIONS.WRITE_ALERTS,
    PERMISSIONS.READ_CASES,
    PERMISSIONS.WRITE_CASES,
    PERMISSIONS.READ_ANALYTICS,
    PERMISSIONS.WRITE_ANALYTICS,
    PERMISSIONS.MANAGE_USERS,
    PERMISSIONS.MANAGE_SYSTEM,
  ],
  [ROLES.SUPERVISOR]: [
    PERMISSIONS.READ_ALERTS,
    PERMISSIONS.WRITE_ALERTS,
    PERMISSIONS.READ_CASES,
    PERMISSIONS.WRITE_CASES,
    PERMISSIONS.READ_ANALYTICS,
    PERMISSIONS.WRITE_ANALYTICS,
  ],
  [ROLES.ANALYST]: [
    PERMISSIONS.READ_ALERTS,
    PERMISSIONS.WRITE_ALERTS,
    PERMISSIONS.READ_CASES,
    PERMISSIONS.WRITE_CASES,
  ],
  [ROLES.INVESTIGATOR]: [
    PERMISSIONS.READ_ALERTS,
    PERMISSIONS.READ_CASES,
  ],
};

/**
 * Get all permissions for a given role, including inherited permissions
 */
export function getRolePermissions(role: Role): Permission[] {
  const inheritedRoles = ROLE_HIERARCHY[role] || [role];
  const permissions = new Set<Permission>();

  inheritedRoles.forEach(inheritedRole => {
    ROLE_PERMISSIONS[inheritedRole]?.forEach(permission => {
      permissions.add(permission);
    });
  });

  return Array.from(permissions);
}

/**
 * Check if a user has a specific permission
 */
export function hasPermission(userRoles: string[], requiredPermission: Permission): boolean {
  return userRoles.some(role => {
    const rolePermissions = getRolePermissions(role as Role);
    return rolePermissions.includes(requiredPermission);
  });
}

/**
 * Check if a user has any of the required roles
 */
export function hasAnyRole(userRoles: string[], requiredRoles: string[]): boolean {
  return requiredRoles.some(requiredRole => {
    return userRoles.some(userRole => {
      const hierarchy = ROLE_HIERARCHY[userRole as Role] || [userRole];
      return hierarchy.includes(requiredRole as Role);
    });
  });
}

/**
 * Get effective roles for a user (including inherited roles)
 */
export function getEffectiveRoles(userRoles: string[]): string[] {
  const effectiveRoles = new Set<string>();

  userRoles.forEach(role => {
    const hierarchy = ROLE_HIERARCHY[role as Role] || [role];
    hierarchy.forEach(inheritedRole => effectiveRoles.add(inheritedRole));
  });

  return Array.from(effectiveRoles);
}
