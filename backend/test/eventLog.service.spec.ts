import { Test, TestingModule } from '@nestjs/testing';
import { EventLogService } from '../src/modules/event_log/eventLog.service';
import { PrismaService } from '../prisma/prisma.service';
import { validate as isUuid } from 'uuid';

describe('EventLogService', () => {
  let service: EventLogService;
  let prismaService: any;

  const mockEventLog = {
    id: 1,
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    operation: 'CREATE',
    entity_name: 'Case',
    action_performed: 'Created case 123',
    outcome: 'success',
    performed_at: new Date('2026-02-20T10:00:00Z'),
  };

  const mockEventLogs = [
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

  beforeEach(async () => {
    const mockPrismaService = {
      eventLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventLogService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<EventLogService>(EventLogService);
    prismaService = module.get(PrismaService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logEventAction', () => {
    const actionData = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      operation: 'CREATE',
      entityName: 'Case',
      actionPerformed: 'Created case 123',
      outcome: 'success',
    };

    it('should successfully log an event action with valid userId', async () => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      const result = await service.logEventAction(actionData);

      expect(result).toEqual(mockEventLog);
      expect(prismaService.eventLog.create).toHaveBeenCalledWith({
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
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      await service.logEventAction({
        ...actionData,
        userId: validUUID,
      });

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.user_id).toBe(validUUID);
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should generate UUID when userId is not provided', async () => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      const dataWithoutUserId = {
        operation: 'CREATE',
        entityName: 'Case',
        actionPerformed: 'Created case 123',
        outcome: 'success',
      };

      await service.logEventAction(dataWithoutUserId);

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should generate UUID when userId is invalid', async () => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      await service.logEventAction({
        ...actionData,
        userId: 'invalid-uuid',
      });

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.user_id).not.toBe('invalid-uuid');
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should generate UUID when userId is empty string', async () => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      await service.logEventAction({
        ...actionData,
        userId: '',
      });

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.user_id).not.toBe('');
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should use provided performedAt date', async () => {
      const customDate = new Date('2026-01-01T00:00:00Z');
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      await service.logEventAction({
        ...actionData,
        performedAt: customDate,
      });

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.performed_at).toBe(customDate);
    });

    it('should use current date when performedAt is not provided', async () => {
      const beforeCall = new Date();
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      await service.logEventAction(actionData);

      const afterCall = new Date();
      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      
      expect(callData.performed_at).toBeInstanceOf(Date);
      expect(callData.performed_at.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(callData.performed_at.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('should log different operations correctly', async () => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      const operations = ['CREATE', 'UPDATE', 'DELETE', 'VIEW', 'APPROVE'];
      
      for (const operation of operations) {
        await service.logEventAction({
          ...actionData,
          operation,
        });

        const callData = prismaService.eventLog.create.mock.calls[prismaService.eventLog.create.mock.calls.length - 1][0].data;
        expect(callData.operation).toBe(operation);
      }
    });

    it('should log different outcomes correctly', async () => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      const outcomes = ['success', 'failure', 'denied', 'error'];
      
      for (const outcome of outcomes) {
        await service.logEventAction({
          ...actionData,
          outcome,
        });

        const callData = prismaService.eventLog.create.mock.calls[prismaService.eventLog.create.mock.calls.length - 1][0].data;
        expect(callData.outcome).toBe(outcome);
      }
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Database error');
      prismaService.eventLog.create.mockRejectedValue(error);

      await expect(service.logEventAction(actionData)).rejects.toThrow('Database error');
    });

    it('should handle different entity names', async () => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      const entityNames = ['Case', 'Alert', 'Task', 'Comment', 'Evidence'];
      
      for (const entityName of entityNames) {
        await service.logEventAction({
          ...actionData,
          entityName,
        });

        const callData = prismaService.eventLog.create.mock.calls[prismaService.eventLog.create.mock.calls.length - 1][0].data;
        expect(callData.entity_name).toBe(entityName);
      }
    });

    it('should handle long action descriptions', async () => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      const longAction = 'A'.repeat(1000);
      await service.logEventAction({
        ...actionData,
        actionPerformed: longAction,
      });

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.action_performed).toBe(longAction);
    });
  });

  describe('logPermissionDenied', () => {
    it('should log permission denied with user sub', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      const result = await service.logPermissionDenied(user, 'Case', 'DELETE');

      expect(result).toEqual(mockEventLog);
      expect(prismaService.eventLog.create).toHaveBeenCalledWith({
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

    it('should use "unknown" when user is null', async () => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      await service.logPermissionDenied(null, 'Alert', 'UPDATE');

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.user_id).not.toBe('unknown');
      // Since 'unknown' is not a valid UUID, it should generate a new UUID
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should use "unknown" when user is undefined', async () => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      await service.logPermissionDenied(undefined, 'Task', 'CREATE');

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should use "unknown" when user.sub is not present', async () => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      await service.logPermissionDenied({ id: 'test' }, 'Evidence', 'VIEW');

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should handle different entity names', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      await service.logPermissionDenied(user, 'CustomEntity', 'APPROVE');

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.entity_name).toBe('CustomEntity');
    });

    it('should handle different actions', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      await service.logPermissionDenied(user, 'Case', 'ADMIN_ACCESS');

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.action_performed).toBe('ADMIN_ACCESS');
    });

    it('should always set operation to permission_denied', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      await service.logPermissionDenied(user, 'Case', 'DELETE');

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.operation).toBe('permission_denied');
    });

    it('should always set outcome to denied', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      await service.logPermissionDenied(user, 'Alert', 'UPDATE');

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.outcome).toBe('denied');
    });

    it('should ignore details parameter', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);

      const details = { reason: 'Insufficient permissions', level: 'admin' };
      await service.logPermissionDenied(user, 'Case', 'DELETE', details);

      expect(prismaService.eventLog.create).toHaveBeenCalledTimes(1);
    });

    it('should handle database error and throw', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      const error = new Error('Database connection failed');
      prismaService.eventLog.create.mockRejectedValue(error);

      await expect(service.logPermissionDenied(user, 'Case', 'DELETE')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getLogs', () => {
    it('should retrieve logs with default pagination', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockEventLogs);

      const result = await service.getLogs();

      expect(result).toEqual(mockEventLogs);
      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should retrieve logs with custom limit', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockEventLogs);

      const result = await service.getLogs(10);

      expect(result).toEqual(mockEventLogs);
      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: 10,
        skip: 0,
      });
    });

    it('should retrieve logs with custom offset', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockEventLogs);

      const result = await service.getLogs(50, 100);

      expect(result).toEqual(mockEventLogs);
      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: 50,
        skip: 100,
      });
    });

    it('should retrieve logs with both custom limit and offset', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockEventLogs);

      const result = await service.getLogs(25, 75);

      expect(result).toEqual(mockEventLogs);
      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: 25,
        skip: 75,
      });
    });

    it('should return empty array when no logs found', async () => {
      prismaService.eventLog.findMany.mockResolvedValue([]);

      const result = await service.getLogs();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should order logs by performed_at in descending order', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockEventLogs);

      await service.getLogs();

      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { performed_at: 'desc' },
        }),
      );
    });

    it('should handle limit of 1', async () => {
      prismaService.eventLog.findMany.mockResolvedValue([mockEventLogs[0]]);

      const result = await service.getLogs(1);

      expect(result).toHaveLength(1);
      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: 1,
        skip: 0,
      });
    });

    it('should handle large limit values', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockEventLogs);

      await service.getLogs(1000);

      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: 1000,
        skip: 0,
      });
    });

    it('should handle large offset values', async () => {
      prismaService.eventLog.findMany.mockResolvedValue([]);

      await service.getLogs(50, 10000);

      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: 50,
        skip: 10000,
      });
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Query failed');
      prismaService.eventLog.findMany.mockRejectedValue(error);

      await expect(service.getLogs()).rejects.toThrow('Query failed');
    });

    it('should handle zero limit', async () => {
      prismaService.eventLog.findMany.mockResolvedValue([]);

      await service.getLogs(0);

      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: 0,
        skip: 0,
      });
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
      prismaService.eventLog.findMany.mockResolvedValue(mockAlertHistory);

      const result = await service.getActionHistoryForAlert(alertId);

      expect(result).toEqual(mockAlertHistory);
      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith({
        where: {
          operation: 'ALERT_UPDATED',
          action_performed: { contains: '123' },
          entity_name: 'AlertService',
        },
        orderBy: { performed_at: 'asc' },
      });
    });

    it('should filter by operation ALERT_UPDATED', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockAlertHistory);

      await service.getActionHistoryForAlert(alertId);

      const callArgs = prismaService.eventLog.findMany.mock.calls[0][0];
      expect(callArgs.where.operation).toBe('ALERT_UPDATED');
    });

    it('should filter by entity_name AlertService', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockAlertHistory);

      await service.getActionHistoryForAlert(alertId);

      const callArgs = prismaService.eventLog.findMany.mock.calls[0][0];
      expect(callArgs.where.entity_name).toBe('AlertService');
    });

    it('should filter by action_performed containing alertId', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockAlertHistory);

      await service.getActionHistoryForAlert(456);

      const callArgs = prismaService.eventLog.findMany.mock.calls[0][0];
      expect(callArgs.where.action_performed).toEqual({ contains: '456' });
    });

    it('should order results by performed_at in ascending order', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockAlertHistory);

      await service.getActionHistoryForAlert(alertId);

      const callArgs = prismaService.eventLog.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ performed_at: 'asc' });
    });

    it('should return empty array when no history found', async () => {
      prismaService.eventLog.findMany.mockResolvedValue([]);

      const result = await service.getActionHistoryForAlert(999);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle different alert IDs', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockAlertHistory);

      const alertIds = [1, 100, 999, 12345];
      
      for (const id of alertIds) {
        await service.getActionHistoryForAlert(id);
        
        const callArgs = prismaService.eventLog.findMany.mock.calls[prismaService.eventLog.findMany.mock.calls.length - 1][0];
        expect(callArgs.where.action_performed).toEqual({ contains: `${id}` });
      }
    });

    it('should handle alert ID 0', async () => {
      prismaService.eventLog.findMany.mockResolvedValue([]);

      await service.getActionHistoryForAlert(0);

      const callArgs = prismaService.eventLog.findMany.mock.calls[0][0];
      expect(callArgs.where.action_performed).toEqual({ contains: '0' });
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Database query failed');
      prismaService.eventLog.findMany.mockRejectedValue(error);

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
      prismaService.eventLog.findMany.mockResolvedValue(mockCaseHistory);

      const result = await service.getActionHistoryForCase(caseId);

      expect(result).toEqual(mockCaseHistory);
      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith({
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

    it('should search for case ID in multiple formats', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockCaseHistory);

      await service.getActionHistoryForCase(789);

      const callArgs = prismaService.eventLog.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toEqual([
        { action_performed: { contains: '789' } },
        { action_performed: { contains: 'case 789' } },
        { action_performed: { contains: 'Case 789' } },
      ]);
    });

    it('should filter by entity_name in Alert or Case', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockCaseHistory);

      await service.getActionHistoryForCase(caseId);

      const callArgs = prismaService.eventLog.findMany.mock.calls[0][0];
      expect(callArgs.where.entity_name).toEqual({ in: ['Alert', 'Case'] });
    });

    it('should order results by performed_at in ascending order', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockCaseHistory);

      await service.getActionHistoryForCase(caseId);

      const callArgs = prismaService.eventLog.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toEqual({ performed_at: 'asc' });
    });

    it('should return empty array when no history found', async () => {
      prismaService.eventLog.findMany.mockResolvedValue([]);

      const result = await service.getActionHistoryForCase(999);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle different case IDs', async () => {
      prismaService.eventLog.findMany.mockResolvedValue(mockCaseHistory);

      const caseIds = [1, 100, 999, 12345];
      
      for (const id of caseIds) {
        await service.getActionHistoryForCase(id);
        
        const callArgs = prismaService.eventLog.findMany.mock.calls[prismaService.eventLog.findMany.mock.calls.length - 1][0];
        expect(callArgs.where.OR).toContainEqual({ action_performed: { contains: id.toString() } });
        expect(callArgs.where.OR).toContainEqual({ action_performed: { contains: `case ${id}` } });
        expect(callArgs.where.OR).toContainEqual({ action_performed: { contains: `Case ${id}` } });
      }
    });

    it('should handle case ID 0', async () => {
      prismaService.eventLog.findMany.mockResolvedValue([]);

      await service.getActionHistoryForCase(0);

      const callArgs = prismaService.eventLog.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toContainEqual({ action_performed: { contains: '0' } });
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Connection timeout');
      prismaService.eventLog.findMany.mockRejectedValue(error);

      await expect(service.getActionHistoryForCase(caseId)).rejects.toThrow('Connection timeout');
    });

    it('should find logs with lowercase case prefix', async () => {
      const logsWithLowercase = [{
        ...mockCaseHistory[0],
        action_performed: 'Updated case 456',
      }];
      prismaService.eventLog.findMany.mockResolvedValue(logsWithLowercase);

      const result = await service.getActionHistoryForCase(caseId);

      expect(result).toEqual(logsWithLowercase);
    });

    it('should find logs with uppercase Case prefix', async () => {
      const logsWithUppercase = [{
        ...mockCaseHistory[0],
        action_performed: 'Updated Case 456',
      }];
      prismaService.eventLog.findMany.mockResolvedValue(logsWithUppercase);

      const result = await service.getActionHistoryForCase(caseId);

      expect(result).toEqual(logsWithUppercase);
    });

    it('should find logs from both Alert and Case entities', async () => {
      const mixedLogs = [
        { ...mockCaseHistory[0], entity_name: 'Alert' },
        { ...mockCaseHistory[1], entity_name: 'Case' },
      ];
      prismaService.eventLog.findMany.mockResolvedValue(mixedLogs);

      const result = await service.getActionHistoryForCase(caseId);

      expect(result).toHaveLength(2);
      expect(result[0].entity_name).toBe('Alert');
      expect(result[1].entity_name).toBe('Case');
    });
  });

  describe('Integration scenarios', () => {
    it('should log action and then retrieve it', async () => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);
      prismaService.eventLog.findMany.mockResolvedValue([mockEventLog]);

      await service.logEventAction({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        operation: 'CREATE',
        entityName: 'Case',
        actionPerformed: 'Created case 123',
        outcome: 'success',
      });

      const logs = await service.getLogs();

      expect(logs).toContainEqual(mockEventLog);
    });

    it('should log permission denied and retrieve it', async () => {
      const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);
      prismaService.eventLog.findMany.mockResolvedValue([mockEventLog]);

      await service.logPermissionDenied(user, 'Case', 'DELETE');

      const logs = await service.getLogs();

      expect(prismaService.eventLog.create).toHaveBeenCalled();
      expect(prismaService.eventLog.findMany).toHaveBeenCalled();
    });
  });
});
