import {
  HomeIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  FolderIcon,
  Cog6ToothIcon,
  QueueListIcon,
} from '@heroicons/react/24/outline';
import type { NavItem } from '../types/navigation.types';
export const NAVIGATION_ITEMS: NavItem[] = [
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: HomeIcon,
    roles: [],
  },
  {
    name: 'Alerts',
    href: '/alerts',
    icon: ExclamationTriangleIcon,
    roles: ['alert-triage'],
  },
  {
    name: 'Cases',
    href: '/cases',
    icon: FolderIcon,
    roles: ['CMS_INVESTIGATOR'],
  },
  {
    name: 'Reports',
    href: '/reports',
    icon: ChartBarIcon,
    roles: [],
  },
  {
    name: 'Admin',
    href: '/admin',
    icon: Cog6ToothIcon,
    roles: ['alert-triage'],
  },
  {
    name: 'Work Queue',
    href: '/work-queue',
    icon: QueueListIcon,
    roles: ['CMS_SUPERVISOR'],
  },
];

export { ROLE_HIERARCHY } from '../config/roles.config';
export const ROUTES = {
  DASHBOARD: '/dashboard',
  REPORTS: '/reports',
  ALERTS: '/alerts',
  CASES: '/cases',
  WORK_QUEUE: '/work-queue',
  ADMIN: '/admin',
  LOGIN: '/login',
} as const;
