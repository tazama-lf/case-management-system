import { resetData } from '@/shared/utils/storage';
import type {
  LoginCredentials,
  LoginResponse,
  User,
  DecodedToken,
  Investigator,
  Supervisor,
} from '../types/auth.types';
import { ACTIVE_SESSION_KEY } from './sessionLock';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

class AuthService {
  private readonly tokenKey = 'authToken';
  private readonly userKey = 'user';

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/v1/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
      });

      if (!response.ok) {
        throw new Error('Invalid credentials');
      }

      const data: LoginResponse = await response.json();

      if (data.token) {
        this.setToken(data.token);

        localStorage.setItem(ACTIVE_SESSION_KEY, Date.now().toString());

        // Fetch user details from /me endpoint for accurate profile data
        try {
          const user = await this.fetchUserProfile(data.token);
          if (user) {
            this.setUser(user);
            localStorage.setItem('ACTIVE_SESSION_USER', user.userId);
            data.user = user;
          }
        } catch (error) {
          console.warn(
            'Failed to fetch user profile, falling back to token decode:',
            error,
          );
        }
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Fetches the authenticated user's profile from the backend /v1/auth/me endpoint.
   * This provides the most accurate and up-to-date user information.
   */
  async fetchUserProfile(token?: string): Promise<User | null> {
    try {
      const authToken = token ?? this.getToken();
      if (!authToken) {
        throw new Error('No authentication token available');
      }

      const response = await fetch(`${API_BASE_URL}/v1/auth/me`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch user profile: ${response.status} ${response.statusText}`,
        );
      }

      const data = await response.json();

      // Map backend response to User interface
      const user: User = {
        userId: data.clientId,
        tenantId: data.tenantId,
        email: data.email,
        fullName: data.fullName,
        tenantName: data.tenantName,
        validatedClaims: data.validatedClaims,
      };

      return user;
    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
    localStorage.removeItem('ACTIVE_SESSION_USER');
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    resetData();
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  getUser(): User | null {
    const userData = localStorage.getItem(this.userKey);
    return userData ? JSON.parse(userData) : null;
  }

  setUser(user: User): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  isAuthenticated(): boolean {
    const token = this.getToken();
    return token ? !this.isTokenExpired(token) : false;
  }

  private getDecodedToken(token: string): DecodedToken | null {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload.replace(/-/gu, '+').replace(/_/gu, '/')));
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  isTokenExpired(token: string): boolean {
    const decoded = this.getDecodedToken(token);
    if (!decoded || typeof decoded.exp !== 'number') {
      return true;
    }
    const currentTime = Math.floor(Date.now() / 1000);

    return decoded.exp < currentTime;
  }

  getTokenExpiration(token: string): Date | null {
    const decoded = this.getDecodedToken(token);
    if (!decoded || typeof decoded.exp !== 'number') {
      return null;
    }
    return new Date(decoded.exp * 1000);
  }

  hasBackendClaim(claim: string): boolean {
    const user: User | null = this.getUser();
    if (!user) {
      return false;
    }

    return user.validatedClaims?.[claim] || false;
  }

  hasCMSTestRole(): boolean {
    return this.hasBackendClaim('CMS-TEST-ROLE');
  }

  hasAlertTriageRole(): boolean {
    return this.hasBackendClaim('alert-triage');
  }

  hasInvestigatorRole(): boolean {
    return this.hasBackendClaim('CMS_INVESTIGATOR');
  }

  hasSupervisorRole(): boolean {
    return this.hasBackendClaim('CMS_SUPERVISOR');
  }

  hasComplianceOfficerRole(): boolean {
    return this.hasBackendClaim('CMS_COMPLIANCE_OFFICER');
  }

  hasCMSAdminRole(): boolean {
    return this.hasBackendClaim('CMS_ADMIN');
  }

  hasCMSComplianceOfficerRole(): boolean {
    return this.hasBackendClaim('CMS_COMPLIANCE_OFFICER');
  }

  /**
   * @deprecated Legacy admin check. Use hasCMSAdminRole() for CMS_ADMIN role.
   * This checks for legacy admin roles (alert-triage or CMS-TEST-ROLE).
   */
  hasAdminRole(): boolean {
    return this.hasAlertTriageRole() || this.hasCMSTestRole();
  }

  hasAnyRole(roles: string[]): boolean {
    return roles.some((role) => this.hasBackendClaim(role));
  }

  hasAllRoles(roles: string[]): boolean {
    return roles.every((role) => this.hasBackendClaim(role));
  }

  /**
   * Validates if the user has any valid CMS role for backend access.
   * This checks for core CMS roles that grant access to the application.
   * @returns true if user has at least one valid CMS role
   */
  validateBackendAccess(): boolean {
    const validRoles = [
      'CMS_INVESTIGATOR',
      'CMS_SUPERVISOR',
      'CMS_ADMIN',
      'CMS_COMPLIANCE_OFFICER',
    ];

    // Also allow legacy admin roles for backward compatibility
    return (
      this.hasAnyRole(validRoles) ||
      this.hasAlertTriageRole() ||
      this.hasCMSTestRole()
    );
  }

  /**
   * Refreshes the current user's profile from the backend.
   * Useful for getting updated user information without re-logging in.
   */
  async refreshUserProfile(): Promise<User | null> {
    const user = await this.fetchUserProfile();
    if (user) {
      this.setUser(user);
    }
    return user;
  }

  getAuthHeader(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }

  /**
   * Fetches all users with the CMS_INVESTIGATOR role from the backend.
   * Uses the backend's /v1/auth/user/:roleName endpoint.
   */
  async fetchAllInvestigators(): Promise<Investigator[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/user/list-by-role/CMS_INVESTIGATOR`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeader(),
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch investigators: ${response.status} ${response.statusText}`,
        );
      }

      const data: Investigator[] = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching investigators:', error);
      throw error;
    }
  }

  /**
   * Fetches all users with the CMS_SUPERVISOR role from the backend.
   * Uses the backend's /v1/auth/user/:roleName endpoint.
   */
  async fetchAllSupervisors(): Promise<Supervisor[]> {
    try {
      const response = await fetch(
        `${API_BASE_URL}/v1/user/list-by-role/CMS_SUPERVISOR`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...this.getAuthHeader(),
          },
        },
      );

      if (!response.ok) {
        throw new Error(
          `Failed to fetch investigators: ${response.status} ${response.statusText}`,
        );
      }

      const data: Investigator[] = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching investigators:', error);
      throw error;
    }
  }
}

const authService = new AuthService();
export default authService;
