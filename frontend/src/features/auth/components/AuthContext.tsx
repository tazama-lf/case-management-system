import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import authService from '../services/authService.ts';
import type {
  AuthContextType,
  User,
  LoginCredentials,
} from '../types/auth.types';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeAuth = (): void => {
      try {
        const storedToken = authService.getToken();
        const storedUser = authService.getUser();

        if (storedToken && authService.isAuthenticated()) {
          setToken(storedToken);
          setUser(storedUser);
          setIsAuthenticated(true);
        } else {
          authService.logout();
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        authService.logout();
      } finally {
        setLoading(false);
      }
    };

    initializeAuth();
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent): void => {
      // Another tab logged out
      if (e.key === 'ACTIVE_SESSION_KEY' && !e.newValue) {
        logout();
      }

      // Token replaced by a different user
      if (e.key === 'ACTIVE_SESSION_USER' && e.newValue !== e.oldValue) {
        logout();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // Token expiration monitoring - logout when token expires
  useEffect(() => {
    let expirationCheckTimer: NodeJS.Timeout;

    if (token && isAuthenticated) {
      const tokenExpiration = authService.getTokenExpiration(token);
      if (tokenExpiration) {
        const timeUntilExpiration = tokenExpiration.getTime() - Date.now();

        // If token is already expired or will expire soon, logout
        if (timeUntilExpiration <= 0) {
          logout();
        } else {
          // Set timer to logout when token expires
          expirationCheckTimer = setTimeout(() => {
            logout();
          }, timeUntilExpiration);
        }
      }
    }

    return () => {
      if (expirationCheckTimer) {
        clearTimeout(expirationCheckTimer);
      }
    };
  }, [token, isAuthenticated]);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    setLoading(true);
    setError(null);

    try {
      const response = await authService.login(credentials);

      if (response.token && response.user) {
        setToken(response.token);
        setUser(response.user);
        setIsAuthenticated(true);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Login failed';
      console.error('AuthContext.login() - Login failed:', errorMessage);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = (): void => {
    authService.logout();
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setError(null);

    window.location.href = '/login';
  };

  const clearError = (): void => {
    setError(null);
  };

  const value: AuthContextType = {
    isAuthenticated,
    user,
    token,
    loading,
    error,
    login,
    logout,
    clearError,
    hasBackendClaim: authService.hasBackendClaim.bind(authService),
    // hasCMSTestRole: authService.hasCMSTestRole.bind(authService),
    // hasAlertTriageRole: authService.hasAlertTriageRole.bind(authService),
    hasInvestigatorRole: authService.hasInvestigatorRole.bind(authService),
    hasSupervisorRole: authService.hasSupervisorRole.bind(authService),
    hasComplianceOfficerRole:
      authService.hasComplianceOfficerRole.bind(authService),
    hasCMSAdminRole: authService.hasCMSAdminRole.bind(authService),
    hasAdminRole: authService.hasAdminRole.bind(authService),
    hasAnyRole: authService.hasAnyRole.bind(authService),
    hasAllRoles: authService.hasAllRoles.bind(authService),
    validateBackendAccess: authService.validateBackendAccess.bind(authService),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
