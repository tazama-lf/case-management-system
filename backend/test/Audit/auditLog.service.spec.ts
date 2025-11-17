import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../../src/modules/audit/auditLog.service';
import { PrismaService } from '../../prisma/prisma.service';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(),
  validate: jest.fn(),
}));

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prismaService: any;

  const mockPrismaService = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<AuditLogService>(AuditLogService);
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('logAction', () => {
    it('should create audit log with valid userId', async () => {
      const mockUserId = 'valid-uuid-123';
      const mockAuditLog = {
        audit_log_id: 'audit-id-123',
        user_id: mockUserId,
        operation: 'test-operation',
        entity_name: 'test-entity',
        action_performed: 'test-action',
        outcome: 'success',
        performed_at: new Date(),
      };

      const { validate: validateUuid } = require('uuid');
      validateUuid.mockReturnValue(true);
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logAction({
        userId: mockUserId,
        operation: 'test-operation',
        entityName: 'test-entity',
        actionPerformed: 'test-action',
        outcome: 'success',
      });

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          user_id: mockUserId,
          operation: 'test-operation',
          entity_name: 'test-entity',
          action_performed: 'test-action',
          outcome: 'success',
          performed_at: expect.any(Date),
        },
      });
      expect(result).toEqual(mockAuditLog);
    });

    it('should generate new UUID for invalid userId', async () => {
      const mockGeneratedUuid = 'generated-uuid-456';
      const mockAuditLog = {
        audit_log_id: 'audit-id-123',
        user_id: mockGeneratedUuid,
        operation: 'test-operation',
        entity_name: 'test-entity',
        action_performed: 'test-action',
        outcome: 'success',
        performed_at: new Date(),
      };

      const { validate: validateUuid, v4: uuidv4Mock } = require('uuid');
      validateUuid.mockReturnValue(false);
      uuidv4Mock.mockReturnValue(mockGeneratedUuid);
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logAction({
        userId: 'invalid-user-id',
        operation: 'test-operation',
        entityName: 'test-entity',
        actionPerformed: 'test-action',
        outcome: 'success',
      });

      expect(uuidv4Mock).toHaveBeenCalled();
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          user_id: mockGeneratedUuid,
          operation: 'test-operation',
          entity_name: 'test-entity',
          action_performed: 'test-action',
          outcome: 'success',
          performed_at: expect.any(Date),
        },
      });
      expect(result).toEqual(mockAuditLog);
    });

    it('should generate new UUID when userId is undefined', async () => {
      const mockGeneratedUuid = 'generated-uuid-789';
      const mockAuditLog = {
        audit_log_id: 'audit-id-123',
        user_id: mockGeneratedUuid,
        operation: 'test-operation',
        entity_name: 'test-entity',
        action_performed: 'test-action',
        outcome: 'success',
        performed_at: new Date(),
      };

      const { v4: uuidv4Mock } = require('uuid');
      uuidv4Mock.mockReturnValue(mockGeneratedUuid);
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logAction({
        operation: 'test-operation',
        entityName: 'test-entity',
        actionPerformed: 'test-action',
        outcome: 'success',
      });

      expect(uuidv4Mock).toHaveBeenCalled();
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          user_id: mockGeneratedUuid,
          operation: 'test-operation',
          entity_name: 'test-entity',
          action_performed: 'test-action',
          outcome: 'success',
          performed_at: expect.any(Date),
        },
      });
      expect(result).toEqual(mockAuditLog);
    });

    it('should use provided performedAt date', async () => {
      const mockUserId = 'valid-uuid-123';
      const customDate = new Date('2023-01-01T10:00:00Z');
      const mockAuditLog = {
        audit_log_id: 'audit-id-123',
        user_id: mockUserId,
        operation: 'test-operation',
        entity_name: 'test-entity',
        action_performed: 'test-action',
        outcome: 'success',
        performed_at: customDate,
      };

      const { validate: validateUuid } = require('uuid');
      validateUuid.mockReturnValue(true);
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.logAction({
        userId: mockUserId,
        operation: 'test-operation',
        entityName: 'test-entity',
        actionPerformed: 'test-action',
        outcome: 'success',
        performedAt: customDate,
      });

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          user_id: mockUserId,
          operation: 'test-operation',
          entity_name: 'test-entity',
          action_performed: 'test-action',
          outcome: 'success',
          performed_at: customDate,
        },
      });
    });

    it('should handle errors when creating audit log', async () => {
      prismaService.auditLog.create.mockRejectedValue(new Error('DB error'));
      await expect(service.logAction({
        userId: 'valid-uuid-123',
        operation: 'test-operation',
        entityName: 'test-entity',
        actionPerformed: 'test-action',
        outcome: 'success',
      })).rejects.toThrow('DB error');
    });
  });

  describe('logPermissionDenied', () => {
    it('should log permission denied with user sub', async () => {
      const mockUser = { sub: 'user-123' };
      const mockAuditLog = {
        audit_log_id: 'audit-id-123',
        user_id: 'user-123',
        operation: 'permission_denied',
        entity_name: 'test-entity',
        action_performed: 'test-action',
        outcome: 'denied',
        performed_at: new Date(),
      };

      const { validate: validateUuid } = require('uuid');
      validateUuid.mockReturnValue(true);
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logPermissionDenied(mockUser, 'test-entity', 'test-action');

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          user_id: 'user-123',
          operation: 'permission_denied',
          entity_name: 'test-entity',
          action_performed: 'test-action',
          outcome: 'denied',
          performed_at: expect.any(Date),
        },
      });
      expect(result).toEqual(mockAuditLog);
    });

    it('should log permission denied with unknown user', async () => {
      const mockGeneratedUuid = 'generated-uuid-unknown';
      const mockAuditLog = {
        audit_log_id: 'audit-id-123',
        user_id: mockGeneratedUuid,
        operation: 'permission_denied',
        entity_name: 'test-entity',
        action_performed: 'test-action',
        outcome: 'denied',
        performed_at: new Date(),
      };

      const { validate: validateUuid, v4: uuidv4Mock } = require('uuid');
      validateUuid.mockReturnValue(false);
      uuidv4Mock.mockReturnValue(mockGeneratedUuid);
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logPermissionDenied(null, 'test-entity', 'test-action');

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          user_id: mockGeneratedUuid,
          operation: 'permission_denied',
          entity_name: 'test-entity',
          action_performed: 'test-action',
          outcome: 'denied',
          performed_at: expect.any(Date),
        },
      });
      expect(result).toEqual(mockAuditLog);
    });
  });

  describe('getLogs', () => {
    it('should get logs with default parameters', async () => {
      const mockLogs = [
        {
          audit_log_id: 'log-1',
          user_id: 'user-1',
          operation: 'test-op-1',
          entity_name: 'entity-1',
          action_performed: 'action-1',
          outcome: 'success',
          performed_at: new Date(),
        },
        {
          audit_log_id: 'log-2',
          user_id: 'user-2',
          operation: 'test-op-2',
          entity_name: 'entity-2',
          action_performed: 'action-2',
          outcome: 'failure',
          performed_at: new Date(),
        },
      ];

      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getLogs();

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: 50,
        skip: 0,
      });
      expect(result).toEqual(mockLogs);
    });

    it('should get logs with custom limit and offset', async () => {
      const mockLogs = [
        {
          audit_log_id: 'log-1',
          user_id: 'user-1',
          operation: 'test-op-1',
          entity_name: 'entity-1',
          action_performed: 'action-1',
          outcome: 'success',
          performed_at: new Date(),
        },
      ];

      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getLogs(10, 20);

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: 10,
        skip: 20,
      });
      expect(result).toEqual(mockLogs);
    });
  });

  describe('getActionHistoryForAlert', () => {
    it('should get action history for a given alert ID', async () => {
      const alertId = 'alert-123';
      const mockLogs = [
        {
          audit_log_id: 'log-1',
          user_id: 'user-1',
          operation: 'update',
          entity_name: 'Alert',
          action_performed: `Updated alert ${alertId}`,
          outcome: 'success',
          performed_at: new Date(),
        },
        {
          audit_log_id: 'log-2',
          user_id: 'user-2',
          operation: 'create',
          entity_name: 'Case',
          action_performed: `Created case for alert ${alertId}`,
          outcome: 'success',
          performed_at: new Date(),
        },
      ];

      prismaService.auditLog.findMany.mockResolvedValue(mockLogs);

      const result = await service.getActionHistoryForAlert(alertId);

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { action_performed: { contains: alertId } },
            { action_performed: { contains: `alert ${alertId}` } },
            { action_performed: { contains: `Alert ${alertId}` } },
          ],
          entity_name: { in: ['Alert', 'Case'] },
        },
        orderBy: { performed_at: 'asc' },
      });
      expect(result).toEqual(mockLogs);
    });
  });
});
