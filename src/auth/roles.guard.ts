<<<<<<< HEAD
<<<<<<< HEAD
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
<<<<<<< HEAD
<<<<<<< HEAD
=======
import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
>>>>>>> ac7173e (feat: Test Coverage)
=======
import { CanActivate, ExecutionContext, Injectable, ForbiddenException } from '@nestjs/common';
>>>>>>> 85c2ac7 (fix:jest.config.js to jest.config.ts)
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
import { AuditLogService } from '../audit/auditLog.service';
<<<<<<< HEAD
=======
import { Reflector } from '@nestjs/core';
import { SetMetadata } from '@nestjs/common';
>>>>>>> 0d49113 (feat:auth)
=======
>>>>>>> 9fad687 (feat:auth)

export const ROLES_KEY = 'roles';
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

export const PERMISSIONS_KEY = 'permissions';
<<<<<<< HEAD
<<<<<<< HEAD
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
<<<<<<< HEAD

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private auditLogService: AuditLogService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    const { user, method, originalUrl } = context.switchToHttp().getRequest();
    if (!user) {
      this.auditLogService.logPermissionDenied(null, originalUrl, method, {
        reason: 'No user in request',
      });
      this.auditLogService.logPermissionDenied(null, originalUrl, method, {
        reason: 'No user in request',
      });
      throw new ForbiddenException('No user found in request');
    }

    // Role check
    if (requiredRoles && requiredRoles.length > 0) {
      const userRoles = user.role || [];
      const hasRole = requiredRoles.some((role) => userRoles.includes(role));

      if (!hasRole) {
        this.auditLogService.logPermissionDenied(user, originalUrl, method, {
          reason: 'Insufficient role',
          requiredRoles,
        });
        throw new ForbiddenException('Insufficient role');
      }
    }
      if (!hasRole) {
        this.auditLogService.logPermissionDenied(user, originalUrl, method, {
          reason: 'Insufficient role',
          requiredRoles,
        });
        throw new ForbiddenException('Insufficient role');
      }
    }
    // Permissions check
    if (requiredPermissions && requiredPermissions.length > 0) {
      if (!user.permissions || !requiredPermissions.every((p) => user.permissions.includes(p))) {
        this.auditLogService.logPermissionDenied(user, originalUrl, method, {
          reason: 'Insufficient permissions',
          requiredPermissions,
        });
        throw new ForbiddenException('Insufficient permissions');
      }
    }
    return true;
  }
}
<<<<<<< HEAD

=======
=======
=======
>>>>>>> 0d49113 (feat:auth)
=======
export const Permissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
>>>>>>> ac7173e (feat: Test Coverage)
=======
export const Permissions = (...permissions: string[]) => SetMetadata(PERMISSIONS_KEY, permissions);
>>>>>>> 85c2ac7 (fix:jest.config.js to jest.config.ts)

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private auditLogService: AuditLogService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [context.getHandler(), context.getClass()]);
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    const { user, method, originalUrl } = context.switchToHttp().getRequest();
    if (!user) {
      this.auditLogService.logPermissionDenied(null, originalUrl, method, {
        reason: 'No user in request',
      });
      throw new ForbiddenException('No user found in request');
    }

    // Role check
    if (requiredRoles && requiredRoles.length > 0) {
      const userRoles = user.role || [];
      const hasRole = requiredRoles.some((role) => userRoles.includes(role));

      if (!hasRole) {
        this.auditLogService.logPermissionDenied(user, originalUrl, method, {
          reason: 'Insufficient role',
          requiredRoles,
        });
        throw new ForbiddenException('Insufficient role');
      }
    }
    // Permissions check
    if (requiredPermissions && requiredPermissions.length > 0) {
      if (!user.permissions || !requiredPermissions.every((p) => user.permissions.includes(p))) {
        this.auditLogService.logPermissionDenied(user, originalUrl, method, {
          reason: 'Insufficient permissions',
          requiredPermissions,
        });
        throw new ForbiddenException('Insufficient permissions');
      }
    }
    return true;
  }
}
<<<<<<< HEAD
>>>>>>> 63fc0de (feat:implementing the auth service)
=======
>>>>>>> ac7173e (feat: Test Coverage)
