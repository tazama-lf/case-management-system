import type {
  LoginCredentials,
  LoginResponse,
  User,
  DecodedToken,
} from '../types/auth.types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

class AuthService {
  private tokenKey = 'authToken';
  private userKey = 'user';

  /**
   * Login user with credentials
   */

  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
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

      // Store token and user data
      if (data.token) {
        this.setToken(data.token);

        // Decode JWT and extract user info
        const user = this.decodeToken(data.token);
        if (user) {
          this.setUser(user);
          data.user = user;
        }
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }

  /**
   * Logout user
   */
  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
  }

  /**
   * Get stored token
   */
  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  /**
   * Set token in localStorage
   */
  setToken(token: string): void {
    localStorage.setItem(this.tokenKey, token);
  }

  /**
   * Get stored user
   */
  getUser(): User | null {
    const userData = localStorage.getItem(this.userKey);
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Set user in localStorage
   */
  setUser(user: User): void {
    localStorage.setItem(this.userKey, JSON.stringify(user));
  }

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): boolean {
    const token = this.getToken();
    return token ? !this.isTokenExpired(token) : false;
  }

  /**
   * Decode JWT token and extract user information
   */
  decodeToken(token: string): User | null {
    const decoded = this.getDecodedToken(token);
    if (!decoded) return null;

    try {
      // Extract user information from the decoded token
      const user: User = {
        user_id: decoded.sub || decoded.clientId || '',
        username: decoded.preferred_username || decoded.username || '',
        email: decoded.email || '',
        tenantId: decoded.tenant_id || '',
        roles: this.extractRoles(decoded),
        permissions: decoded.claims || [],
        backendClaims: this.extractBackendClaims(decoded),
      };

      return user;
    } catch (error) {
      console.error('Error extracting user info from decoded token:', error);
      return null;
    }
  }

  /**
   * Extract roles from token payload
   */
  private extractRoles(payload: DecodedToken): string[] {
    const roles: string[] = [];

    // Look specifically for CMS roles first
    if (payload.resource_access?.CMS?.roles) {
      roles.push(...payload.resource_access.CMS.roles);
    }

    // Fallback: look in all resources if no CMS roles found
    if (roles.length === 0 && payload.resource_access) {
      Object.values(payload.resource_access).forEach(
        (resource: { roles: string[] }) => {
          if (resource.roles) {
            roles.push(...resource.roles);
          }
        },
      );
    }
    
    return roles;
  }

  /**
   * Extract backend claims from token payload
   * Looks for claims in multiple possible locations in the JWT token
   */
  private extractBackendClaims(payload: DecodedToken): string[] {
    const claims: string[] = [];

    // Check claims array (standard location)
    if (payload.claims && Array.isArray(payload.claims)) {
      claims.push(...payload.claims);
    }

    // Check realm_access roles (Keycloak format)
    if (payload.realm_access?.roles) {
      claims.push(...payload.realm_access.roles);
    }

    // Check resource_access for CMS-specific claims
    if (payload.resource_access) {
      Object.entries(payload.resource_access).forEach(([, access]) => {
        if (access.roles) {
          // Add resource-specific roles as claims
          access.roles.forEach(role => {
            claims.push(role);
          });
        }
      });
    }

    // Ensure CMS-TEST-ROLE is included if user has any role
    // This ensures compatibility with backend until proper role mapping is implemented
    if (claims.length > 0 && !claims.includes('CMS-TEST-ROLE')) {
      claims.push('CMS-TEST-ROLE');
    }

    return [...new Set(claims)]; // Remove duplicates
  }

  private getDecodedToken(token: string): DecodedToken | null {
    try {
      const payload = token.split('.')[1];
      return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
    } catch (error) {
      console.error('Error decoding token:', error);
      return null;
    }
  }

  /**

    private getDecodedToken(token: string): any | null {
        try {
            const payload = token.split('.')[1];
            if (!payload) return null;

            // Decode base64 URL
            return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
        } catch (error) {
            console.error('Error decoding token:', error);
            return null;
        }
    }

    /**
     * Check if token is expired
     */
  isTokenExpired(token: string): boolean {
    const decoded = this.getDecodedToken(token);
    if (!decoded || typeof decoded.exp !== 'number') {
      return true;
    }
    const currentTime = Math.floor(Date.now() / 1000);

    return decoded.exp < currentTime;
  }

  /**
   * Get token expiration time
   */
  getTokenExpiration(token: string): Date | null {
    const decoded = this.getDecodedToken(token);
    if (!decoded || typeof decoded.exp !== 'number') {
      return null;
    }
    return new Date(decoded.exp * 1000);
  }

  /**
   * Refresh token (if refresh endpoint exists)
   */
  async refreshToken(): Promise<boolean> {
    try {
      const token = this.getToken();
      if (!token) return false;

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        if (data.token) {
          this.setToken(data.token);
          return true;
        }
      }

      return false;
    } catch (error) {
      console.error('Token refresh error:', error);
      return false;
    }
  }

  /**
   * Check if current user has a specific backend claim
   */
  hasBackendClaim(claim: string): boolean {
    const user = this.getUser();
    return user?.backendClaims?.includes(claim) || false;
  }

  /**
   * Check if current user has CMS-TEST-ROLE claim (required by backend)
   */
  hasCMSTestRole(): boolean {
    return this.hasBackendClaim('CMS-TEST-ROLE');
  }

  /**
   * Validate that user has minimum required claims for backend access
   */
  validateBackendAccess(): boolean {
    return this.hasCMSTestRole();
  }

  /**
   * Get authorization header
   */
  getAuthHeader(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

// Create singleton instance
const authService = new AuthService();
export default authService;
