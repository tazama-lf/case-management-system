import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { AuditLogService } from '../../src/audit/auditLog.service';
<<<<<<< HEAD
import { UnauthorizedException, Logger } from '@nestjs/common';
=======
import { UnauthorizedException } from '@nestjs/common';
>>>>>>> ac7173e (feat: Test Coverage)

describe('AuthController', () => {
  let controller: AuthController;
  let authService: any;
  let auditLogService: any;

  const mockAuthService = {
    login: jest.fn(),
  };

  const mockAuditLogService = {
    logAction: jest.fn(),
    getLogs: jest.fn(),
  };

<<<<<<< HEAD
  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
  };

=======
>>>>>>> ac7173e (feat: Test Coverage)
  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
<<<<<<< HEAD
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: Logger, useValue: mockLogger },
=======
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
>>>>>>> ac7173e (feat: Test Coverage)
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    auditLogService = module.get(AuditLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

<<<<<<< HEAD
  it('should handle empty login credentials', async () => {
    const loginDto = { username: '', password: '' };

    authService.login.mockRejectedValue(new Error('Empty credentials'));
    auditLogService.logAction.mockResolvedValue({});

    await expect(controller.login(loginDto)).rejects.toThrow(
      UnauthorizedException,
    );

    expect(authService.login).toHaveBeenCalledWith('', '');
    expect(auditLogService.logAction).toHaveBeenCalledWith({
      userId: 'unknown',
      operation: 'login',
      entityName: 'user',
      actionPerformed: 'login',
      outcome: 'failure',
    });
  });

  it('should handle special characters in username and password', async () => {
    const loginDto = { username: 'test@user.com', password: 'p@ssw0rd!' };
    const mockToken = 'jwt-token-special';

    authService.login.mockResolvedValue({ token: mockToken });
    auditLogService.logAction.mockResolvedValue({});

    const result = await controller.login(loginDto);

    expect(authService.login).toHaveBeenCalledWith(
      'test@user.com',
      'p@ssw0rd!',
    );
    expect(result).toEqual({
      message: 'Login successful',
      token: mockToken,
=======
  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('login', () => {
    it('should successfully login and return token with success audit log', async () => {
      const loginDto = { username: 'testuser', password: 'testpass' };
      const mockToken = 'jwt-token-123';

      authService.login.mockResolvedValue({ token: mockToken });
      auditLogService.logAction.mockResolvedValue({});

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith('testuser', 'testpass');
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId: 'unknown',
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: 'success',
      });
      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
      });
    });

    it('should handle login failure and log failure audit', async () => {
      const loginDto = { username: 'testuser', password: 'wrongpass' };
      const errorMessage = 'Authentication failed';

      authService.login.mockRejectedValue(new Error(errorMessage));
      auditLogService.logAction.mockResolvedValue({});

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(authService.login).toHaveBeenCalledWith('testuser', 'wrongpass');
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId: 'unknown',
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: 'failure',
      });
    });

    it('should throw UnauthorizedException with message "Invalid credentials" on login failure', async () => {
      const loginDto = { username: 'testuser', password: 'wrongpass' };

      authService.login.mockRejectedValue(new Error('Some auth error'));
      auditLogService.logAction.mockResolvedValue({});

      try {
        await controller.login(loginDto);
        fail('Expected UnauthorizedException to be thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(UnauthorizedException);
        expect(error.message).toBe('Invalid credentials');
      }
    });

    it('should handle empty login credentials', async () => {
      const loginDto = { username: '', password: '' };

      authService.login.mockRejectedValue(new Error('Empty credentials'));
      auditLogService.logAction.mockResolvedValue({});

      await expect(controller.login(loginDto)).rejects.toThrow(
        UnauthorizedException,
      );

      expect(authService.login).toHaveBeenCalledWith('', '');
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId: 'unknown',
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: 'failure',
      });
    });

    it('should handle special characters in username and password', async () => {
      const loginDto = { username: 'test@user.com', password: 'p@ssw0rd!' };
      const mockToken = 'jwt-token-special';

      authService.login.mockResolvedValue({ token: mockToken });
      auditLogService.logAction.mockResolvedValue({});

      const result = await controller.login(loginDto);

      expect(authService.login).toHaveBeenCalledWith(
        'test@user.com',
        'p@ssw0rd!',
      );
      expect(result).toEqual({
        message: 'Login successful',
        token: mockToken,
      });
>>>>>>> ac7173e (feat: Test Coverage)
    });
  });

  describe('getMe', () => {
    it('should return user information', () => {
      const mockUser = {
        user_id: 'user-123',
        tenantId: 'tenant-456',
        role: ['admin'],
        permissions: ['read', 'write'],
      };

      const result = controller.getMe(mockUser);

      expect(result).toEqual(mockUser);
    });

    it('should handle user with minimal information', () => {
      const mockUser = {
        user_id: 'user-minimal',
        tenantId: 'tenant-minimal',
        role: [],
        permissions: [],
      };

      const result = controller.getMe(mockUser);

      expect(result).toEqual(mockUser);
    });

    it('should handle user with additional properties', () => {
      const mockUser = {
        user_id: 'user-123',
        tenantId: 'tenant-456',
        role: ['admin'],
        permissions: ['read', 'write'],
        username: 'testuser',
        email: 'test@example.com',
        exp: 1234567890,
      };

      const result = controller.getMe(mockUser);

      expect(result).toEqual(mockUser);
    });
  });

  describe('getAuditLogs', () => {
    it('should get audit logs with default parameters', async () => {
      const mockLogs = [
        {
          audit_log_id: 'log-1',
          user_id: 'user-1',
          operation: 'login',
          entity_name: 'user',
          action_performed: 'login',
          outcome: 'success',
          performed_at: new Date(),
        },
        {
          audit_log_id: 'log-2',
          user_id: 'user-2',
          operation: 'logout',
          entity_name: 'user',
          action_performed: 'logout',
          outcome: 'success',
          performed_at: new Date(),
        },
      ];

      auditLogService.getLogs.mockResolvedValue(mockLogs);

      const result = await controller.getAuditLogs();

      expect(auditLogService.getLogs).toHaveBeenCalledWith(50, 0);
      expect(result).toEqual(mockLogs);
    });

    it('should get audit logs with custom limit and offset', async () => {
      const mockLogs = [
        {
          audit_log_id: 'log-1',
          user_id: 'user-1',
          operation: 'alert_created',
          entity_name: 'alert',
          action_performed: 'create alert',
          outcome: 'success',
          performed_at: new Date(),
        },
      ];

      auditLogService.getLogs.mockResolvedValue(mockLogs);

      const result = await controller.getAuditLogs(10, 20);

      expect(auditLogService.getLogs).toHaveBeenCalledWith(10, 20);
      expect(result).toEqual(mockLogs);
    });

    it('should handle string parameters by converting to numbers', async () => {
      const mockLogs = [];

      auditLogService.getLogs.mockResolvedValue(mockLogs);

      const result = await controller.getAuditLogs('25' as any, '5' as any);

      expect(auditLogService.getLogs).toHaveBeenCalledWith(25, 5);
      expect(result).toEqual(mockLogs);
    });

    it('should handle empty audit logs response', async () => {
      auditLogService.getLogs.mockResolvedValue([]);

      const result = await controller.getAuditLogs();

      expect(auditLogService.getLogs).toHaveBeenCalledWith(50, 0);
      expect(result).toEqual([]);
    });

    it('should handle audit service error', async () => {
      const errorMessage = 'Database connection failed';
      auditLogService.getLogs.mockRejectedValue(new Error(errorMessage));

      await expect(controller.getAuditLogs()).rejects.toThrow(errorMessage);
      expect(auditLogService.getLogs).toHaveBeenCalledWith(50, 0);
    });
  });
});
