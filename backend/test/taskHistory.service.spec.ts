import { Test, TestingModule } from '@nestjs/testing';
import { TaskHistoryService } from '../src/modules/task_history/taskHistory.service';
import { PrismaService } from '../prisma/prisma.service';
import { validate as isUuid } from 'uuid';

describe('TaskHistoryService', () => {
  let service: TaskHistoryService;
  let prismaService: any;

  const mockTaskHistory = {
    id: 1,
    user_id: '550e8400-e29b-41d4-a716-446655440000',
    tenant_id: 'tenant-123',
    operation: 'CREATE_TASK',
    entity_name: 'Task',
    action_performed: 'Created task 789',
    task_id: 789,
    case_id: 456,
    performed_at: new Date('2026-02-20T10:00:00Z'),
  };

  const mockTaskHistories = [
    {
      id: 1,
      user_id: '550e8400-e29b-41d4-a716-446655440000',
      tenant_id: 'tenant-123',
      operation: 'CREATE_TASK',
      entity_name: 'Task',
      action_performed: 'Created task 789',
      task_id: 789,
      case_id: 456,
      performed_at: new Date('2026-02-20T10:00:00Z'),
    },
    {
      id: 2,
      user_id: '660e8400-e29b-41d4-a716-446655440001',
      tenant_id: 'tenant-123',
      operation: 'UPDATE_TASK',
      entity_name: 'Task',
      action_performed: 'Updated task 789',
      task_id: 789,
      case_id: 456,
      performed_at: new Date('2026-02-20T11:00:00Z'),
    },
  ];

  beforeEach(async () => {
    const mockPrismaService = {
      taskHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaskHistoryService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<TaskHistoryService>(TaskHistoryService);
    prismaService = module.get(PrismaService) as any;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logTaskHistoryAction', () => {
    const actionData = {
      userId: '550e8400-e29b-41d4-a716-446655440000',
      operation: 'CREATE_TASK',
      entityName: 'Task',
      actionPerformed: 'Created task 789',
      task_id: 789,
      case_id: 456,
      tenant_id: 'tenant-123',
    };

    it('should successfully log a task history action with valid userId', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      const result = await service.logTaskHistoryAction(actionData);

      expect(result).toEqual(mockTaskHistory);
      expect(prismaService.taskHistory.create).toHaveBeenCalledWith({
        data: {
          user_id: actionData.userId,
          tenant_id: actionData.tenant_id,
          operation: actionData.operation,
          entity_name: actionData.entityName,
          action_performed: actionData.actionPerformed,
          task_id: actionData.task_id,
          case_id: actionData.case_id,
          performed_at: expect.any(Date),
        },
      });
    });

    it('should use provided userId when it is a valid UUID', async () => {
      const validUUID = '550e8400-e29b-41d4-a716-446655440000';
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      await service.logTaskHistoryAction({
        ...actionData,
        userId: validUUID,
      });

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(callData.user_id).toBe(validUUID);
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should generate UUID when userId is not provided', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      const dataWithoutUserId = {
        operation: 'CREATE_TASK',
        entityName: 'Task',
        actionPerformed: 'Created task 789',
        task_id: 789,
        case_id: 456,
        tenant_id: 'tenant-123',
      };

      await service.logTaskHistoryAction(dataWithoutUserId);

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should generate UUID when userId is invalid', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      await service.logTaskHistoryAction({
        ...actionData,
        userId: 'invalid-uuid',
      });

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(callData.user_id).not.toBe('invalid-uuid');
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should generate UUID when userId is empty string', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      await service.logTaskHistoryAction({
        ...actionData,
        userId: '',
      });

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(callData.user_id).not.toBe('');
      expect(isUuid(callData.user_id)).toBe(true);
    });

    it('should use provided performedAt date', async () => {
      const customDate = new Date('2026-01-01T00:00:00Z');
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      await service.logTaskHistoryAction({
        ...actionData,
        performedAt: customDate,
      });

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(callData.performed_at).toBe(customDate);
    });

    it('should use current date when performedAt is not provided', async () => {
      const beforeCall = new Date();
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      await service.logTaskHistoryAction(actionData);

      const afterCall = new Date();
      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      
      expect(callData.performed_at).toBeInstanceOf(Date);
      expect(callData.performed_at.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(callData.performed_at.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('should include task_id in the log', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      await service.logTaskHistoryAction(actionData);

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(callData.task_id).toBe(789);
    });

    it('should include case_id in the log', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      await service.logTaskHistoryAction(actionData);

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(callData.case_id).toBe(456);
    });

    it('should include tenant_id in the log', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      await service.logTaskHistoryAction(actionData);

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(callData.tenant_id).toBe('tenant-123');
    });

    it('should handle different operations correctly', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      const operations = ['CREATE_TASK', 'UPDATE_TASK', 'DELETE_TASK', 'COMPLETE_TASK', 'ASSIGN_TASK'];
      
      for (const operation of operations) {
        await service.logTaskHistoryAction({
          ...actionData,
          operation,
        });

        const callData = prismaService.taskHistory.create.mock.calls[prismaService.taskHistory.create.mock.calls.length - 1][0].data;
        expect(callData.operation).toBe(operation);
      }
    });

    it('should handle different entity names', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      const entityNames = ['Task', 'TaskService', 'Case', 'Alert'];
      
      for (const entityName of entityNames) {
        await service.logTaskHistoryAction({
          ...actionData,
          entityName,
        });

        const callData = prismaService.taskHistory.create.mock.calls[prismaService.taskHistory.create.mock.calls.length - 1][0].data;
        expect(callData.entity_name).toBe(entityName);
      }
    });

    it('should handle different task IDs', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      const taskIds = [1, 100, 999, 12345];
      
      for (const task_id of taskIds) {
        await service.logTaskHistoryAction({
          ...actionData,
          task_id,
        });

        const callData = prismaService.taskHistory.create.mock.calls[prismaService.taskHistory.create.mock.calls.length - 1][0].data;
        expect(callData.task_id).toBe(task_id);
      }
    });

    it('should handle different case IDs', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      const caseIds = [1, 100, 999, 12345];
      
      for (const case_id of caseIds) {
        await service.logTaskHistoryAction({
          ...actionData,
          case_id,
        });

        const callData = prismaService.taskHistory.create.mock.calls[prismaService.taskHistory.create.mock.calls.length - 1][0].data;
        expect(callData.case_id).toBe(case_id);
      }
    });

    it('should handle different tenant IDs', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      const tenantIds = ['tenant-123', 'tenant-456', 'org-789', 'company-abc'];
      
      for (const tenant_id of tenantIds) {
        await service.logTaskHistoryAction({
          ...actionData,
          tenant_id,
        });

        const callData = prismaService.taskHistory.create.mock.calls[prismaService.taskHistory.create.mock.calls.length - 1][0].data;
        expect(callData.tenant_id).toBe(tenant_id);
      }
    });

    it('should handle long action descriptions', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      const longAction = 'A'.repeat(1000);
      await service.logTaskHistoryAction({
        ...actionData,
        actionPerformed: longAction,
      });

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(callData.action_performed).toBe(longAction);
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Database error');
      prismaService.taskHistory.create.mockRejectedValue(error);

      await expect(service.logTaskHistoryAction(actionData)).rejects.toThrow('Database error');
    });

    it('should handle task_id of 0', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      await service.logTaskHistoryAction({
        ...actionData,
        task_id: 0,
      });

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(callData.task_id).toBe(0);
    });

    it('should handle case_id of 0', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      await service.logTaskHistoryAction({
        ...actionData,
        case_id: 0,
      });

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(callData.case_id).toBe(0);
    });

    it('should log with both task_id and case_id', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);

      await service.logTaskHistoryAction({
        ...actionData,
        task_id: 789,
        case_id: 456,
      });

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(callData.task_id).toBe(789);
      expect(callData.case_id).toBe(456);
    });
  });

  describe('getLogs', () => {
    const tenantId = 'tenant-123';

    it('should retrieve logs with default pagination', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      const result = await service.getLogs(tenantId);

      expect(result).toEqual(mockTaskHistories);
      expect(prismaService.taskHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should retrieve logs with custom limit', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      const result = await service.getLogs(tenantId, 10);

      expect(result).toEqual(mockTaskHistories);
      expect(prismaService.taskHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 10,
        skip: 0,
      });
    });

    it('should retrieve logs with custom offset', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      const result = await service.getLogs(tenantId, 50, 100);

      expect(result).toEqual(mockTaskHistories);
      expect(prismaService.taskHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 50,
        skip: 100,
      });
    });

    it('should retrieve logs with both custom limit and offset', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      const result = await service.getLogs(tenantId, 25, 75);

      expect(result).toEqual(mockTaskHistories);
      expect(prismaService.taskHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 25,
        skip: 75,
      });
    });

    it('should filter by tenant_id', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      await service.getLogs('tenant-456');

      const callArgs = prismaService.taskHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.tenant_id).toBe('tenant-456');
    });

    it('should return empty array when no logs found', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue([]);

      const result = await service.getLogs(tenantId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should order logs by performed_at in descending order', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      await service.getLogs(tenantId);

      expect(prismaService.taskHistory.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { performed_at: 'desc' },
        }),
      );
    });

    it('should handle limit of 1', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue([mockTaskHistories[0]]);

      const result = await service.getLogs(tenantId, 1);

      expect(result).toHaveLength(1);
      expect(prismaService.taskHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 1,
        skip: 0,
      });
    });

    it('should handle large limit values', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      await service.getLogs(tenantId, 1000);

      expect(prismaService.taskHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 1000,
        skip: 0,
      });
    });

    it('should handle large offset values', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue([]);

      await service.getLogs(tenantId, 50, 10000);

      expect(prismaService.taskHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 50,
        skip: 10000,
      });
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Query failed');
      prismaService.taskHistory.findMany.mockRejectedValue(error);

      await expect(service.getLogs(tenantId)).rejects.toThrow('Query failed');
    });

    it('should handle zero limit', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue([]);

      await service.getLogs(tenantId, 0);

      expect(prismaService.taskHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: tenantId },
        orderBy: { performed_at: 'desc' },
        take: 0,
        skip: 0,
      });
    });

    it('should handle different tenant IDs', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      const tenantIds = ['tenant-123', 'tenant-456', 'org-789'];
      
      for (const tid of tenantIds) {
        await service.getLogs(tid);

        const callArgs = prismaService.taskHistory.findMany.mock.calls[prismaService.taskHistory.findMany.mock.calls.length - 1][0];
        expect(callArgs.where.tenant_id).toBe(tid);
      }
    });

    it('should handle empty tenant ID', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue([]);

      await service.getLogs('');

      const callArgs = prismaService.taskHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.tenant_id).toBe('');
    });
  });

  describe('getTaskHistory', () => {
    const caseId = 456;
    const tenantId = 'tenant-123';

    it('should retrieve task history for a specific case', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      const result = await service.getTaskHistory(caseId, tenantId);

      expect(result).toEqual(mockTaskHistories);
      expect(prismaService.taskHistory.findMany).toHaveBeenCalledWith({
        where: {
          case_id: caseId,
          tenant_id: tenantId,
        },
      });
    });

    it('should filter by case_id', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      await service.getTaskHistory(789, tenantId);

      const callArgs = prismaService.taskHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.case_id).toBe(789);
    });

    it('should filter by tenant_id', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      await service.getTaskHistory(caseId, 'tenant-456');

      const callArgs = prismaService.taskHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.tenant_id).toBe('tenant-456');
    });

    it('should return empty array when no history found', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue([]);

      const result = await service.getTaskHistory(999, tenantId);

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should handle different case IDs', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      const caseIds = [1, 100, 999, 12345];
      
      for (const id of caseIds) {
        await service.getTaskHistory(id, tenantId);

        const callArgs = prismaService.taskHistory.findMany.mock.calls[prismaService.taskHistory.findMany.mock.calls.length - 1][0];
        expect(callArgs.where.case_id).toBe(id);
      }
    });

    it('should handle case ID 0', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue([]);

      await service.getTaskHistory(0, tenantId);

      const callArgs = prismaService.taskHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.case_id).toBe(0);
    });

    it('should handle database error and throw', async () => {
      const error = new Error('Database query failed');
      prismaService.taskHistory.findMany.mockRejectedValue(error);

      await expect(service.getTaskHistory(caseId, tenantId)).rejects.toThrow('Database query failed');
    });

    it('should filter by both case_id and tenant_id simultaneously', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      await service.getTaskHistory(456, 'tenant-123');

      const callArgs = prismaService.taskHistory.findMany.mock.calls[0][0];
      expect(callArgs.where.case_id).toBe(456);
      expect(callArgs.where.tenant_id).toBe('tenant-123');
    });

    it('should not apply any ordering by default', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      await service.getTaskHistory(caseId, tenantId);

      const callArgs = prismaService.taskHistory.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toBeUndefined();
    });

    it('should not apply pagination by default', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockTaskHistories);

      await service.getTaskHistory(caseId, tenantId);

      const callArgs = prismaService.taskHistory.findMany.mock.calls[0][0];
      expect(callArgs.take).toBeUndefined();
      expect(callArgs.skip).toBeUndefined();
    });

    it('should return all matching records without limit', async () => {
      const manyRecords = Array.from({ length: 100 }, (_, i) => ({
        ...mockTaskHistory,
        id: i + 1,
      }));
      prismaService.taskHistory.findMany.mockResolvedValue(manyRecords);

      const result = await service.getTaskHistory(caseId, tenantId);

      expect(result).toHaveLength(100);
    });
  });

  describe('Integration scenarios', () => {
    it('should log action and then retrieve it', async () => {
      const tenantId = 'tenant-123';
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);
      prismaService.taskHistory.findMany.mockResolvedValue([mockTaskHistory]);

      await service.logTaskHistoryAction({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        operation: 'CREATE_TASK',
        entityName: 'Task',
        actionPerformed: 'Created task 789',
        task_id: 789,
        case_id: 456,
        tenant_id: tenantId,
      });

      const logs = await service.getLogs(tenantId);

      expect(logs).toContainEqual(mockTaskHistory);
    });

    it('should log action and retrieve by case ID', async () => {
      const caseId = 456;
      const tenantId = 'tenant-123';
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);
      prismaService.taskHistory.findMany.mockResolvedValue([mockTaskHistory]);

      await service.logTaskHistoryAction({
        userId: '550e8400-e29b-41d4-a716-446655440000',
        operation: 'CREATE_TASK',
        entityName: 'Task',
        actionPerformed: 'Created task 789',
        task_id: 789,
        case_id: caseId,
        tenant_id: tenantId,
      });

      const history = await service.getTaskHistory(caseId, tenantId);

      expect(history).toContainEqual(mockTaskHistory);
      expect(prismaService.taskHistory.create).toHaveBeenCalled();
      expect(prismaService.taskHistory.findMany).toHaveBeenCalled();
    });
  });
});
