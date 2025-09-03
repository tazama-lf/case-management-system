import {
  ExclamationTriangleIcon,
  FolderIcon,
  UserGroupIcon,
  Cog6ToothIcon,
} from '@heroicons/react/24/outline';
import type { NavItem } from '../types/navigation.types';

export const NAVIGATION_ITEMS: NavItem[] = [
  {
    name: 'Alerts Dashboard',
    href: '/alerts',
    icon: ExclamationTriangleIcon,
  },
  {
    name: 'Cases Dashboard',
    href: '/cases',
    icon: FolderIcon,
  },
  {
    name: 'Supervisor Dashboard',
    href: '/supervisor',
    icon: UserGroupIcon,
    // roles: ['supervisor', 'admin'],
  },
  {
    name: 'Admin Dashboard',
    href: '/admin',
    icon: Cog6ToothIcon,
    // roles: ['admin'],
  },
];

// Re-export the role hierarchy from the config
export { ROLE_HIERARCHY } from '../config/roles.config';

export const ROUTES = {
  ALERTS: '/alerts',
  CASES: '/cases',
  SUPERVISOR: '/supervisor',
  ADMIN: '/admin',
  LOGIN: '/login',
} as const;
