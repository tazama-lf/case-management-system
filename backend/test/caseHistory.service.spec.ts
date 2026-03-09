import { Test, TestingModule } from '@nestjs/testing';
import { CaseHistoryService } from '../src/modules/case_history/caseHistory.service';
import { PrismaService } from '../prisma/prisma.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { validate as isUuid } from 'uuid';

describe('CaseHistoryService', () => {
  let service: CaseHistoryService;
  let prismaService: any;
  let loggerService: jest.Mocked<LoggerService>;

  const mockCaseHistory = {
    id: 1,
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: 'tenant-123',
    operation: 'CREATE_CASE',
    entity_name: 'Case',
    action_performed: 'Created case 456',
    case_id: 456,
    performed_at: new Date('2026-02-20T10:00:00Z'),
  };

  const mockCaseHistories = [
    {
      id: 1,
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      tenant_id: 'tenant-123',
      operation: 'CREATE_CASE',
      entity_name: 'Case',
      action_performed: 'Created case 456',
      case_id: 456,
      performed_at: new Date('2026-02-20T10:00:00Z'),
    },
    {
      id: 2,
      user_id: '660e8400-e29b-41d4-a716-446655440001',
      tenant_id: 'tenant-123',
      operation: 'UPDATE_CASE',
      entity_name: 'Case',
      action_performed: 'Updated case 456',
      case_id: 456,
      performed_at: new Date('2026-02-20T11:00:00Z'),
    },
  ];

  beforeEach(async () => {
    const mockPrismaService = {
      caseHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const mockLogger = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CaseHistoryService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: LoggerService,
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<CaseHistoryService>(CaseHistoryService);
    prismaService = module.get(PrismaService) as any;
    loggerService = module.get(LoggerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logCaseHistoryAction', () => {
    const actionData = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      operation: 'CREATE_CASE',
      entityName: 'Case',
      actionPerformed: 'Created case 456',
      case_id: 456,
      tenant_id: 'tenant-123',
    };

    it('should successfully log a case history action with valid userId', async () => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      const result = await service.logCaseHistoryAction(actionData);

      expect(result).toEqual(mockCaseHistory);
      expect(prismaService.caseHistory.create).toHaveBeenCalledWith({
        data: {
          user_id: actionData.userId,
          tenant_id: actionData.tenant_id,
          operation: actionData.operation,
          entity_name: actionData.entityName,
          action_performed: actionData.actionPerformed,
          case_id: actionData.case_id,
          performed_at: expect.any(Date),
        },
      });
    });

    it.each([
      ['not provided', undefined],
      ['invalid UUID', 'invalid-uuid'],
      ['empty string', ''],
    ])('should generate UUID when userId is %s', async (_desc, userId) => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      await service.logCaseHistoryAction({
        ...actionData,
        userId: userId as any,
      });

      const callData = prismaService.caseHistory.create.mock.calls[0][0].data;
      expect(callData.user_id).not.toBe(userId);
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should use provided userId when it is a valid UUID', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      await service.logCaseHistoryAction({
        ...actionData,
        userId: validUUID,
      });

      const callData = prismaService.caseHistory.create.mock.calls[0][0].data;
      expect(callData.user_id).toBe(validUUID);
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should use provided performedAt date', async () => {
      const customDate = new Date('2026-01-01T00:00:00Z');
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      await service.logCaseHistoryAction({
        ...actionData,
        performedAt: customDate,
      });

      const callData = prismaService.caseHistory.create.mock.calls[0][0].data;
      expect(callData.performed_at).toBe(customDate);
    });

    it('should use current date when performedAt is not provided', async () => {
      const beforeCall = new Date();
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      await service.logCaseHistoryAction(actionData);

      const afterCall = new Date();
      const callData = prismaService.caseHistory.create.mock.calls[0][0].data;

      expect(callData.performed_at).toBeInstanceOf(Date);
      expect(callData.performed_at.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(callData.performed_at.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it.each([
      ['case_id', { case_id: 456 }, 'case_id', 456],
      ['tenant_id', { tenant_id: 'tenant-123' }, 'tenant_id', 'tenant-123'],
      ['case_id of 0', { case_id: 0 }, 'case_id', 0],
    ])('should include %s in the log', async (_desc, dataOverride, field, expectedValue) => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      await service.logCaseHistoryAction({
        ...actionData,
        ...dataOverride,
      });

      const callData = prismaService.caseHistory.create.mock.calls[0][0].data;
      expect(callData[field]).toBe(expectedValue);
    });

    it.each([
      ['operations', 'operation', ['CREATE_CASE', 'UPDATE_CASE', 'DELETE_CASE', 'CLOSE_CASE', 'REOPEN_CASE']],
      ['entity names', 'entityName', ['Case', 'CaseService', 'Alert', 'Task']],
      ['case IDs', 'case_id', [1, 100, 999, 12345]],
      ['tenant IDs', 'tenant_id', ['tenant-123', 'tenant-456', 'org-789', 'company-abc']],
    ])('should handle different %s correctly', async (_desc, field, values) => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      for (const value of values) {
        await service.logCaseHistoryAction({
          ...actionData,
          [field]: value,
        });

        const callData = prismaService.caseHistory.create.mock.calls[prismaService.caseHistory.create.mock.calls.length - 1][0].data;
        const expectedField = field === 'entityName' ? 'entity_name' : field;
        expect(callData[expectedField]).toBe(value);
      }
    });

    it('should handle long action descriptions', async () => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      const longAction = 'A'.repeat(1000);
      await service.logCaseHistoryAction({
        ...actionData,
        actionPerformed: longAction,
      });

      const callData = prismaService.caseHistory.create.mock.calls[0][0].data;
      expect(callData.action_performed).toBe(longAction);
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Database error');
      prismaService.caseHistory.create.mockRejectedValue(error);

      await expect(service.logCaseHistoryAction(actionData)).rejects.toThrow('Database error');
    });
  });

  describe('getLogs', () => {
    const tenantId = 'tenant-123';

    it('should retrieve logs with default pagination', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      const result = await service.getLogs(tenantId);

      expect(result).toEqual(mockCaseHistories);
      expect(prismaService.caseHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it.each([
      ['custom limit', 10, undefined, 10, 0],
      ['custom offset', undefined, 100, 50, 100],
      ['both custom', 25, 75, 25, 75],
      ['limit of 1', 1, undefined, 1, 0],
      ['large limit', 1000, undefined, 1000, 0],
      ['large offset', 50, 10000, 50, 10000],
      ['zero limit', 0, undefined, 0, 0],
    ])('should retrieve logs with %s', async (_desc, limit, offset, expectedTake, expectedSkip) => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      const result = await service.getLogs(tenantId, limit, offset);

      expect(result).toEqual(mockCaseHistories);
      expect(prismaService.caseHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: expectedTake,
        skip: expectedSkip,
      });
    });

    it.each([['tenant-456'], ['org-789'], ['']])('should filter by tenant_id: %s', async (tid) => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      await service.getLogs(tid);

      const callArgs = prismaService.caseHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.tenant_id).toBe(tid);
    });

    it('should return empty array when no logs found', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue([]);

      const result = await service.getLogs(tenantId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should order logs by performed_at in descending order', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      await service.getLogs(tenantId);

      expect(prismaService.caseHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { performed_at: 'desc' },
        }),
      );
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Query failed');
      prismaService.caseHistory.findMany.mockRejectedValue(error);

      await expect(service.getLogs(tenantId)).rejects.toThrow('Query failed');
    });
  });

  describe('getCaseHistory', () => {
    const caseId = 456;
    const tenantId = 'tenant-123';

    it('should retrieve case history for a specific case', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      const result = await service.getCaseHistory(caseId, tenantId);

      expect(result).toEqual(mockCaseHistories);
      expect(prismaService.caseHistory.findMany).toHaveBeenCalledWith({
        where: {
          case_id: caseId,
          tenant_id: tenantId,
        },
      });
    });

    it.each([
      ['different case_id', 789, 'tenant-123', 789, 'tenant-123'],
      ['different tenant_id', 456, 'tenant-456', 456, 'tenant-456'],
      ['case ID 0', 0, 'tenant-123', 0, 'tenant-123'],
    ])('should filter by %s', async (_desc, cid, tid, expectedCid, expectedTid) => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      await service.getCaseHistory(cid, tid);

      const callArgs = prismaService.caseHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.case_id).toBe(expectedCid);
      expect(callArgs.where.tenant_id).toBe(expectedTid);
    });

    it('should return empty array when no history found', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue([]);

      const result = await service.getCaseHistory(999, tenantId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should not apply ordering by default', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      await service.getCaseHistory(caseId, tenantId);

      const callArgs = prismaService.caseHistory.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toBeUndefined();
    });

    it('should not apply pagination by default', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      await service.getCaseHistory(caseId, tenantId);

      const callArgs = prismaService.caseHistory.findMany.mock.calls[0][0];
      expect(callArgs.take).toBeUndefined();
      expect(callArgs.skip).toBeUndefined();
    });

    it('should return all matching records without limit', async () => {
      const manyRecords = Array.from({ length: 100 }, (_, i) => ({
        ...mockCaseHistory,
        id: i + 1,
      }));
      prismaService.caseHistory.findMany.mockResolvedValue(manyRecords);

      const result = await service.getCaseHistory(caseId, tenantId);

      expect(result).toHaveLength(100);
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Database query failed');
      prismaService.caseHistory.findMany.mockRejectedValue(error);

      await expect(service.getCaseHistory(caseId, tenantId)).rejects.toThrow('Database query failed');
    });
  });
});
