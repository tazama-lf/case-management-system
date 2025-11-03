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
    const initializeAuth = () => {
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
    let refreshTimer: NodeJS.Timeout;

    if (token && isAuthenticated) {
      const tokenExpiration = authService.getTokenExpiration(token);
      if (tokenExpiration) {
        const refreshTime =
          tokenExpiration.getTime() - Date.now() - 5 * 60 * 1000;

        if (refreshTime > 0) {
          refreshTimer = setTimeout(async () => {
            const refreshed = await authService.refreshToken();
            if (!refreshed) {
              logout();
            } else {
              const newToken = authService.getToken();
              setToken(newToken);
            }
          }, refreshTime);
        }
      }
    }

    return () => {
      if (refreshTimer) {
        clearTimeout(refreshTimer);
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

      } else {
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
    hasCMSTestRole: authService.hasCMSTestRole.bind(authService),
    hasAlertTriageRole: authService.hasAlertTriageRole.bind(authService),
    hasInvestigatorRole: authService.hasInvestigatorRole.bind(authService),
    hasSupervisorRole: authService.hasSupervisorRole.bind(authService),
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
