import { createContext } from 'react';
import type { NavigationContextType } from '../types/navigation.types';

const NavigationContext = createContext<NavigationContextType | undefined>(
  undefined,
);

export default NavigationContext;
