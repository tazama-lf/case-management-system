import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import NavigationContext from './NavigationContext';
import type { NavigationContextType, User } from '../types/navigation.types';

interface NavigationProviderProps {
  children: React.ReactNode;
}

const NavigationProvider: React.FC<NavigationProviderProps> = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [user, setUser] = useState<User | null>(null);

  // Mock user for development - TODO: Replace with actual auth
  useEffect(() => {
    const mockUser: User = {
      user_id: 'user-123',
      username: 'john.doe',
      email: 'john.doe@tazama.org',
      name: 'John Doe',
      initials: 'JD',
      tenantId: 'tenant-123',
      roles: ['investigator', 'analyst'],
      permissions: ['read:alerts', 'write:cases', 'read:analytics']
    };
    setUser(mockUser);
  }, []);

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
