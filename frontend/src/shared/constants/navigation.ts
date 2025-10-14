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
    roles: ['CMS_SUPERVISOR', 'CMS_INVESTIGATOR', 'alert-triage'],
  },
  {
    name: 'Work Queues',
    href: '/work-queue',
    icon: QueueListIcon,
    roles: ['CMS_SUPERVISOR', 'CMS_INVESTIGATOR', 'alert-triage'],
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
    roles: ['alert-triage'],
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
