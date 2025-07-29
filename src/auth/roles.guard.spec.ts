import { RolesGuard } from './roles.guard';
import { Reflector } from '@nestjs/core';
import { AuditLogService } from '../audit/auditLog.service';

describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: Reflector;
  let auditLogService: AuditLogService;

  beforeEach(() => {
    reflector = { getAllAndOverride: jest.fn() } as any;
    auditLogService = { logPermissionDenied: jest.fn() } as any;
    guard = new RolesGuard(reflector, auditLogService);
  });

  it('should allow access if user has required role', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['ADMIN']);
    const context: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: ['ADMIN'], permissions: ['view-profile'] },
          method: 'GET',
          originalUrl: '/dashboard',
        }),
      }),
      getHandler: () => {},
      getClass: () => {},
    };
    expect(guard.canActivate(context)).toBe(true);
  });

  it('should deny access if user lacks required role', () => {
    reflector.getAllAndOverride = jest.fn().mockReturnValue(['ADMIN']);
    const context: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: ['USER'], permissions: ['view-profile'] },
          method: 'GET',
          originalUrl: '/dashboard',
        }),
      }),
      getHandler: () => {},
      getClass: () => {},
    };
    expect(() => guard.canActivate(context)).toThrow();
    expect(auditLogService.logPermissionDenied).toHaveBeenCalled();
  });

  it('should deny access if user lacks required permission', () => {
    reflector.getAllAndOverride = jest.fn()
      .mockReturnValueOnce(['ADMIN']) // roles
      .mockReturnValueOnce(['view-profile']); // permissions
    const context: any = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: { role: ['ADMIN'], permissions: ['other-permission'] },
          method: 'GET',
          originalUrl: '/dashboard',
        }),
      }),
      getHandler: () => {},
      getClass: () => {},
    };
    expect(() => guard.canActivate(context)).toThrow();
    expect(auditLogService.logPermissionDenied).toHaveBeenCalled();
  });
});
