import { Test, TestingModule } from '@nestjs/testing';
import { TaskHistoryService } from '../src/modules/task_history/taskHistory.service';
import { PrismaService } from '../prisma/prisma.service';
import { validate as isUuid } from 'uuid';

// ─── fixtures ────────────────────────────────────────────────────────────────

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

const baseActionData = {
  userId: '550e8400-e29b-41d4-a716-446655440000',
  operation: 'CREATE_TASK',
  entityName: 'Task',
  actionPerformed: 'Created task 789',
  task_id: 789,
  case_id: 456,
  tenant_id: 'tenant-123',
};

// ─── module factory ──────────────────────────────────────────────────────────

async function createTestModule() {
  const mockPrismaService = {
    taskHistory: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  };

  const module: TestingModule = await Test.createTestingModule({
    providers: [TaskHistoryService, { provide: PrismaService, useValue: mockPrismaService }],
  }).compile();

  return {
    service: module.get<TaskHistoryService>(TaskHistoryService),
    prismaService: module.get(PrismaService) as any,
  };
}

// ─── tests ───────────────────────────────────────────────────────────────────

describe('TaskHistoryService', () => {
  let service: TaskHistoryService;
  let prismaService: any;

  beforeEach(async () => {
    ({ service, prismaService } = await createTestModule());
  });

  afterEach(() => jest.clearAllMocks());

  // ── logTaskHistoryAction ────────────────────────────────────────────────────

  describe('logTaskHistoryAction', () => {
    beforeEach(() => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);
    });

    it('should log action with valid userId', async () => {
      const result = await service.logTaskHistoryAction(baseActionData);

      expect(result).toEqual(mockTaskHistory);
      expect(prismaService.taskHistory.create).toHaveBeenCalledWith({
        data: {
          user_id: baseActionData.userId,
          tenant_id: baseActionData.tenant_id,
          operation: baseActionData.operation,
          entity_name: baseActionData.entityName,
          action_performed: baseActionData.actionPerformed,
          task_id: baseActionData.task_id,
          case_id: baseActionData.case_id,
          performed_at: expect.any(Date),
        },
      });
    });

    it('should generate UUID when userId is invalid or missing', async () => {
      const scenarios = [
        { userId: undefined, name: 'undefined' },
        { userId: 'invalid-uuid', name: 'invalid UUID' },
        { userId: '', name: 'empty string' },
      ];

      for (const { userId, name } of scenarios) {
        await service.logTaskHistoryAction({ ...baseActionData, userId });

        const callData = prismaService.taskHistory.create.mock.calls[prismaService.taskHistory.create.mock.calls.length - 1][0].data;
        expect(isUuid(callData.user_id)).toBe(true);
        if (userId) expect(callData.user_id).not.toBe(userId);
      }
    });

    it('should use custom performedAt date when provided', async () => {
      const customDate = new Date('2026-01-01T00:00:00Z');

      await service.logTaskHistoryAction({ ...baseActionData, performedAt: customDate });

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(callData.performed_at).toBe(customDate);
    });

    it('should use current date when performedAt not provided', async () => {
      const beforeCall = new Date();
      await service.logTaskHistoryAction(baseActionData);
      const afterCall = new Date();

      const callData = prismaService.taskHistory.create.mock.calls[0][0].data;
      expect(callData.performed_at).toBeInstanceOf(Date);
      expect(callData.performed_at.getTime()).toBeGreaterThanOrEqual(beforeCall.getTime());
      expect(callData.performed_at.getTime()).toBeLessThanOrEqual(afterCall.getTime());
    });

    it('should handle various data types and edge cases', async () => {
      const testCases = [
        { field: 'task_id', values: [0, 1, 999, 12345] },
        { field: 'case_id', values: [0, 1, 999, 12345] },
        { field: 'operation', values: ['CREATE_TASK', 'UPDATE_TASK', 'DELETE_TASK'] },
        { field: 'entityName', values: ['Task', 'Case', 'Alert'] },
        { field: 'tenant_id', values: ['tenant-123', 'org-456', 'company-abc'] },
        { field: 'actionPerformed', values: ['Short action', 'A'.repeat(1000)] },
      ];

      for (const { field, values } of testCases) {
        for (const value of values) {
          const dataKey = field === 'entityName' ? 'entity_name' : field === 'actionPerformed' ? 'action_performed' : field;

          await service.logTaskHistoryAction({ ...baseActionData, [field]: value });

          const callData = prismaService.taskHistory.create.mock.calls[prismaService.taskHistory.create.mock.calls.length - 1][0].data;
          expect(callData[dataKey]).toBe(value);
        }
      }
    });

    it('should propagate database errors', async () => {
      prismaService.taskHistory.create.mockRejectedValue(new Error('Database error'));

      await expect(service.logTaskHistoryAction(baseActionData)).rejects.toThrow('Database error');
    });
  });

  // ── getLogs ──────────────────────────────────────────────────────────────────

  describe('getLogs', () => {
    const mockLogs = [mockTaskHistory, { ...mockTaskHistory, id: 2 }];

    beforeEach(() => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockLogs);
    });

    it('should retrieve logs with default pagination', async () => {
      const result = await service.getLogs('tenant-123');

      expect(result).toEqual(mockLogs);
      expect(prismaService.taskHistory.findMany).toHaveBeenCalledWith({
        where: { tenant_id: 'tenant-123' },
        orderBy: { performed_at: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should handle custom pagination parameters', async () => {
      const scenarios = [
        { limit: 10, offset: 0, name: 'custom limit' },
        { limit: 50, offset: 100, name: 'custom offset' },
        { limit: 25, offset: 75, name: 'both custom' },
        { limit: 0, offset: 0, name: 'zero limit' },
        { limit: 1000, offset: 10000, name: 'large values' },
      ];

      for (const { limit, offset, name } of scenarios) {
        await service.getLogs('tenant-123', limit, offset);

        expect(prismaService.taskHistory.findMany).toHaveBeenCalledWith({
          where: { tenant_id: 'tenant-123' },
          orderBy: { performed_at: 'desc' },
          take: limit,
          skip: offset,
        });
      }
    });

    it('should filter by different tenant IDs', async () => {
      const tenantIds = ['tenant-123', 'tenant-456', 'org-789', ''];

      for (const tenantId of tenantIds) {
        await service.getLogs(tenantId);

        const callArgs = prismaService.taskHistory.findMany.mock.calls[prismaService.taskHistory.findMany.mock.calls.length - 1][0];
        expect(callArgs.where.tenant_id).toBe(tenantId);
      }
    });

    it('should return empty array when no logs found', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue([]);

      const result = await service.getLogs('tenant-123');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should propagate database errors', async () => {
      prismaService.taskHistory.findMany.mockRejectedValue(new Error('Query failed'));

      await expect(service.getLogs('tenant-123')).rejects.toThrow('Query failed');
    });
  });

  // ── getTaskHistory ───────────────────────────────────────────────────────────

  describe('getTaskHistory', () => {
    const mockHistory = [mockTaskHistory];

    beforeEach(() => {
      prismaService.taskHistory.findMany.mockResolvedValue(mockHistory);
    });

    it('should retrieve task history for specific case', async () => {
      const result = await service.getTaskHistory(456, 'tenant-123');

      expect(result).toEqual(mockHistory);
      expect(prismaService.taskHistory.findMany).toHaveBeenCalledWith({
        where: {
          case_id: 456,
          tenant_id: 'tenant-123',
        },
      });
    });

    it('should handle different case IDs and tenant IDs', async () => {
      const testCases = [
        { caseId: 0, tenantId: 'tenant-123' },
        { caseId: 1, tenantId: 'tenant-456' },
        { caseId: 999, tenantId: 'org-789' },
        { caseId: 12345, tenantId: 'company-abc' },
      ];

      for (const { caseId, tenantId } of testCases) {
        await service.getTaskHistory(caseId, tenantId);

        const callArgs = prismaService.taskHistory.findMany.mock.calls[prismaService.taskHistory.findMany.mock.calls.length - 1][0];
        expect(callArgs.where.case_id).toBe(caseId);
        expect(callArgs.where.tenant_id).toBe(tenantId);
      }
    });

    it('should return empty array when no history found', async () => {
      prismaService.taskHistory.findMany.mockResolvedValue([]);

      const result = await service.getTaskHistory(999, 'tenant-123');

      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
    });

    it('should not apply ordering or pagination', async () => {
      await service.getTaskHistory(456, 'tenant-123');

      const callArgs = prismaService.taskHistory.findMany.mock.calls[0][0];
      expect(callArgs.orderBy).toBeUndefined();
      expect(callArgs.take).toBeUndefined();
      expect(callArgs.skip).toBeUndefined();
    });

    it('should propagate database errors', async () => {
      prismaService.taskHistory.findMany.mockRejectedValue(new Error('Database query failed'));

      await expect(service.getTaskHistory(456, 'tenant-123')).rejects.toThrow('Database query failed');
    });
  });

  // ── integration scenarios ───────────────────────────────────────────────────

  describe('integration scenarios', () => {
    it('should support end-to-end workflow: log action then retrieve it', async () => {
      prismaService.taskHistory.create.mockResolvedValue(mockTaskHistory);
      prismaService.taskHistory.findMany.mockResolvedValue([mockTaskHistory]);

      // Log action
      await service.logTaskHistoryAction(baseActionData);

      // Retrieve via getLogs
      const logs = await service.getLogs('tenant-123');
      expect(logs).toContainEqual(mockTaskHistory);

      // Retrieve via getTaskHistory
      const history = await service.getTaskHistory(456, 'tenant-123');
      expect(history).toContainEqual(mockTaskHistory);

      expect(prismaService.taskHistory.create).toHaveBeenCalled();
      expect(prismaService.taskHistory.findMany).toHaveBeenCalledTimes(2);
    });
  });
});
