import { createContext } from 'react';
import type { NavigationContextType } from '../features/shared/types/navigation.types';

const NavigationContext = createContext<NavigationContextType | undefined>(
  undefined,
);

export default NavigationContext;
