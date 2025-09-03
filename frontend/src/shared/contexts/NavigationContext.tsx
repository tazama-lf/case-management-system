import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NavigationContext from './NavigationContext';
import { useAuth } from '../../auth/components/AuthContext';
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

  // Sync with auth context user
  useEffect(() => {
    setUser(authUser);
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
