import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NavigationContext from './NavigationContext';
import { useAuth } from '../../features/auth/components/AuthContext';
import type { NavigationContextType, User } from '../types/navigation.types';

interface NavigationProviderProps {
  children: React.ReactNode;
}

const NavigationProvider: React.FC<NavigationProviderProps> = ({
  children,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user: authUser } = useAuth();
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    if (authUser === null) {
      setUser(null);
    } else {
      // Ensure the properties conform to the User type
      setUser({
        user_id: authUser.user_id,
        username: authUser.username,
        roles: authUser.roles,
        email: authUser.email,
        fullName: authUser.fullName,
        tenantId: authUser.tenantId,
      });
    }
  }, [authUser]);

  const handleNavigate = (path: string) => {
    navigate(path);
  };

  const value: NavigationContextType = {
    currentPath: location.pathname,
    navigate: handleNavigate,
    user,
    setUser,
  };

  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export { NavigationProvider };
export default NavigationProvider;
