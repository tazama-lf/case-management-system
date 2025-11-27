export const BACKEND_CLAIMS = {
  ALERT_TRIAGE: 'alert-triage',
  CMS_TEST_ROLE: 'CMS-TEST-ROLE',
  CMS_INVESTIGATOR: 'CMS_INVESTIGATOR',
  CMS_SUPERVISOR: 'CMS_SUPERVISOR',
  CMS_ADMIN: 'CMS_ADMIN',
  MANAGE_ACCOUNT: 'manage-account',
  MANAGE_ACCOUNT_LINKS: 'manage-account-links',
  VIEW_PROFILE: 'view-profile',
  DEFAULT_ROLES_TAZAMA_CMS: 'default-roles-tazama-cms',
  OFFLINE_ACCESS: 'offline_access',
  UMA_AUTHORIZATION: 'uma_authorization',
} as const;

export type BackendClaim = (typeof BACKEND_CLAIMS)[keyof typeof BACKEND_CLAIMS];

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface User {
  user_id: string;
  username: string;
  roles: string[];
  userId: string;
  tenantId: string;
  email: string;
  fullName: string;
  tenantName: string;
  validatedClaims: Record<string, boolean>;
}
// export interface User {
//   user_id: string;
//   username: string;
//   email: string;
//   firstName: string;
//   lastName: string;
//   fullName: string;
//   tenantId: string;
//   roles: string[];
//   permissions: string[];
//   backendClaims: string[];
// }

export interface LoginResponse {
  message: string;
  token: string;
  expiresIn?: number;
  user?: User;
}

export interface DecodedToken {
  exp: number;
  sid: string;
  iss: string;
  tokenString: string;
  clientId: string;
  tenantId: string;
  email: string;
  firstName: string;
  lastName: string;
  fullName: string;
  tenantName: string;
  claims: string[];
}

export interface Investigator {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  hasBackendClaim: (claim: string) => boolean;
  // hasCMSTestRole: () => boolean;
  // hasAlertTriageRole: () => boolean;
  hasInvestigatorRole: () => boolean;
  hasSupervisorRole: () => boolean;
  hasComplianceOfficerRole: () => boolean;
  hasCMSAdminRole: () => boolean;
  hasAdminRole: () => boolean;
  hasAnyRole: (roles: string[]) => boolean;
  hasAllRoles: (roles: string[]) => boolean;
  validateBackendAccess: () => boolean;
}
