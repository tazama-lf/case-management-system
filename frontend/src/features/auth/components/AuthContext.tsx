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

  // Initialize auth state on app start
  useEffect(() => {
    const initializeAuth = () => {
      try {
        const storedToken = authService.getToken();
        const storedUser = authService.getUser();

        console.log('Auth initialization:', {
          hasStoredToken: !!storedToken,
          hasStoredUser: !!storedUser,
          isTokenValid: storedToken ? !authService.isTokenExpired(storedToken) : false,
          isAuthenticated: authService.isAuthenticated()
        });

        if (storedToken && authService.isAuthenticated()) {
          console.log('Restoring authenticated session');
          setToken(storedToken);
          setUser(storedUser);
          setIsAuthenticated(true);
        } else {
          console.log('No valid session found, cleaning up');
          // Clean up if token is expired
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

  // Auto-refresh token before expiration
  useEffect(() => {
    let refreshTimer: NodeJS.Timeout;

    if (token && isAuthenticated) {
      const tokenExpiration = authService.getTokenExpiration(token);
      if (tokenExpiration) {
        // Refresh 5 minutes before expiration
        const refreshTime =
          tokenExpiration.getTime() - Date.now() - 5 * 60 * 1000;

        if (refreshTime > 0) {
          refreshTimer = setTimeout(async () => {
            const refreshed = await authService.refreshToken();
            if (!refreshed) {
              // If refresh fails, logout user
              logout();
            } else {
              // Update token state
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
      console.log('AuthContext.login() - Starting login...');
      const response = await authService.login(credentials);

      if (response.token && response.user) {
        console.log('AuthContext.login() - Setting auth state', {
          hasToken: !!response.token,
          hasUser: !!response.user,
          userClaims: response.user.backendClaims
        });
        
        setToken(response.token);
        setUser(response.user);
        setIsAuthenticated(true);
        
        console.log('AuthContext.login() - Auth state updated successfully');
      } else {
        console.log('AuthContext.login() - Missing token or user in response', response);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Login failed';
      console.error('AuthContext.login() - Login failed:', errorMessage);
      setError(errorMessage);
      throw error;
    } finally {
      setLoading(false);
      console.log('AuthContext.login() - Login process completed');
    }
  };

  const logout = (): void => {
    authService.logout();
    setToken(null);
    setUser(null);
    setIsAuthenticated(false);
    setError(null);

    // Redirect to login page
    window.location.href = '/login';
  };

  const clearError = (): void => {
    setError(null);
  };

  // Backend claim utility functions
  const hasBackendClaim = (claim: string): boolean => {
    return authService.hasBackendClaim(claim);
  };

  const hasCMSTestRole = (): boolean => {
    return authService.hasCMSTestRole();
  };

  const hasAlertTriageRole = (): boolean => {
    return authService.hasAlertTriageRole();
  };

  const validateBackendAccess = (): boolean => {
    return authService.validateBackendAccess();
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
    hasBackendClaim,
    hasCMSTestRole,
    hasAlertTriageRole,
    validateBackendAccess,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
