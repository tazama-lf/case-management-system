import { Test, TestingModule } from '@nestjs/testing';
<<<<<<< HEAD
<<<<<<< HEAD
import { RolesGuard, Permissions } from '../../src/auth/roles.guard';
=======
import { RolesGuard } from '../../src/auth/roles.guard';
>>>>>>> ac7173e (feat: Test Coverage)
=======
import { RolesGuard, Permissions } from '../../src/auth/roles.guard';
>>>>>>> 2d59734 (feat: Test Coverage for Triage Module)
import { Reflector } from '@nestjs/core';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';

<<<<<<< HEAD
<<<<<<< HEAD
=======
>>>>>>> 2d59734 (feat: Test Coverage for Triage Module)
describe('Permissions Decorator', () => {
  it('should set permissions metadata correctly', () => {
    const permissions = ['read', 'write', 'delete'];
    const decorator = Permissions(...permissions);

    expect(decorator).toBeDefined();
    expect(typeof decorator).toBe('function');
  });

  it('should work with single permission', () => {
    const decorator = Permissions('read');
    expect(decorator).toBeDefined();
  });

  it('should work with multiple permissions', () => {
    const decorator = Permissions('read', 'write', 'delete', 'admin');
    expect(decorator).toBeDefined();
  });

  it('should work with no permissions', () => {
    const decorator = Permissions();
    expect(decorator).toBeDefined();
  });
});

