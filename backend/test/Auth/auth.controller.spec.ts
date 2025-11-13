import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from '../../src/auth/auth.controller';
import { AuthService } from '../../src/auth/auth.service';
import { AuditLogService } from '../../src/audit/auditLog.service';
import { UnauthorizedException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { Outcome } from '../../src/audit/types/outcome';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;
  let auditLogService: AuditLogService;
  let loggerService: LoggerService;

  const mockAuditLogReturn = {
    audit_log_id: 'test-audit-id',
    user_id: 'test-user-id',
    operation: 'login',
    entity_name: 'user',
    action_performed: 'login',
    outcome: Outcome.SUCCESS,
    performed_at: new Date(),
  };

  beforeEach(async () => {
    const mockAuthService = {
      login: jest.fn(),
      isTokenExpired: jest.fn(),
      getTokenTimeToExpiry: jest.fn(),
    };

    const mockAuditLogService = {
      logAction: jest.fn().mockResolvedValue(mockAuditLogReturn),
      getLogs: jest.fn(),
      logPermissionDenied: jest.fn(),
      getActionHistoryForAlert: jest.fn(),
    };

    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      trace: jest.fn(),
      fatal: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        { provide: AuthService, useValue: mockAuthService },
        { provide: AuditLogService, useValue: mockAuditLogService },
        { provide: LoggerService, useValue: mockLoggerService },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
    auditLogService = module.get<AuditLogService>(AuditLogService);
    loggerService = module.get<LoggerService>(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should handle empty login credentials', async () => {
    const loginDto = { username: '', password: '' };

    (authService.login as jest.Mock).mockRejectedValue(new Error('Empty credentials'));

    await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);

    expect(authService.login).toHaveBeenCalledWith('', '');
    expect(auditLogService.logAction).toHaveBeenCalledWith({
      userId: 'unknown',
      operation: 'login',
      entityName: 'user',
      actionPerformed: 'login',
      outcome: Outcome.FAILURE,
    });
  });

  it('should handle special characters in username and password', async () => {
    const loginDto = { username: 'test@user.com', password: 'p@ssw0rd!' };
    const mockToken = 'jwt-token-special';

    (authService.login as jest.Mock).mockResolvedValue({
      message: 'Login successful',
      token: mockToken,
      expiresIn: null,
    });

    const result = await controller.login(loginDto);

    expect(authService.login).toHaveBeenCalledWith('test@user.com', 'p@ssw0rd!');
    expect(auditLogService.logAction).toHaveBeenCalledWith({
      userId: 'unknown',
      operation: 'login',
      entityName: 'user',
      actionPerformed: 'login',
      outcome: Outcome.SUCCESS,
    });
    expect(result).toEqual({
      message: 'Login successful',
      token: mockToken,
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
          outcome: Outcome.SUCCESS,
          performed_at: new Date(),
        },
      ];
      (auditLogService.getLogs as jest.Mock).mockResolvedValue(mockLogs);
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
          outcome: Outcome.SUCCESS,
          performed_at: new Date(),
        },
      ];
      (auditLogService.getLogs as jest.Mock).mockResolvedValue(mockLogs);
      const result = await controller.getAuditLogs(10, 20);
      expect(auditLogService.getLogs).toHaveBeenCalledWith(10, 20);
      expect(result).toEqual(mockLogs);
    });

    it('should login and not include expiresIn if not present', async () => {
      const loginDto = { username: 'user', password: 'pass' };
      const mockResult = { message: 'Login successful', token: 'jwt-token', expiresIn: null };
      (authService.login as jest.Mock).mockResolvedValue(mockResult);
      const result = await controller.login(loginDto);
      expect(result).toEqual({
        message: 'Login successful',
        token: 'jwt-token',
      });
      expect(authService.login).toHaveBeenCalledWith('user', 'pass');
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId: 'unknown',
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: Outcome.SUCCESS,
      });
    });

    it('should log and throw UnauthorizedException with error message', async () => {
      const loginDto = { username: 'baduser', password: 'badpass' };
      const errorMsg = 'Invalid credentials';
      (authService.login as jest.Mock).mockRejectedValue(new Error(errorMsg));
      await expect(controller.login(loginDto)).rejects.toThrow(UnauthorizedException);
      expect(loggerService.warn).toHaveBeenCalledWith(`Login failed for user baduser: ${errorMsg}`, AuthController.name);
    });

    it('should call auditLogService.logAction with FAILURE on login error', async () => {
      const loginDto = { username: 'fail', password: 'fail' };
      (authService.login as jest.Mock).mockRejectedValue(new Error('fail'));
      try {
        await controller.login(loginDto);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (e) {
        // ignore
      }
      expect(auditLogService.logAction).toHaveBeenCalledWith({
        userId: 'unknown',
        operation: 'login',
        entityName: 'user',
        actionPerformed: 'login',
        outcome: Outcome.FAILURE,
      });
    });

    it('should call logger.log on successful login', async () => {
      const loginDto = { username: 'success', password: 'success' };
      const mockResult = { message: 'Login successful', token: 'jwt-token', expiresIn: 1234 };
      (authService.login as jest.Mock).mockResolvedValue(mockResult);
      await controller.login(loginDto);
      expect(loggerService.log).toHaveBeenCalledWith('Attempting login for user success');
      expect(loggerService.log).toHaveBeenCalledWith(`User ${JSON.stringify(mockResult)} logged in successfully`);
    });

    it('should call auditLogService.getLogs with string numbers', async () => {
      const mockLogs = [
        {
          audit_log_id: 'log-1',
          user_id: 'user-1',
          operation: 'test',
          entity_name: 'test',
          action_performed: 'test',
          outcome: Outcome.SUCCESS,
          performed_at: new Date(),
        },
      ];
      (auditLogService.getLogs as jest.Mock).mockResolvedValue(mockLogs);
      const result = await controller.getAuditLogs(15, 5);
      expect(auditLogService.getLogs).toHaveBeenCalledWith(15, 5);
      expect(result).toEqual(mockLogs);
    });
  });
});
