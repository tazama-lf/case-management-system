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
    mockEventLog,
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
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventLogService,
        {
          provide: PrismaService,
          useValue: {
            eventLog: {
              create: jest.fn(),
              findMany: jest.fn(),
              findFirst: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<EventLogService>(EventLogService);
    prismaService = module.get(PrismaService);
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

    beforeEach(() => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);
    });

    it('should successfully log an event action with valid userId', async () => {
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

    it.each([
      ['not provided', undefined],
      ['invalid UUID', 'invalid-uuid'],
      ['empty string', ''],
    ])('should generate UUID when userId is %s', async (_description, userId) => {
      await service.logEventAction({ ...actionData, userId });

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(isUuid(callData.user_id)).toBe(true);
      if (userId) {
        expect(callData.user_id).not.toBe(userId);
      }
    });

    it('should use provided performedAt date', async () => {
      const customDate = new Date('2026-01-01T00:00:00Z');

      await service.logEventAction({ ...actionData, performedAt: customDate });

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.performed_at).toBe(customDate);
    });

    it('should use current date when performedAt is not provided', async () => {
      const beforeCall = new Date();
      await service.logEventAction(actionData);
      const afterCall = new Date();

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.performed_at).toBeInstanceOf(Date);
      expect(callData.performed_at.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(callData.performed_at.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it.each([['CREATE'], ['UPDATE'], ['DELETE'], ['VIEW'], ['APPROVE']])('should log %s operation correctly', async (operation) => {
      await service.logEventAction({ ...actionData, operation });

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.operation).toBe(operation);
    });

    it.each([['success'], ['failure'], ['denied'], ['error']])('should log %s outcome correctly', async (outcome) => {
      await service.logEventAction({ ...actionData, outcome });

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.outcome).toBe(outcome);
    });

    it.each([['Case'], ['Alert'], ['Task'], ['Comment'], ['Evidence']])('should handle %s entity name', async (entityName) => {
      await service.logEventAction({ ...actionData, entityName });

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.entity_name).toBe(entityName);
    });

    it('should handle long action descriptions', async () => {
      const longAction = 'A'.repeat(1000);

      await service.logEventAction({ ...actionData, actionPerformed: longAction });

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.action_performed).toBe(longAction);
    });

    it('should handle database error and throw', async () => {
      prismaService.eventLog.create.mockRejectedValue(new Error('Database error'));

      await expect(service.logEventAction(actionData)).rejects.toThrow('Database error');
    });
  });

  describe('logPermissionDenied', () => {
    const user = { sub: '550e8400-e29b-41d4-a716-446655440000' };

    beforeEach(() => {
      prismaService.eventLog.create.mockResolvedValue(mockEventLog);
    });

    it('should log permission denied with user sub', async () => {
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

    it.each([
      ['null', null],
      ['undefined', undefined],
      ['missing sub', { id: 'test' }],
    ])('should generate UUID when user is %s', async (_description, userValue) => {
      await service.logPermissionDenied(userValue, 'Alert', 'UPDATE');

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it.each([
      ['CustomEntity', 'APPROVE'],
      ['Case', 'ADMIN_ACCESS'],
      ['Task', 'CREATE'],
    ])('should handle entity %s with action %s', async (entityName, action) => {
      await service.logPermissionDenied(user, entityName, action);

      const callData = prismaService.eventLog.create.mock.calls[0][0].data;
      expect(callData.entity_name).toBe(entityName);
      expect(callData.action_performed).toBe(action);
      expect(callData.operation).toBe('permission_denied');
      expect(callData.outcome).toBe('denied');
    });

    it('should ignore details parameter', async () => {
      const details = { reason: 'Insufficient permissions' };

      await service.logPermissionDenied(user, 'Case', 'DELETE', details);

      expect(prismaService.eventLog.create).toHaveBeenCalledTimes(1);
    });

    it('should handle database error and throw', async () => {
      prismaService.eventLog.create.mockRejectedValue(new Error('Database connection failed'));

      await expect(service.logPermissionDenied(user, 'Case', 'DELETE')).rejects.toThrow('Database connection failed');
    });
  });

  describe('getLogs', () => {
    beforeEach(() => {
      prismaService.eventLog.findMany.mockResolvedValue(mockEventLogs);
    });

    it.each([
      ['default pagination', undefined, undefined, 50, 0],
      ['custom limit', 10, undefined, 10, 0],
      ['custom offset', undefined, 100, 50, 100],
      ['custom limit and offset', 25, 75, 25, 75],
      ['limit of 1', 1, undefined, 1, 0],
      ['large limit', 1000, undefined, 1000, 0],
      ['large offset', 50, 10000, 50, 10000],
      ['zero limit', 0, undefined, 0, 0],
    ])('should retrieve logs with %s', async (_description, limit, offset, expectedLimit, expectedOffset) => {
      const result = await service.getLogs(limit, offset);

      expect(result).toEqual(mockEventLogs);
      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith({
        orderBy: { performed_at: 'desc' },
        take: expectedLimit,
        skip: expectedOffset,
      });
    });

    it('should return empty array when no logs found', async () => {
      prismaService.eventLog.findMany.mockResolvedValue([]);

      const result = await service.getLogs();

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle database error and throw', async () => {
      prismaService.eventLog.findMany.mockRejectedValue(new Error('Query failed'));

      await expect(service.getLogs()).rejects.toThrow('Query failed');
    });
  });

  describe('getActionHistoryForAlert', () => {
    const mockAlertHistory = {
      id: 1,
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      operation: 'ALERT_UPDATED',
      entity_name: 'AlertService',
      action_performed: '123 - Updated alert',
      outcome: 'success',
      performed_at: new Date('2026-02-20T10:00:00Z'),
    };

    beforeEach(() => {
      prismaService.eventLog.findMany.mockResolvedValue([mockAlertHistory]);
    });

    it('should retrieve action history for an alert', async () => {
      const result = await service.getActionHistoryForAlert(123);

      expect(result).toEqual([mockAlertHistory]);
      expect(prismaService.eventLog.findMany).toHaveBeenCalledWith({
        where: {
          operation: 'ALERT_UPDATED',
          action_performed: { startsWith: '123 -' },
          entity_name: 'AlertService',
        },
        orderBy: { performed_at: 'desc' },
      });
    });

    it.each([[1], [100], [456], [999], [12345], [0]])('should handle alert ID %i', async (alertId) => {
      await service.getActionHistoryForAlert(alertId);

      const callArgs = prismaService.eventLog.findMany.mock.calls[0][0];
      expect(callArgs.where.action_performed).toEqual({ startsWith: `${alertId} -` });
      expect(callArgs.where.operation).toBe('ALERT_UPDATED');
      expect(callArgs.where.entity_name).toBe('AlertService');
      expect(callArgs.orderBy).toEqual({ performed_at: 'desc' });
    });

    it('should return empty array when no history found', async () => {
      prismaService.eventLog.findMany.mockResolvedValue([]);

      const result = await service.getActionHistoryForAlert(999);

      expect(result).toEqual([]);
    });

    it('should handle database error and throw', async () => {
      prismaService.eventLog.findMany.mockRejectedValue(new Error('Database query failed'));

      await expect(service.getActionHistoryForAlert(123)).rejects.toThrow('Database query failed');
    });
  });

  describe('getActionHistoryForCase', () => {
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
        entity_name: 'Alert',
        action_performed: 'Updated Case 456',
        outcome: 'success',
        performed_at: new Date('2026-02-20T11:00:00Z'),
      },
    ];

    beforeEach(() => {
      prismaService.eventLog.findMany.mockResolvedValue(mockCaseHistory);
    });

    it('should retrieve action history for a case', async () => {
      const result = await service.getActionHistoryForCase(456);

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

    it.each([[1], [100], [789], [999], [12345], [0]])('should search for case ID %i in multiple formats', async (caseId) => {
      await service.getActionHistoryForCase(caseId);

      const callArgs = prismaService.eventLog.findMany.mock.calls[0][0];
      expect(callArgs.where.OR).toEqual([
        { action_performed: { contains: caseId.toString() } },
        { action_performed: { contains: `case ${caseId}` } },
        { action_performed: { contains: `Case ${caseId}` } },
      ]);
      expect(callArgs.where.entity_name).toEqual({ in: ['Alert', 'Case'] });
      expect(callArgs.orderBy).toEqual({ performed_at: 'asc' });
    });

    it('should return empty array when no history found', async () => {
      prismaService.eventLog.findMany.mockResolvedValue([]);

      const result = await service.getActionHistoryForCase(999);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should find logs from both Alert and Case entities', async () => {
      const result = await service.getActionHistoryForCase(456);

      expect(result).toHaveLength(2);
      expect(result[0].entity_name).toBe('Case');
      expect(result[1].entity_name).toBe('Alert');
    });

    it('should handle database error and throw', async () => {
      prismaService.eventLog.findMany.mockRejectedValue(new Error('Connection timeout'));

      await expect(service.getActionHistoryForCase(456)).rejects.toThrow('Connection timeout');
    });
  });
});
