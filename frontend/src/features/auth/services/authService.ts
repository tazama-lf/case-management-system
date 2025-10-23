import type {
  LoginCredentials,
  LoginResponse,
  User,
  DecodedToken,
  Investigator,
} from '../types/auth.types';

const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3000';

class AuthService {
  private tokenKey = 'authToken';
  private userKey = 'user';



  async login(credentials: LoginCredentials): Promise<LoginResponse> {
    try {
      console.log('Starting login process...');

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
      console.log('Login API response received:', { hasToken: !!data.token, hasUser: !!data.user });

      if (data.token) {
        this.setToken(data.token);

        const user = this.decodeToken(data.token);
        if (user) {
          console.log('User decoded from token successfully');
          this.setUser(user);
          data.user = user;
        } else {
          console.log('Failed to decode user from token');
        }
      }

      return data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  }


  logout(): void {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.userKey);
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


  decodeToken(token: string): User | null {
    const decoded = this.getDecodedToken(token);
    if (!decoded) {
      console.log('decodeToken failed: could not decode token');
      return null;
    }

    try {
      const user: User = {
        user_id: decoded.sub || decoded.clientId || '',
        username: decoded.preferred_username || decoded.username || '',
        email: decoded.email || '',
        firstName: decoded.given_name || decoded.first_name || '',
        lastName: decoded.family_name || decoded.last_name || '',
        fullName: decoded.name || this.buildFullName(decoded.given_name || decoded.first_name, decoded.family_name || decoded.last_name),
        tenantId: decoded.tenant_id || '',
        roles: this.extractRoles(decoded),
        permissions: decoded.claims || [],
        backendClaims: this.extractBackendClaims(decoded),
      };

      console.log('decodeToken success:', {
        user_id: user.user_id,
        username: user.username,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        tenantId: user.tenantId,
        roles: user.roles,
        backendClaims: user.backendClaims
      });

      return user;
    } catch (error) {
      console.error('Error extracting user info from decoded token:', error);
      return null;
    }
  }


  private extractRoles(payload: DecodedToken): string[] {
    const roles: string[] = [];

    if (payload.resource_access?.CMS?.roles) {
      roles.push(...payload.resource_access.CMS.roles);
    }

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


  private extractBackendClaims(payload: DecodedToken): string[] {
    const claims: string[] = [];

    if (payload.claims && Array.isArray(payload.claims)) {
      claims.push(...payload.claims);
    }

    if (payload.realm_access?.roles) {
      claims.push(...payload.realm_access.roles);
    }

    if (payload.resource_access) {
      Object.entries(payload.resource_access).forEach(([, access]) => {
        if (access.roles) {
          access.roles.forEach(role => {
            claims.push(role);
          });
        }
      });
    }

    console.log('extractBackendClaims() Debug - Raw claims found:', {
      originalClaims: claims,
      payloadStructure: {
        claims: payload.claims,
        realm_access: payload.realm_access,
        resource_access: Object.keys(payload.resource_access || {})
      }
    });

    const finalClaims = [...new Set(claims)];

    console.log('extractBackendClaims() Final claims:', finalClaims);

    return finalClaims;
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


  hasBackendClaim(claim: string): boolean {
    const user = this.getUser();
    return user?.backendClaims?.includes(claim) || false;
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


  hasAdminRole(): boolean {
    return this.hasAlertTriageRole() || this.hasCMSTestRole();
  }


  hasAnyRole(roles: string[]): boolean {
    return roles.some(role => this.hasBackendClaim(role));
  }


  hasAllRoles(roles: string[]): boolean {
    return roles.every(role => this.hasBackendClaim(role));
  }


  validateBackendAccess(): boolean {
    const hasAlertTriage = this.hasAlertTriageRole();
    const hasCMSTest = this.hasCMSTestRole();
    const hasInvestigator = this.hasInvestigatorRole();
    const hasSupervisor = this.hasSupervisorRole();
    const user = this.getUser();

    const result = hasAlertTriage || hasCMSTest || hasInvestigator || hasSupervisor;

    console.log('validateBackendAccess() Debug:', {
      hasAlertTriage,
      hasCMSTest,
      hasInvestigator,
      hasSupervisor,
      userClaims: user?.backendClaims,
      allUserData: user,
      result
    });

    return result;
  }


  getAuthHeader(): Record<string, string> {
    const token = this.getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }


  private buildFullName(firstName?: string, lastName?: string): string {
    const first = firstName?.trim() || '';
    const last = lastName?.trim() || '';

    if (first && last) {
      return `${first} ${last}`;
    }
    return first || last || '';
  }


  async fetchAllInvestigators(): Promise<Investigator[]> {
    try {
      console.log('Fetching investigators from:', `${API_BASE_URL}/auth/investigators`);
      const response = await fetch(`${API_BASE_URL}/auth/investigators`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeader(),
        },
      });

      console.log('Investigators API response status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to fetch investigators: ${response.status} ${response.statusText}`);
      }

      const data: Investigator[] = await response.json();
      console.log('Investigators API response data:', data);
      return data;
    } catch (error) {
      console.error('Error fetching investigators:', error);
      throw error;
    }
  }
}

const authService = new AuthService();
export default authService;