<<<<<<< HEAD
=======
>>>>>>> ac7173e (feat: Test Coverage)
=======
>>>>>>> 2d59734 (feat: Test Coverage for Triage Module)
describe('RolesGuard', () => {
  let guard: RolesGuard;
  let reflector: any;
  let auditLogService: any;

  const mockReflector = {
    getAllAndOverride: jest.fn(),
  };

  const mockAuditLogService = {
    logPermissionDenied: jest.fn(),
  };

  const createMockExecutionContext = (
    user: any,
    method = 'GET',
    originalUrl = '/test',
  ): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          method,
          originalUrl,
        }),
      }),
      getHandler: jest.fn(),
      getClass: jest.fn(),
    } as any;
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RolesGuard,
        {
          provide: Reflector,
          useValue: mockReflector,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
      ],
    }).compile();

    guard = module.get<RolesGuard>(RolesGuard);
    reflector = module.get(Reflector);
    auditLogService = module.get(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  describe('canActivate', () => {
    it('should allow access when no roles or permissions are required', () => {
      const user = { role: ['user'], permissions: ['read'] };
      const context = createMockExecutionContext(user);

      reflector.getAllAndOverride.mockReturnValueOnce(null); // roles
      reflector.getAllAndOverride.mockReturnValueOnce(null); // permissions

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(auditLogService.logPermissionDenied).not.toHaveBeenCalled();
    });

    it('should allow access when user has required role', () => {
      const user = { role: ['admin', 'user'], permissions: ['read', 'write'] };
      const context = createMockExecutionContext(user);

      reflector.getAllAndOverride.mockReturnValueOnce(['admin']); // roles
      reflector.getAllAndOverride.mockReturnValueOnce(null); // permissions

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(auditLogService.logPermissionDenied).not.toHaveBeenCalled();
    });

    it('should allow access when user has one of multiple required roles', () => {
      const user = { role: ['user'], permissions: ['read'] };
      const context = createMockExecutionContext(user);

      reflector.getAllAndOverride.mockReturnValueOnce(['admin', 'user']); // roles
      reflector.getAllAndOverride.mockReturnValueOnce(null); // permissions

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(auditLogService.logPermissionDenied).not.toHaveBeenCalled();
    });

    it('should allow access when user has required permissions', () => {
      const user = { role: ['user'], permissions: ['read', 'write'] };
      const context = createMockExecutionContext(user);

      reflector.getAllAndOverride.mockReturnValueOnce(null); // roles
      reflector.getAllAndOverride.mockReturnValueOnce(['read', 'write']); // permissions

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(auditLogService.logPermissionDenied).not.toHaveBeenCalled();
    });

    it('should allow access when user has both required roles and permissions', () => {
      const user = { role: ['admin'], permissions: ['read', 'write'] };
      const context = createMockExecutionContext(user);

      reflector.getAllAndOverride.mockReturnValueOnce(['admin']); // roles
      reflector.getAllAndOverride.mockReturnValueOnce(['read']); // permissions

      const result = guard.canActivate(context);

      expect(result).toBe(true);
      expect(auditLogService.logPermissionDenied).not.toHaveBeenCalled();
    });

    it('should deny access and log when no user in request', () => {
      const context = createMockExecutionContext(null);

      reflector.getAllAndOverride.mockReturnValueOnce(['admin']); // roles
      reflector.getAllAndOverride.mockReturnValueOnce(null); // permissions

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(auditLogService.logPermissionDenied).toHaveBeenCalledWith(
        null,
        '/test',
        'GET',
        { reason: 'No user in request' },
      );
    });

    it('should deny access and log when user lacks required role', () => {
      const user = { role: ['user'], permissions: ['read'] };
      const context = createMockExecutionContext(user, 'POST', '/admin');

      reflector.getAllAndOverride.mockReturnValueOnce(['admin']); // roles
      reflector.getAllAndOverride.mockReturnValueOnce(null); // permissions

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(auditLogService.logPermissionDenied).toHaveBeenCalledWith(
        user,
        '/admin',
        'POST',
        {
          reason: 'Insufficient role',
          requiredRoles: ['admin'],
        },
      );
    });

    it('should deny access and log when user lacks required permissions', () => {
      const user = { role: ['user'], permissions: ['read'] };
      const context = createMockExecutionContext(user, 'DELETE', '/secure');

      reflector.getAllAndOverride.mockReturnValueOnce(null); // roles
      reflector.getAllAndOverride.mockReturnValueOnce(['write', 'delete']); // permissions

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(auditLogService.logPermissionDenied).toHaveBeenCalledWith(
        user,
        '/secure',
        'DELETE',
        {
          reason: 'Insufficient permissions',
          requiredPermissions: ['write', 'delete'],
        },
      );
    });

    it('should deny access when user has no permissions property', () => {
      const user = { role: ['admin'] };
      const context = createMockExecutionContext(user);

      reflector.getAllAndOverride.mockReturnValueOnce(null); // roles
      reflector.getAllAndOverride.mockReturnValueOnce(['write']); // permissions

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(auditLogService.logPermissionDenied).toHaveBeenCalled();
    });

    it('should deny access when user has empty role array', () => {
      const user = { role: [], permissions: ['read'] };
      const context = createMockExecutionContext(user);

      reflector.getAllAndOverride.mockReturnValueOnce(['admin']); // roles
      reflector.getAllAndOverride.mockReturnValueOnce(null); // permissions

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(auditLogService.logPermissionDenied).toHaveBeenCalled();
    });

    it('should deny access when user has no role property', () => {
      const user = { permissions: ['read'] };
      const context = createMockExecutionContext(user);

      reflector.getAllAndOverride.mockReturnValueOnce(['admin']); // roles
      reflector.getAllAndOverride.mockReturnValueOnce(null); // permissions

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(auditLogService.logPermissionDenied).toHaveBeenCalled();
    });

    it('should handle multiple required roles correctly', () => {
      const user = { role: ['moderator'], permissions: ['read'] };
      const context = createMockExecutionContext(user);

      reflector.getAllAndOverride.mockReturnValueOnce(['admin', 'super-admin']); // roles
      reflector.getAllAndOverride.mockReturnValueOnce(null); // permissions

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(auditLogService.logPermissionDenied).toHaveBeenCalledWith(
        user,
        '/test',
        'GET',
        {
          reason: 'Insufficient role',
          requiredRoles: ['admin', 'super-admin'],
        },
      );
    });

    it('should handle partial permission match correctly', () => {
      const user = { role: ['user'], permissions: ['read'] };
      const context = createMockExecutionContext(user);

      reflector.getAllAndOverride.mockReturnValueOnce(null); // roles
      reflector.getAllAndOverride.mockReturnValueOnce(['read', 'write']); // permissions - both required

      expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
      expect(auditLogService.logPermissionDenied).toHaveBeenCalledWith(
        user,
        '/test',
        'GET',
        {
          reason: 'Insufficient permissions',
          requiredPermissions: ['read', 'write'],
        },
      );
    });
  });
});
