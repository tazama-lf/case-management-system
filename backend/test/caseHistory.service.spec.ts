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

    it('should generate UUID when userId is not provided', async () => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      const dataWithoutUserId = {
        operation: 'CREATE_CASE',
        entityName: 'Case',
        actionPerformed: 'Created case 456',
        case_id: 456,
        tenant_id: 'tenant-123',
      };

      await service.logCaseHistoryAction(dataWithoutUserId);

      const callData = prismaService.caseHistory.create.mock.calls[0][0].data;
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should generate UUID when userId is invalid', async () => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      await service.logCaseHistoryAction({
        ...actionData,
        userId: 'invalid-uuid',
      });

      const callData = prismaService.caseHistory.create.mock.calls[0][0].data;
      expect(callData.user_id).not.toBe('invalid-uuid');
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should generate UUID when userId is empty string', async () => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      await service.logCaseHistoryAction({
        ...actionData,
        userId: '',
      });

      const callData = prismaService.caseHistory.create.mock.calls[0][0].data;
      expect(callData.user_id).not.toBe('');
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

    it('should include case_id in the log', async () => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      await service.logCaseHistoryAction(actionData);

      const callData = prismaService.caseHistory.create.mock.calls[0][0].data;
      expect(callData.case_id).toBe(456);
    });

    it('should include tenant_id in the log', async () => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      await service.logCaseHistoryAction(actionData);

      const callData = prismaService.caseHistory.create.mock.calls[0][0].data;
      expect(callData.tenant_id).toBe('tenant-123');
    });

    it('should handle different operations correctly', async () => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      const operations = ['CREATE_CASE', 'UPDATE_CASE', 'DELETE_CASE', 'CLOSE_CASE', 'REOPEN_CASE'];
      
      for (const operation of operations) {
        await service.logCaseHistoryAction({
          ...actionData,
          operation,
        });

        const callData = prismaService.caseHistory.create.mock.calls[prismaService.caseHistory.create.mock.calls.length - 1][0].data;
        expect(callData.operation).toBe(operation);
      }
    });

    it('should handle different entity names', async () => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      const entityNames = ['Case', 'CaseService', 'Alert', 'Task'];
      
      for (const entityName of entityNames) {
        await service.logCaseHistoryAction({
          ...actionData,
          entityName,
        });

        const callData = prismaService.caseHistory.create.mock.calls[prismaService.caseHistory.create.mock.calls.length - 1][0].data;
        expect(callData.entity_name).toBe(entityName);
      }
    });

    it('should handle different case IDs', async () => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      const caseIds = [1, 100, 999, 12345];
      
      for (const case_id of caseIds) {
        await service.logCaseHistoryAction({
          ...actionData,
          case_id,
        });

        const callData = prismaService.caseHistory.create.mock.calls[prismaService.caseHistory.create.mock.calls.length - 1][0].data;
        expect(callData.case_id).toBe(case_id);
      }
    });

    it('should handle different tenant IDs', async () => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      const tenantIds = ['tenant-123', 'tenant-456', 'org-789', 'company-abc'];
      
      for (const tenant_id of tenantIds) {
        await service.logCaseHistoryAction({
          ...actionData,
          tenant_id,
        });

        const callData = prismaService.caseHistory.create.mock.calls[prismaService.caseHistory.create.mock.calls.length - 1][0].data;
        expect(callData.tenant_id).toBe(tenant_id);
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

    it('should handle case_id of 0', async () => {
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);

      await service.logCaseHistoryAction({
        ...actionData,
        case_id: 0,
      });

      const callData = prismaService.caseHistory.create.mock.calls[0][0].data;
      expect(callData.case_id).toBe(0);
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

    it('should retrieve logs with custom limit', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      const result = await service.getLogs(tenantId, 10);

      expect(result).toEqual(mockCaseHistories);
      expect(prismaService.caseHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 10,
        skip: 0,
      });
    });

    it('should retrieve logs with custom offset', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      const result = await service.getLogs(tenantId, 50, 100);

      expect(result).toEqual(mockCaseHistories);
      expect(prismaService.caseHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 50,
        skip: 100,
      });
    });

    it('should retrieve logs with both custom limit and offset', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      const result = await service.getLogs(tenantId, 25, 75);

      expect(result).toEqual(mockCaseHistories);
      expect(prismaService.caseHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 25,
        skip: 75,
      });
    });

    it('should filter by tenant_id', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      await service.getLogs('tenant-456');

      const callArgs = prismaService.caseHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.tenant_id).toBe('tenant-456');
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

    it('should handle limit of 1', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue([mockCaseHistories[0]]);

      const result = await service.getLogs(tenantId, 1);

      expect(result).toHaveLength(1);
      expect(prismaService.caseHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 1,
        skip: 0,
      });
    });

    it('should handle large limit values', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      await service.getLogs(tenantId, 1000);

      expect(prismaService.caseHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 1000,
        skip: 0,
      });
    });

    it('should handle large offset values', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue([]);

      await service.getLogs(tenantId, 50, 10000);

      expect(prismaService.caseHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 50,
        skip: 10000,
      });
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Query failed');
      prismaService.caseHistory.findMany.mockRejectedValue(error);

      await expect(service.getLogs(tenantId)).rejects.toThrow('Query failed');
    });

    it('should handle zero limit', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue([]);

      await service.getLogs(tenantId, 0);

      expect(prismaService.caseHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 0,
        skip: 0,
      });
    });

    it('should handle different tenant IDs', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      const tenantIds = ['tenant-123', 'tenant-456', 'org-789'];
      
      for (const tid of tenantIds) {
        await service.getLogs(tid);

        const callArgs = prismaService.caseHistory.findMany.mock.calls[prismaService.caseHistory.findMany.mock.calls.length - 1][0];
        expect(callArgs.where.tenant_id).toBe(tid);
      }
    });

    it('should handle empty tenant ID', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue([]);

      await service.getLogs('');

      const callArgs = prismaService.caseHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.tenant_id).toBe('');
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

    it('should filter by case_id', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      await service.getCaseHistory(789, tenantId);

      const callArgs = prismaService.caseHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.case_id).toBe(789);
    });

    it('should filter by tenant_id', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      await service.getCaseHistory(caseId, 'tenant-456');

      const callArgs = prismaService.caseHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.tenant_id).toBe('tenant-456');
    });

    it('should return empty array when no history found', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue([]);

      const result = await service.getCaseHistory(999, tenantId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle different case IDs', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      const caseIds = [1, 100, 999, 12345];
      
      for (const id of caseIds) {
        await service.getCaseHistory(id, tenantId);

        const callArgs = prismaService.caseHistory.findMany.mock.calls[prismaService.caseHistory.findMany.mock.calls.length - 1][0];
        expect(callArgs.where.case_id).toBe(id);
      }
    });

    it('should handle case ID 0', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue([]);

      await service.getCaseHistory(0, tenantId);

      const callArgs = prismaService.caseHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.case_id).toBe(0);
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Database query failed');
      prismaService.caseHistory.findMany.mockRejectedValue(error);

      await expect(service.getCaseHistory(caseId, tenantId)).rejects.toThrow('Database query failed');
    });

    it('should filter by both case_id and tenant_id simultaneously', async () => {
      prismaService.caseHistory.findMany.mockResolvedValue(mockCaseHistories);

      await service.getCaseHistory(456, 'tenant-123');

      const callArgs = prismaService.caseHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.case_id).toBe(456);
      expect(callArgs.where.tenant_id).toBe('tenant-123');
    });

    it('should not apply any ordering by default', async () => {
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
  });

  describe('Integration scenarios', () => {
    it('should log action and then retrieve it', async () => {
      const tenantId = 'tenant-123';
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);
      prismaService.caseHistory.findMany.mockResolvedValue([mockCaseHistory]);

      await service.logCaseHistoryAction({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        operation: 'CREATE_CASE',
        entityName: 'Case',
        actionPerformed: 'Created case 456',
        case_id: 456,
        tenant_id: tenantId,
      });

      const logs = await service.getLogs(tenantId);

      expect(logs).toContainEqual(mockCaseHistory);
    });

    it('should log action and retrieve by case ID', async () => {
      const caseId = 456;
      const tenantId = 'tenant-123';
      prismaService.caseHistory.create.mockResolvedValue(mockCaseHistory);
      prismaService.caseHistory.findMany.mockResolvedValue([mockCaseHistory]);

      await service.logCaseHistoryAction({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        operation: 'CREATE_CASE',
        entityName: 'Case',
        actionPerformed: 'Created case 456',
        case_id: caseId,
        tenant_id: tenantId,
      });

      const history = await service.getCaseHistory(caseId, tenantId);

      expect(history).toContainEqual(mockCaseHistory);
      expect(prismaService.caseHistory.create).toHaveBeenCalled();
      expect(prismaService.caseHistory.findMany).toHaveBeenCalled();
    });
  });
});
