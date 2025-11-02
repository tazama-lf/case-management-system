import React from 'react';

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  current?: boolean;
  badge?: number;
  roles?: string[];
  children?: NavItem[];
}

export interface User {
  user_id: string;
  username: string;
  email?: string;
  tenantId: string;
  roles: string[];
  permissions?: string[];
  name?: string;
  initials?: string;
}

export interface BreadcrumbItem {
  name: string;
  href?: string;
  current?: boolean;
}

export interface LayoutProps {
  children: React.ReactNode;
  user?: User;
  title?: string;
  breadcrumbs?: BreadcrumbItem[];
}

export interface SidebarProps {
  navigation: NavItem[];
  onNavigate?: (href: string) => void;
  onLogout?: () => void;
}

export interface HeaderProps {
  user?: User;
  onLogout?: () => void;
  breadcrumbs?: BreadcrumbItem[];
  title?: string;
}

export type NavigationContextType = {
  currentPath: string;
  navigate: (path: string) => void;
  user: User | null;
  setUser: (user: User | null) => void;
};
