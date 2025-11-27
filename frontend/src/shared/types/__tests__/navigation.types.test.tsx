import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import {
  type NavItem,
  type User,
  type BreadcrumbItem,
  type LayoutProps,
  type SidebarProps,
  type HeaderProps,
  type NavigationContextType,
} from '../navigation.types';

// Import the actual module to ensure it's loaded
import * as NavigationTypes from '../navigation.types';

describe('navigation.types', () => {
  it('exports the module', () => {
    // TypeScript types don't exist at runtime, so we just verify the module is importable
    expect(NavigationTypes).toBeDefined();
    expect(typeof NavigationTypes).toBe('object');
  });

  describe('NavItem', () => {
    it('defines NavItem interface with all required properties', () => {
      const navItem: NavItem = {
        name: 'Dashboard',
        href: '/dashboard',
        icon: () => null,
        current: false,
        badge: 5,
        roles: ['CMS_ADMIN'],
        children: [],
      };

      expect(navItem.name).toBe('Dashboard');
      expect(navItem.href).toBe('/dashboard');
      expect(navItem.current).toBe(false);
      expect(navItem.badge).toBe(5);
      expect(navItem.roles).toEqual(['CMS_ADMIN']);
      expect(navItem.children).toEqual([]);
    });

    it('supports optional properties', () => {
      const minimalNavItem: NavItem = {
        name: 'Minimal',
        href: '/minimal',
        icon: () => null,
      };

      expect(minimalNavItem.name).toBe('Minimal');
      expect(minimalNavItem.current).toBeUndefined();
      expect(minimalNavItem.badge).toBeUndefined();
      expect(minimalNavItem.roles).toBeUndefined();
      expect(minimalNavItem.children).toBeUndefined();
    });

    it('supports nested children', () => {
      const parentNavItem: NavItem = {
        name: 'Parent',
        href: '/parent',
        icon: () => null,
        children: [
          {
            name: 'Child',
            href: '/parent/child',
            icon: () => null,
          },
        ],
      };

      expect(parentNavItem.children).toBeDefined();
      expect(parentNavItem.children?.length).toBe(1);
      expect(parentNavItem.children?.[0].name).toBe('Child');
    });
  });

  describe('User', () => {
    it('defines User interface with all required properties', () => {
      const user: User = {
        user_id: 'user-1',
        username: 'johndoe',
        email: 'john@example.com',
        firstName: 'John',
        lastName: 'Doe',
        fullName: 'John Doe',
        tenantId: 'tenant-1',
        roles: ['CMS_ADMIN'],
        permissions: ['read:cases'],
        backendClaims: ['claim1'],
        name: 'John Doe',
        initials: 'JD',
      };

      expect(user.user_id).toBe('user-1');
      expect(user.username).toBe('johndoe');
      expect(user.email).toBe('john@example.com');
      expect(user.firstName).toBe('John');
      expect(user.lastName).toBe('Doe');
      expect(user.fullName).toBe('John Doe');
      expect(user.tenantId).toBe('tenant-1');
      expect(user.roles).toEqual(['CMS_ADMIN']);
      expect(user.permissions).toEqual(['read:cases']);
      expect(user.backendClaims).toEqual(['claim1']);
      expect(user.name).toBe('John Doe');
      expect(user.initials).toBe('JD');
    });

    it('supports minimal User with only required properties', () => {
      const minimalUser: User = {
        user_id: 'user-1',
        username: 'testuser',
        tenantId: 'tenant-1',
        roles: [],
      };

      expect(minimalUser.user_id).toBe('user-1');
      expect(minimalUser.username).toBe('testuser');
      expect(minimalUser.tenantId).toBe('tenant-1');
      expect(minimalUser.roles).toEqual([]);
      expect(minimalUser.email).toBeUndefined();
    });

    it('supports multiple roles', () => {
      const user: User = {
        user_id: 'user-1',
        username: 'admin',
        tenantId: 'tenant-1',
        roles: ['CMS_ADMIN', 'CMS_SUPERVISOR', 'CMS_INVESTIGATOR'],
      };

      expect(user.roles.length).toBe(3);
      expect(user.roles).toContain('CMS_ADMIN');
    });
  });

  describe('BreadcrumbItem', () => {
    it('defines BreadcrumbItem interface with all properties', () => {
      const breadcrumb: BreadcrumbItem = {
        name: 'Cases',
        href: '/cases',
        current: false,
      };

      expect(breadcrumb.name).toBe('Cases');
      expect(breadcrumb.href).toBe('/cases');
      expect(breadcrumb.current).toBe(false);
    });

    it('supports optional href', () => {
      const breadcrumb: BreadcrumbItem = {
        name: 'Current Page',
        current: true,
      };

      expect(breadcrumb.name).toBe('Current Page');
      expect(breadcrumb.href).toBeUndefined();
      expect(breadcrumb.current).toBe(true);
    });

    it('supports current page without href', () => {
      const currentBreadcrumb: BreadcrumbItem = {
        name: 'Current',
        current: true,
      };

      expect(currentBreadcrumb.current).toBe(true);
    });
  });

  describe('LayoutProps', () => {
    it('defines LayoutProps interface with all properties', () => {
      const layoutProps: LayoutProps = {
        children: <div>Content</div>,
        title: 'Page Title',
        breadcrumbs: [{ name: 'Home', href: '/' }],
        user: {
          user_id: 'user-1',
          username: 'test',
          tenantId: 'tenant-1',
          roles: [],
        },
      };

      expect(layoutProps.title).toBe('Page Title');
      expect(layoutProps.breadcrumbs).toBeDefined();
      expect(layoutProps.breadcrumbs?.length).toBe(1);
      expect(layoutProps.user).toBeDefined();
    });

    it('supports optional properties', () => {
      const minimalLayoutProps: LayoutProps = {
        children: <div>Content</div>,
      };

      expect(minimalLayoutProps.children).toBeDefined();
      expect(minimalLayoutProps.title).toBeUndefined();
      expect(minimalLayoutProps.breadcrumbs).toBeUndefined();
      expect(minimalLayoutProps.user).toBeUndefined();
    });
  });

  describe('SidebarProps', () => {
    it('defines SidebarProps interface with all properties', () => {
      const sidebarProps: SidebarProps = {
        navigation: [
          {
            name: 'Dashboard',
            href: '/dashboard',
            icon: () => null,
          },
        ],
        onNavigate: vi.fn(),
        onLogout: vi.fn(),
      };

      expect(sidebarProps.navigation).toBeDefined();
      expect(sidebarProps.navigation.length).toBe(1);
      expect(sidebarProps.onNavigate).toBeDefined();
      expect(sidebarProps.onLogout).toBeDefined();
    });

    it('supports optional callbacks', () => {
      const minimalSidebarProps: SidebarProps = {
        navigation: [],
      };

      expect(minimalSidebarProps.navigation).toEqual([]);
      expect(minimalSidebarProps.onNavigate).toBeUndefined();
      expect(minimalSidebarProps.onLogout).toBeUndefined();
    });
  });

  describe('HeaderProps', () => {
    it('defines HeaderProps interface with all properties', () => {
      const headerProps: HeaderProps = {
        user: {
          user_id: 'user-1',
          username: 'test',
          tenantId: 'tenant-1',
          roles: [],
        },
        title: 'Header Title',
        breadcrumbs: [{ name: 'Home', href: '/' }],
        onLogout: vi.fn(),
      };

      expect(headerProps.title).toBe('Header Title');
      expect(headerProps.user).toBeDefined();
      expect(headerProps.breadcrumbs).toBeDefined();
      expect(headerProps.onLogout).toBeDefined();
    });

    it('supports optional properties', () => {
      const minimalHeaderProps: HeaderProps = {};

      expect(minimalHeaderProps.user).toBeUndefined();
      expect(minimalHeaderProps.title).toBeUndefined();
      expect(minimalHeaderProps.breadcrumbs).toBeUndefined();
      expect(minimalHeaderProps.onLogout).toBeUndefined();
    });
  });

  describe('NavigationContextType', () => {
    it('defines NavigationContextType interface with all properties', () => {
      const mockNavigate = vi.fn();
      const mockSetUser = vi.fn();
      const context: NavigationContextType = {
        currentPath: '/dashboard',
        navigate: mockNavigate,
        user: {
          user_id: 'user-1',
          username: 'test',
          tenantId: 'tenant-1',
          roles: [],
        },
        setUser: mockSetUser,
      };

      expect(context.currentPath).toBe('/dashboard');
      expect(context.navigate).toBe(mockNavigate);
      expect(context.user).toBeDefined();
      expect(context.setUser).toBe(mockSetUser);
    });

    it('supports null user', () => {
      const context: NavigationContextType = {
        currentPath: '/login',
        navigate: vi.fn(),
        user: null,
        setUser: vi.fn(),
      };

      expect(context.user).toBeNull();
    });

    it('can call navigate function', () => {
      const mockNavigate = vi.fn();
      const context: NavigationContextType = {
        currentPath: '/dashboard',
        navigate: mockNavigate,
        user: null,
        setUser: vi.fn(),
      };

      context.navigate('/cases');
      expect(mockNavigate).toHaveBeenCalledWith('/cases');
    });

    it('can call setUser function', () => {
      const mockSetUser = vi.fn();
      const context: NavigationContextType = {
        currentPath: '/dashboard',
        navigate: vi.fn(),
        user: null,
        setUser: mockSetUser,
      };

      const newUser: User = {
        user_id: 'user-2',
        username: 'newuser',
        tenantId: 'tenant-1',
        roles: [],
      };

      context.setUser(newUser);
      expect(mockSetUser).toHaveBeenCalledWith(newUser);
    });
  });
});

