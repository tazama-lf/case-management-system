// Backend claim constants (must match backend TazamaClaims)
export const BACKEND_CLAIMS = {
  ALERT_TRIAGE: 'alert-triage',  // Primary claim required by all controllers
  CMS_TEST_ROLE: 'CMS-TEST-ROLE', // Legacy claim for backward compatibility
  MANAGE_ACCOUNT: 'manage-account',
  MANAGE_ACCOUNT_LINKS: 'manage-account-links',
  VIEW_PROFILE: 'view-profile',
  DEFAULT_ROLES_TAZAMA_CMS: 'default-roles-tazama-cms',
  OFFLINE_ACCESS: 'offline_access',
  UMA_AUTHORIZATION: 'uma_authorization',
} as const;

export type BackendClaim = typeof BACKEND_CLAIMS[keyof typeof BACKEND_CLAIMS];

export interface User {
  user_id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  tenantId: string;
  roles: string[];
  permissions: string[];
  backendClaims: string[]; // Claims expected by backend (e.g., CMS-TEST-ROLE)
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface LoginResponse {
  message: string;
  token: string;
  expiresIn?: number;
  user?: User;
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
  hasCMSTestRole: () => boolean;
  hasAlertTriageRole: () => boolean; // New method for alert-triage claim
  validateBackendAccess: () => boolean;
}

export interface DecodedToken {
  exp: number;
  sub: string;
  clientId?: string;
  preferred_username?: string;
  username?: string;
  email?: string;
  given_name?: string;        // First name
  family_name?: string;       // Last name
  name?: string;              // Full name
  first_name?: string;        // Alternative first name field
  last_name?: string;         // Alternative last name field
  tenant_id?: string;
  claims?: string[];
  realm_access?: {
    roles: string[];
  };
  resource_access?: {
    [key: string]: {
      roles: string[];
    };
  };
}
