import {
  HomeIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
} from '@heroicons/react/24/outline';
import type { NavItem } from '../types/navigation.types';
export const NAVIGATION_ITEMS: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    roles: ['CMS_SUPERVISOR', 'CMS_INVESTIGATOR', 'alert-triage'],
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: ExclamationTriangleIcon,
    roles: ['CMS_SUPERVISOR', 'CMS_INVESTIGATOR', 'alert-triage'],
  },
  {
    name: 'Cases',
    href: '/cases',
    icon: FolderIcon,
    roles: [
      'CMS_SUPERVISOR',
      'CMS_INVESTIGATOR',
      'CMS_COMPLIANCE_OFFICER',
      'alert-triage',
    ],
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: ChartBarIcon,
    roles: ['CMS_SUPERVISOR', 'CMS_INVESTIGATOR', 'alert-triage'],
  },

  {
    name: 'Admin',
    href: '/admin',
    icon: Cog6ToothIcon,
    roles: ['CMS_ADMIN'],
  },
];

export { ROLE_HIERARCHY } from '../config/roles.config';
export const ROUTES = {
  DASHBOARD: '/dashboard',
  REPORTS: '/reports',
  ALERTS: '/alerts',
  CASES: '/cases',
  ADMIN: '/admin',
  LOGIN: '/login',
} as const;
