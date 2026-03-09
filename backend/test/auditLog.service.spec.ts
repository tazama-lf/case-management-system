import { Test, TestingModule } from '@nestjs/testing';
import { AuditLogService } from '../src/modules/audit/auditLog.service';
import { PrismaService } from '../prisma/prisma.service';
import { validate as isUuid } from 'uuid';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let prismaService: any;

  const mockAuditLog = {
    id: 1,
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    operation: 'CREATE',
    entity_name: 'Case',
    action_performed: 'Created case 123',
    outcome: 'success',
    performed_at: new Date('2026-02-20T10:00:00Z'),
  };

  const mockAuditLogs = [
    {
      id: 1,
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      operation: 'CREATE',
      entity_name: 'Case',
      action_performed: 'Created case 123',
      outcome: 'success',
      performed_at: new Date('2026-02-20T10:00:00Z'),
    },
    {
      id: 2,
      user_id: '660e8400-e29b-41d4-a716-446655440001',
      operation: 'UPDATE',
      entity_name: 'Alert',
      action_performed: 'Updated alert 456',
      outcome: 'success',
      performed_at: new Date('2026-02-20T11:00:00Z'),
    },
  ];

  // Helper function to create mock PrismaService
  const createMockPrismaService = () => ({
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  });

  beforeEach(async () => {
    const mockPrismaService = createMockPrismaService();

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
    prismaService = module.get(PrismaService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logAction', () => {
    const actionData = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      operation: 'CREATE',
      entityName: 'Case',
      actionPerformed: 'Created case 123',
      outcome: 'success',
    };

    it('should successfully log an action with valid userId', async () => {
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logAction(actionData);

      expect(result).toEqual(mockAuditLog);
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          user_id: actionData.userId,
          operation: actionData.operation,
          entity_name: actionData.entityName,
          action_performed: actionData.actionPerformed,
          outcome: actionData.outcome,
          performed_at: expect.any(Date),
        },
      });
    });

    it('should use provided userId when it is a valid UUID', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.logAction({
        ...actionData,
        userId: validUUID,
      });

      const callData = prismaService.auditLog.create.mock.calls[0][0].data;
      expect(callData.user_id).toBe(validUUID);
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it.each([
      ['not provided', undefined],
      ['invalid', 'invalid-uuid'],
      ['empty string', ''],
    ])('should generate UUID when userId is %s', async (_desc, userId) => {
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.logAction({
        ...actionData,
        userId,
      });

      const callData = prismaService.auditLog.create.mock.calls[0][0].data;
      expect(isUuid(callData.user_id)).toBe(true);
      if (userId !== undefined) {
        expect(callData.user_id).not.toBe(userId);
      }
    });

    it('should use provided performedAt date', async () => {
      const customDate = new Date('2026-01-01T00:00:00Z');
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.logAction({
        ...actionData,
        performedAt: customDate,
      });

      const callData = prismaService.auditLog.create.mock.calls[0][0].data;
      expect(callData.performed_at).toBe(customDate);
    });

    it('should use current date when performedAt is not provided', async () => {
      const beforeCall = new Date();
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.logAction(actionData);

      const afterCall = new Date();
      const callData = prismaService.auditLog.create.mock.calls[0][0].data;

      expect(callData.performed_at).toBeInstanceOf(Date);
      expect(callData.performed_at.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(callData.performed_at.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it.each([['CREATE'], ['UPDATE'], ['DELETE'], ['VIEW'], ['APPROVE']])('should log operation %s correctly', async (operation) => {
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.logAction({
        ...actionData,
        operation,
      });

      const callData = prismaService.auditLog.create.mock.calls[0][0].data;
      expect(callData.operation).toBe(operation);
    });

    it.each([['success'], ['failure'], ['denied'], ['error']])('should log outcome %s correctly', async (outcome) => {
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.logAction({
        ...actionData,
        outcome,
      });

      const callData = prismaService.auditLog.create.mock.calls[0][0].data;
      expect(callData.outcome).toBe(outcome);
    });

    it.each([['Case'], ['Alert'], ['Task'], ['Comment'], ['Evidence']])('should handle entity name %s', async (entityName) => {
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.logAction({
        ...actionData,
        entityName,
      });

      const callData = prismaService.auditLog.create.mock.calls[0][0].data;
      expect(callData.entity_name).toBe(entityName);
    });

    it('should handle long action descriptions', async () => {
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const longAction = 'A'.repeat(1000);
      await service.logAction({
        ...actionData,
        actionPerformed: longAction,
      });

      const callData = prismaService.auditLog.create.mock.calls[0][0].data;
      expect(callData.action_performed).toBe(longAction);
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Database error');
      prismaService.auditLog.create.mockRejectedValue(error);

      await expect(service.logAction(actionData)).rejects.toThrow('Database error');
    });
  });

  describe('logPermissionDenied', () => {
    it('should log permission denied with user sub', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const result = await service.logPermissionDenied(user, 'Case', 'DELETE');

      expect(result).toEqual(mockAuditLog);
      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: {
          user_id: user.sub,
          operation: 'permission_denied',
          entity_name: 'Case',
          action_performed: 'DELETE',
          outcome: 'denied',
          performed_at: expect.any(Date),
        },
      });
    });

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['without sub', { id: 'test' }],
    ])('should generate UUID when user is %s', async (_desc, user) => {
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.logPermissionDenied(user, 'Alert', 'UPDATE');

      const callData = prismaService.auditLog.create.mock.calls[0][0].data;
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should handle different entity names', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.logPermissionDenied(user, 'CustomEntity', 'APPROVE');

      const callData = prismaService.auditLog.create.mock.calls[0][0].data;
      expect(callData.entity_name).toBe('CustomEntity');
    });

    it('should handle different actions', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.logPermissionDenied(user, 'Case', 'ADMIN_ACCESS');

      const callData = prismaService.auditLog.create.mock.calls[0][0].data;
      expect(callData.action_performed).toBe('ADMIN_ACCESS');
    });

    it('should always set operation to permission_denied', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.logPermissionDenied(user, 'Case', 'DELETE');

      const callData = prismaService.auditLog.create.mock.calls[0][0].data;
      expect(callData.operation).toBe('permission_denied');
    });

    it('should always set outcome to denied', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      await service.logPermissionDenied(user, 'Alert', 'UPDATE');

      const callData = prismaService.auditLog.create.mock.calls[0][0].data;
      expect(callData.outcome).toBe('denied');
    });

    it('should ignore details parameter', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);

      const details = { reason: 'Insufficient permissions', level: 'admin' };
      await service.logPermissionDenied(user, 'Case', 'DELETE', details);

      expect(prismaService.auditLog.create).toHaveBeenCalledTimes(1);
    });

    it('should handle database error and throw', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      const error = new Error('Database connection failed');
      prismaService.auditLog.create.mockRejectedValue(error);

      await expect(service.logPermissionDenied(user, 'Case', 'DELETE')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getLogs', () => {
    it('should retrieve logs with default pagination', async () => {
      prismaService.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      const result = await service.getLogs();

      expect(result).toEqual(mockAuditLogs);
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it.each([
      ['custom limit', 10, undefined, 10, 0],
      ['custom offset', undefined, 100, 50, 100],
      ['both custom', 25, 75, 25, 75],
    ])('should retrieve logs with %s', async (_desc, limit, offset, expectedTake, expectedSkip) => {
      prismaService.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      const result = await service.getLogs(limit, offset);

      expect(result).toEqual(mockAuditLogs);
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: expectedTake,
        skip: expectedSkip,
      });
    });

    it('should return empty array when no logs found', async () => {
      prismaService.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getLogs();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should order logs by performed_at in descending order', async () => {
      prismaService.auditLog.findMany.mockResolvedValue(mockAuditLogs);

      await service.getLogs();

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { performed_at: 'desc' },
        }),
      );
    });

    it.each([
      ['limit of 1', 1, 0],
      ['large limit', 1000, 0],
      ['large offset', 50, 10000],
      ['zero limit', 0, 0],
    ])('should handle %s', async (_desc, limit, offset) => {
      prismaService.auditLog.findMany.mockResolvedValue(limit === 1 ? [mockAuditLogs[0]] : []);

      await service.getLogs(limit, offset);

      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: limit,
        skip: offset,
      });
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Query failed');
      prismaService.auditLog.findMany.mockRejectedValue(error);

      await expect(service.getLogs()).rejects.toThrow('Query failed');
    });
  });

  describe('getActionHistoryForAlert', () => {
    const alertId = 123;
    const mockAlertHistory = [
      {
        id: 1,
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        operation: 'ALERT_UPDATED',
        entity_name: 'AlertService',
        action_performed: 'Updated alert 123',
        outcome: 'success',
        performed_at: new Date('2026-02-20T10:00:00Z'),
      },
      {
        id: 2,
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        operation: 'ALERT_UPDATED',
        entity_name: 'AlertService',
        action_performed: 'Alert 123 priority changed',
        outcome: 'success',
        performed_at: new Date('2026-02-20T11:00:00Z'),
      },
    ];

    it('should retrieve action history for an alert', async () => {
      prismaService.auditLog.findMany.mockResolvedValue(mockAlertHistory);

      const result = await service.getActionHistoryForAlert(alertId);

      expect(result).toEqual(mockAlertHistory);
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          operation: 'ALERT_UPDATED',
          action_performed: { contains: '123' },
          entity_name: 'AlertService',
        },
        orderBy: { performed_at: 'asc' },
      });
    });

    it.each([[1], [100], [999], [12345], [0]])('should handle alert ID %i', async (id) => {
      prismaService.auditLog.findMany.mockResolvedValue(mockAlertHistory);

      await service.getActionHistoryForAlert(id);

      const callArgs = prismaService.auditLog.findMany.mock.calls[0][0];
      expect(callArgs.where.action_performed).toEqual({ contains: `${id}` });
      expect(callArgs.where.operation).toBe('ALERT_UPDATED');
      expect(callArgs.where.entity_name).toBe('AlertService');
      expect(callArgs.orderBy).toEqual({ performed_at: 'asc' });
    });

    it('should return empty array when no history found', async () => {
      prismaService.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getActionHistoryForAlert(999);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Database query failed');
      prismaService.auditLog.findMany.mockRejectedValue(error);

      await expect(service.getActionHistoryForAlert(alertId)).rejects.toThrow('Database query failed');
    });
  });

  describe('getActionHistoryForCase', () => {
    const caseId = 456;
    const mockCaseHistory = [
      {
        id: 1,
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        operation: 'CASE_CREATED',
        entity_name: 'Case',
        action_performed: 'Created case 456',
        outcome: 'success',
        performed_at: new Date('2026-02-20T10:00:00Z'),
      },
      {
        id: 2,
        user_id: '550e8400-e29b-41d4-a716-446655440000',
        operation: 'CASE_UPDATED',
        entity_name: 'Case',
        action_performed: 'Updated Case 456',
        outcome: 'success',
        performed_at: new Date('2026-02-20T11:00:00Z'),
      },
    ];

    it('should retrieve action history for a case', async () => {
      prismaService.auditLog.findMany.mockResolvedValue(mockCaseHistory);

      const result = await service.getActionHistoryForCase(caseId);

      expect(result).toEqual(mockCaseHistory);
      expect(prismaService.auditLog.findMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { action_performed: { contains: '456' } },
            { action_performed: { contains: 'case 456' } },
            { action_performed: { contains: 'Case 456' } },
          ],
          entity_name: { in: ['Alert', 'Case'] },
        },
        orderBy: { performed_at: 'asc' },
      });
    });

    it.each([[1], [100], [789], [12345], [0]])('should search for case ID %i in multiple formats', async (id) => {
      prismaService.auditLog.findMany.mockResolvedValue(mockCaseHistory);

      await service.getActionHistoryForCase(id);

      const callArgs = prismaService.auditLog.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toEqual([
        { action_performed: { contains: id.toString() } },
        { action_performed: { contains: `case ${id}` } },
        { action_performed: { contains: `Case ${id}` } },
      ]);
      expect(callArgs.where.entity_name).toEqual({ in: ['Alert', 'Case'] });
      expect(callArgs.orderBy).toEqual({ performed_at: 'asc' });
    });

    it('should return empty array when no history found', async () => {
      prismaService.auditLog.findMany.mockResolvedValue([]);

      const result = await service.getActionHistoryForCase(999);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Connection timeout');
      prismaService.auditLog.findMany.mockRejectedValue(error);

      await expect(service.getActionHistoryForCase(caseId)).rejects.toThrow('Connection timeout');
    });

    it.each([
      ['lowercase', { ...mockCaseHistory[0], action_performed: 'Updated case 456' }],
      ['uppercase', { ...mockCaseHistory[0], action_performed: 'Updated Case 456' }],
    ])('should find logs with %s case prefix', async (_desc, log) => {
      prismaService.auditLog.findMany.mockResolvedValue([log]);

      const result = await service.getActionHistoryForCase(caseId);

      expect(result).toEqual([log]);
    });

    it('should find logs from both Alert and Case entities', async () => {
      const mixedLogs = [
        { ...mockCaseHistory[0], entity_name: 'Alert' },
        { ...mockCaseHistory[1], entity_name: 'Case' },
      ];
      prismaService.auditLog.findMany.mockResolvedValue(mixedLogs);

      const result = await service.getActionHistoryForCase(caseId);

      expect(result).toHaveLength(2);
      expect(result[0].entity_name).toBe('Alert');
      expect(result[1].entity_name).toBe('Case');
    });
  });

  describe('Integration scenarios', () => {
    it('should log action and then retrieve it', async () => {
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);
      prismaService.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      await service.logAction({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        operation: 'CREATE',
        entityName: 'Case',
        actionPerformed: 'Created case 123',
        outcome: 'success',
      });

      const logs = await service.getLogs();

      expect(logs).toContainEqual(mockAuditLog);
    });

    it('should log permission denied and retrieve it', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.auditLog.create.mockResolvedValue(mockAuditLog);
      prismaService.auditLog.findMany.mockResolvedValue([mockAuditLog]);

      await service.logPermissionDenied(user, 'Case', 'DELETE');

      const logs = await service.getLogs();

      expect(prismaService.auditLog.create).toHaveBeenCalled();
      expect(prismaService.auditLog.findMany).toHaveBeenCalled();
    });
  });
});
