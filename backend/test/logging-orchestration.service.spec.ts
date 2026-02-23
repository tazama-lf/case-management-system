import { Test, TestingModule } from '@nestjs/testing';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { AuditLogService } from '../src/modules/audit/auditLog.service';
import { EventLogService } from '../src/modules/event_log/eventLog.service';
import { TaskHistoryService } from '../src/modules/task_history/taskHistory.service';
import { CaseHistoryService } from '../src/modules/case_history/caseHistory.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { InternalServerErrorException } from '@nestjs/common';
import { LogDataDTO } from '../src/modules/logging-orchestration/dto/LogData.dto';
import { Outcome } from '../src/utils/types/outcome';

describe('LoggingOrchestrationService', () => {
  let service: LoggingOrchestrationService;
  let auditLogService: any;
  let eventLogService: any;
  let loggerService: any;
  let caseHistoryService: any;
  let taskHistoryService: any;

  const mockLogData: LogDataDTO = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    operation: 'CREATE',
    entityName: 'Case',
    actionPerformed: 'Created case 123',
    outcome: Outcome.SUCCESS,
  };

  beforeEach(async () => {
    const mockAuditLogService = {
      logAction: jest.fn().mockResolvedValue({}),
    };

    const mockEventLogService = {
      logEventAction: jest.fn().mockResolvedValue({}),
    };

    const mockLoggerService = {
      log: jest.fn(),
      error: jest.fn(),
      warn: jest.fn(),
      debug: jest.fn(),
      verbose: jest.fn(),
    };

    const mockCaseHistoryService = {
      logCaseHistoryAction: jest.fn().mockResolvedValue({}),
    };

    const mockTaskHistoryService = {
      logTaskHistoryAction: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingOrchestrationService,
        {
          provide: AuditLogService,
          useValue: mockAuditLogService,
        },
        {
          provide: EventLogService,
          useValue: mockEventLogService,
        },
        {
          provide: LoggerService,
          useValue: mockLoggerService,
        },
        {
          provide: CaseHistoryService,
          useValue: mockCaseHistoryService,
        },
        {
          provide: TaskHistoryService,
          useValue: mockTaskHistoryService,
        },
      ],
    }).compile();

    service = module.get<LoggingOrchestrationService>(LoggingOrchestrationService);
    auditLogService = module.get(AuditLogService);
    eventLogService = module.get(EventLogService);
    loggerService = module.get(LoggerService);
    caseHistoryService = module.get(CaseHistoryService);
    taskHistoryService = module.get(TaskHistoryService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('logActions', () => {
    it('should successfully log actions to both audit and event logs', async () => {
      await service.logActions(mockLogData);

      expect(auditLogService.logAction).toHaveBeenCalledWith({
        ...mockLogData,
        performedAt: expect.any(Date),
      });
      expect(eventLogService.logEventAction).toHaveBeenCalledWith({
        ...mockLogData,
        performedAt: expect.any(Date),
      });
    });

    it('should pass the same performedAt timestamp to both services', async () => {
      const beforeCall = Date.now();
      await service.logActions(mockLogData);
      const afterCall = Date.now();

      const auditCall = auditLogService.logAction.mock.calls[0][0];
      const eventCall = eventLogService.logEventAction.mock.calls[0][0];

      expect(auditCall.performedAt).toEqual(eventCall.performedAt);
      expect(auditCall.performedAt.getTime()).toBeGreaterThanOrEqual(beforeCall);
      expect(auditCall.performedAt.getTime()).toBeLessThanOrEqual(afterCall);
    });

    it('should log with different operations', async () => {
      const operations = ['CREATE', 'UPDATE', 'DELETE', 'VIEW'];

      for (const operation of operations) {
        const logData = { ...mockLogData, operation };
        await service.logActions(logData);

        const auditCall = auditLogService.logAction.mock.calls[auditLogService.logAction.mock.calls.length - 1][0];
        expect(auditCall.operation).toBe(operation);
      }
    });

    it('should log with different outcomes', async () => {
      const outcomes = [Outcome.SUCCESS, Outcome.FAILURE];

      for (const outcome of outcomes) {
        const logData = { ...mockLogData, outcome };
        await service.logActions(logData);

        const auditCall = auditLogService.logAction.mock.calls[auditLogService.logAction.mock.calls.length - 1][0];
        expect(auditCall.outcome).toBe(outcome);
      }
    });

    it('should log with different entity names', async () => {
      const entityNames = ['Case', 'Alert', 'Task', 'Comment'];

      for (const entityName of entityNames) {
        const logData = { ...mockLogData, entityName };
        await service.logActions(logData);

        const auditCall = auditLogService.logAction.mock.calls[auditLogService.logAction.mock.calls.length - 1][0];
        expect(auditCall.entityName).toBe(entityName);
      }
    });

    it('should throw InternalServerErrorException when auditLogService fails', async () => {
      const error = new Error('Audit log failed');
      auditLogService.logAction.mockRejectedValue(error);

      await expect(service.logActions(mockLogData)).rejects.toThrow(InternalServerErrorException);
      await expect(service.logActions(mockLogData)).rejects.toThrow('Failed to log actions');

      expect(loggerService.error).toHaveBeenCalledWith(
        'LoggingOrchestrationService - Audit log failed',
        error,
        'LoggingOrchestrationService',
      );
    });

    it('should throw InternalServerErrorException when eventLogService fails', async () => {
      const error = new Error('Event log failed');
      eventLogService.logEventAction.mockRejectedValue(error);

      await expect(service.logActions(mockLogData)).rejects.toThrow(InternalServerErrorException);
      await expect(service.logActions(mockLogData)).rejects.toThrow('Failed to log actions');

      expect(loggerService.error).toHaveBeenCalledWith(
        'LoggingOrchestrationService - Event log failed',
        error,
        'LoggingOrchestrationService',
      );
    });

    it('should call both services even if they succeed', async () => {
      await service.logActions(mockLogData);

      expect(auditLogService.logAction).toHaveBeenCalledTimes(1);
      expect(eventLogService.logEventAction).toHaveBeenCalledTimes(1);
    });

    it('should handle non-Error exceptions', async () => {
      auditLogService.logAction.mockRejectedValue('String error');

      await expect(service.logActions(mockLogData)).rejects.toThrow(InternalServerErrorException);

      expect(loggerService.error).toHaveBeenCalledWith(
        'LoggingOrchestrationService - String error',
        'String error',
        'LoggingOrchestrationService',
      );
    });

    it('should preserve all fields from logData', async () => {
      const detailedLogData = {
        userId: 'user-123',
        operation: 'COMPLEX_OPERATION',
        entityName: 'CustomEntity',
        actionPerformed: 'Performed complex action with many details',
        outcome: Outcome.SUCCESS,
      };

      await service.logActions(detailedLogData);

      const auditCall = auditLogService.logAction.mock.calls[0][0];
      expect(auditCall.userId).toBe(detailedLogData.userId);
      expect(auditCall.operation).toBe(detailedLogData.operation);
      expect(auditCall.entityName).toBe(detailedLogData.entityName);
      expect(auditCall.actionPerformed).toBe(detailedLogData.actionPerformed);
      expect(auditCall.outcome).toBe(detailedLogData.outcome);
    });
  });

  describe('logActionsWithHistory', () => {
    const case_id = 123;
    const tenant_id = 'tenant-001';

    describe('without task_id (case history only)', () => {
      it('should log to audit, event, and case history services', async () => {
        await service.logActionsWithHistory(mockLogData, case_id, tenant_id);

        expect(auditLogService.logAction).toHaveBeenCalledWith(mockLogData);
        expect(eventLogService.logEventAction).toHaveBeenCalledWith(mockLogData);
        expect(caseHistoryService.logCaseHistoryAction).toHaveBeenCalledWith({
          userId: mockLogData.userId,
          operation: mockLogData.operation,
          entityName: mockLogData.entityName,
          actionPerformed: mockLogData.actionPerformed,
          case_id,
          tenant_id,
          performedAt: expect.any(Date),
        });
        expect(taskHistoryService.logTaskHistoryAction).not.toHaveBeenCalled();
      });

      it('should call eventLog and caseHistory in parallel', async () => {
        let eventLogResolved = false;
        let caseHistoryResolved = false;

        eventLogService.logEventAction.mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          eventLogResolved = true;
        });

        caseHistoryService.logCaseHistoryAction.mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          caseHistoryResolved = true;
        });

        await service.logActionsWithHistory(mockLogData, case_id, tenant_id);

        expect(eventLogResolved).toBe(true);
        expect(caseHistoryResolved).toBe(true);
      });

      it('should pass correct case and tenant IDs', async () => {
        const differentCaseId = 999;
        const differentTenantId = 'tenant-999';

        await service.logActionsWithHistory(mockLogData, differentCaseId, differentTenantId);

        const caseHistoryCall = caseHistoryService.logCaseHistoryAction.mock.calls[0][0];
        expect(caseHistoryCall.case_id).toBe(differentCaseId);
        expect(caseHistoryCall.tenant_id).toBe(differentTenantId);
      });

      it('should use current date as performedAt', async () => {
        const beforeCall = Date.now();
        await service.logActionsWithHistory(mockLogData, case_id, tenant_id);
        const afterCall = Date.now();

        const caseHistoryCall = caseHistoryService.logCaseHistoryAction.mock.calls[0][0];
        expect(caseHistoryCall.performedAt.getTime()).toBeGreaterThanOrEqual(beforeCall);
        expect(caseHistoryCall.performedAt.getTime()).toBeLessThanOrEqual(afterCall);
      });

      it('should handle case_id of 0', async () => {
        await service.logActionsWithHistory(mockLogData, 0, tenant_id);

        const caseHistoryCall = caseHistoryService.logCaseHistoryAction.mock.calls[0][0];
        expect(caseHistoryCall.case_id).toBe(0);
      });

      it('should handle empty tenant_id string', async () => {
        await service.logActionsWithHistory(mockLogData, case_id, '');

        const caseHistoryCall = caseHistoryService.logCaseHistoryAction.mock.calls[0][0];
        expect(caseHistoryCall.tenant_id).toBe('');
      });
    });

    describe('with task_id (task history)', () => {
      const task_id = 456;

      it('should log to audit, event, and task history services', async () => {
        await service.logActionsWithHistory(mockLogData, case_id, tenant_id, task_id);

        expect(auditLogService.logAction).toHaveBeenCalledWith(mockLogData);
        expect(eventLogService.logEventAction).toHaveBeenCalledWith(mockLogData);
        expect(taskHistoryService.logTaskHistoryAction).toHaveBeenCalledWith({
          userId: mockLogData.userId,
          operation: mockLogData.operation,
          entityName: mockLogData.entityName,
          actionPerformed: mockLogData.actionPerformed,
          case_id,
          task_id,
          tenant_id,
          performedAt: expect.any(Date),
        });
        expect(caseHistoryService.logCaseHistoryAction).not.toHaveBeenCalled();
      });

      it('should call eventLog and taskHistory in parallel', async () => {
        let eventLogResolved = false;
        let taskHistoryResolved = false;

        eventLogService.logEventAction.mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          eventLogResolved = true;
        });

        taskHistoryService.logTaskHistoryAction.mockImplementation(async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          taskHistoryResolved = true;
        });

        await service.logActionsWithHistory(mockLogData, case_id, tenant_id, task_id);

        expect(eventLogResolved).toBe(true);
        expect(taskHistoryResolved).toBe(true);
      });

      it('should pass correct task, case, and tenant IDs', async () => {
        const differentTaskId = 789;
        const differentCaseId = 888;
        const differentTenantId = 'tenant-888';

        await service.logActionsWithHistory(mockLogData, differentCaseId, differentTenantId, differentTaskId);

        const taskHistoryCall = taskHistoryService.logTaskHistoryAction.mock.calls[0][0];
        expect(taskHistoryCall.task_id).toBe(differentTaskId);
        expect(taskHistoryCall.case_id).toBe(differentCaseId);
        expect(taskHistoryCall.tenant_id).toBe(differentTenantId);
      });

      it('should use current date as performedAt', async () => {
        const beforeCall = Date.now();
        await service.logActionsWithHistory(mockLogData, case_id, tenant_id, task_id);
        const afterCall = Date.now();

        const taskHistoryCall = taskHistoryService.logTaskHistoryAction.mock.calls[0][0];
        expect(taskHistoryCall.performedAt.getTime()).toBeGreaterThanOrEqual(beforeCall);
        expect(taskHistoryCall.performedAt.getTime()).toBeLessThanOrEqual(afterCall);
      });

      it('should handle task_id of 0 as case history (0 is falsy)', async () => {
        await service.logActionsWithHistory(mockLogData, case_id, tenant_id, 0);

        const caseHistoryCall = caseHistoryService.logCaseHistoryAction.mock.calls[0][0];
        expect(caseHistoryCall.case_id).toBe(case_id);
        expect(taskHistoryService.logTaskHistoryAction).not.toHaveBeenCalled();
      });

      it('should preserve all logData fields in task history', async () => {
        const detailedLogData = {
          userId: 'detailed-user',
          operation: 'DETAILED_OP',
          entityName: 'DetailedEntity',
          actionPerformed: 'Performed detailed task action',
          outcome: Outcome.SUCCESS,
        };

        await service.logActionsWithHistory(detailedLogData, case_id, tenant_id, task_id);

        const taskHistoryCall = taskHistoryService.logTaskHistoryAction.mock.calls[0][0];
        expect(taskHistoryCall.userId).toBe(detailedLogData.userId);
        expect(taskHistoryCall.operation).toBe(detailedLogData.operation);
        expect(taskHistoryCall.entityName).toBe(detailedLogData.entityName);
        expect(taskHistoryCall.actionPerformed).toBe(detailedLogData.actionPerformed);
      });
    });

    describe('error handling', () => {
      it('should throw InternalServerErrorException when auditLogService fails', async () => {
        const error = new Error('Audit failed');
        auditLogService.logAction.mockRejectedValue(error);

        await expect(service.logActionsWithHistory(mockLogData, case_id, tenant_id)).rejects.toThrow(
          InternalServerErrorException,
        );
        await expect(service.logActionsWithHistory(mockLogData, case_id, tenant_id)).rejects.toThrow(
          'Failed to log actions with history',
        );

        expect(loggerService.error).toHaveBeenCalledWith(
          'LoggingOrchestrationService - Audit failed',
          error,
          'LoggingOrchestrationService',
        );
      });

      it('should throw InternalServerErrorException when eventLogService fails', async () => {
        const error = new Error('Event log failed');
        eventLogService.logEventAction.mockRejectedValue(error);

        await expect(service.logActionsWithHistory(mockLogData, case_id, tenant_id)).rejects.toThrow(
          InternalServerErrorException,
        );

        expect(loggerService.error).toHaveBeenCalledWith(
          'LoggingOrchestrationService - Event log failed',
          error,
          'LoggingOrchestrationService',
        );
      });

      it('should throw InternalServerErrorException when caseHistoryService fails', async () => {
        const error = new Error('Case history failed');
        caseHistoryService.logCaseHistoryAction.mockRejectedValue(error);

        await expect(service.logActionsWithHistory(mockLogData, case_id, tenant_id)).rejects.toThrow(
          InternalServerErrorException,
        );

        expect(loggerService.error).toHaveBeenCalledWith(
          'LoggingOrchestrationService - Case history failed',
          error,
          'LoggingOrchestrationService',
        );
      });

      it('should throw InternalServerErrorException when taskHistoryService fails', async () => {
        const error = new Error('Task history failed');
        taskHistoryService.logTaskHistoryAction.mockRejectedValue(error);

        await expect(service.logActionsWithHistory(mockLogData, case_id, tenant_id, 123)).rejects.toThrow(
          InternalServerErrorException,
        );

        expect(loggerService.error).toHaveBeenCalledWith(
          'LoggingOrchestrationService - Task history failed',
          error,
          'LoggingOrchestrationService',
        );
      });

      it('should handle non-Error exceptions in logActionsWithHistory', async () => {
        caseHistoryService.logCaseHistoryAction.mockRejectedValue('String error');

        await expect(service.logActionsWithHistory(mockLogData, case_id, tenant_id)).rejects.toThrow(
          InternalServerErrorException,
        );

        expect(loggerService.error).toHaveBeenCalledWith(
          'LoggingOrchestrationService - String error',
          'String error',
          'LoggingOrchestrationService',
        );
      });

      it('should handle null error', async () => {
        auditLogService.logAction.mockRejectedValue(null);

        await expect(service.logActionsWithHistory(mockLogData, case_id, tenant_id)).rejects.toThrow(
          InternalServerErrorException,
        );

        expect(loggerService.error).toHaveBeenCalledWith(
          'LoggingOrchestrationService - null',
          null,
          'LoggingOrchestrationService',
        );
      });

      it('should handle undefined error', async () => {
        eventLogService.logEventAction.mockRejectedValue(undefined);

        await expect(service.logActionsWithHistory(mockLogData, case_id, tenant_id)).rejects.toThrow(
          InternalServerErrorException,
        );

        expect(loggerService.error).toHaveBeenCalledWith(
          'LoggingOrchestrationService - undefined',
          undefined,
          'LoggingOrchestrationService',
        );
      });
    });

    describe('different scenarios', () => {
      it('should handle multiple consecutive calls', async () => {
        await service.logActionsWithHistory(mockLogData, 1, 'tenant-1');
        await service.logActionsWithHistory(mockLogData, 2, 'tenant-2', 100);
        await service.logActionsWithHistory(mockLogData, 3, 'tenant-3');

        expect(auditLogService.logAction).toHaveBeenCalledTimes(3);
        expect(caseHistoryService.logCaseHistoryAction).toHaveBeenCalledTimes(2);
        expect(taskHistoryService.logTaskHistoryAction).toHaveBeenCalledTimes(1);
      });

      it('should handle large case IDs', async () => {
        const largeCaseId = 999999999;

        await service.logActionsWithHistory(mockLogData, largeCaseId, tenant_id);

        const caseHistoryCall = caseHistoryService.logCaseHistoryAction.mock.calls[0][0];
        expect(caseHistoryCall.case_id).toBe(largeCaseId);
      });

      it('should handle long tenant IDs', async () => {
        const longTenantId = 'a'.repeat(100);

        await service.logActionsWithHistory(mockLogData, case_id, longTenantId);

        const caseHistoryCall = caseHistoryService.logCaseHistoryAction.mock.calls[0][0];
        expect(caseHistoryCall.tenant_id).toBe(longTenantId);
      });

      it('should treat undefined and 0 task_id the same (both falsy)', async () => {
        await service.logActionsWithHistory(mockLogData, case_id, tenant_id, undefined);

        expect(caseHistoryService.logCaseHistoryAction).toHaveBeenCalled();
        expect(taskHistoryService.logTaskHistoryAction).not.toHaveBeenCalled();

        jest.clearAllMocks();

        await service.logActionsWithHistory(mockLogData, case_id, tenant_id, 0);

        expect(caseHistoryService.logCaseHistoryAction).toHaveBeenCalled();
        expect(taskHistoryService.logTaskHistoryAction).not.toHaveBeenCalled();
      });
    });
  });

  describe('Integration scenarios', () => {
    it('should successfully orchestrate all logging services for case action', async () => {
      await service.logActionsWithHistory(mockLogData, 123, 'tenant-123');

      expect(auditLogService.logAction).toHaveBeenCalled();
      expect(eventLogService.logEventAction).toHaveBeenCalled();
      expect(caseHistoryService.logCaseHistoryAction).toHaveBeenCalled();
      expect(taskHistoryService.logTaskHistoryAction).not.toHaveBeenCalled();
    });

    it('should successfully orchestrate all logging services for task action', async () => {
      await service.logActionsWithHistory(mockLogData, 123, 'tenant-123', 456);

      expect(auditLogService.logAction).toHaveBeenCalled();
      expect(eventLogService.logEventAction).toHaveBeenCalled();
      expect(taskHistoryService.logTaskHistoryAction).toHaveBeenCalled();
      expect(caseHistoryService.logCaseHistoryAction).not.toHaveBeenCalled();
    });

    it('should handle mixed operations sequentially', async () => {
      await service.logActions(mockLogData);
      await service.logActionsWithHistory(mockLogData, 123, 'tenant-123');
      await service.logActionsWithHistory(mockLogData, 456, 'tenant-456', 789);

      expect(auditLogService.logAction).toHaveBeenCalledTimes(3);
      expect(eventLogService.logEventAction).toHaveBeenCalledTimes(3);
      expect(caseHistoryService.logCaseHistoryAction).toHaveBeenCalledTimes(1);
      expect(taskHistoryService.logTaskHistoryAction).toHaveBeenCalledTimes(1);
    });
  });
});
