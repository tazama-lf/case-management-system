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
  let auditLogService: jest.Mocked<AuditLogService>;
  let eventLogService: jest.Mocked<EventLogService>;
  let loggerService: jest.Mocked<LoggerService>;
  let caseHistoryService: jest.Mocked<CaseHistoryService>;
  let taskHistoryService: jest.Mocked<TaskHistoryService>;

  const mockLogData: LogDataDTO = {
    userId: '550e8400-e29b-41d4-a716-446655440000',
    operation: 'CREATE',
    entityName: 'Case',
    actionPerformed: 'Created case 123',
    outcome: Outcome.SUCCESS,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoggingOrchestrationService,
        {
          provide: AuditLogService,
          useValue: {
            logAction: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: EventLogService,
          useValue: {
            logEventAction: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: LoggerService,
          useValue: {
            log: jest.fn(),
            error: jest.fn(),
            warn: jest.fn(),
            debug: jest.fn(),
            verbose: jest.fn(),
          },
        },
        {
          provide: CaseHistoryService,
          useValue: {
            logCaseHistoryAction: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: TaskHistoryService,
          useValue: {
            logTaskHistoryAction: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<LoggingOrchestrationService>(LoggingOrchestrationService);
    auditLogService = module.get(AuditLogService) as jest.Mocked<AuditLogService>;
    eventLogService = module.get(EventLogService) as jest.Mocked<EventLogService>;
    loggerService = module.get(LoggerService) as jest.Mocked<LoggerService>;
    caseHistoryService = module.get(CaseHistoryService) as jest.Mocked<CaseHistoryService>;
    taskHistoryService = module.get(TaskHistoryService) as jest.Mocked<TaskHistoryService>;
    
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
      await service.logActions(mockLogData);

      const auditCall = auditLogService.logAction.mock.calls[0][0];
      const eventCall = eventLogService.logEventAction.mock.calls[0][0];

      expect(auditCall.performedAt).toEqual(eventCall.performedAt);
    });

    it.each([
      ['CREATE', Outcome.SUCCESS],
      ['UPDATE', Outcome.FAILURE],
      ['DELETE', Outcome.SUCCESS],
      ['VIEW', Outcome.SUCCESS],
    ])('should log with operation %s and outcome %s', async (operation, outcome) => {
      const logData = { ...mockLogData, operation, outcome };
      await service.logActions(logData);

      const auditCall = auditLogService.logAction.mock.calls[0][0];
      expect(auditCall.operation).toBe(operation);
      expect(auditCall.outcome).toBe(outcome);
    });

    it.each([
      ['auditLogService', 'Audit log failed'],
      ['eventLogService', 'Event log failed'],
    ])('should throw InternalServerErrorException when %s fails', async (serviceName, errorMsg) => {
      const error = new Error(errorMsg);
      if (serviceName === 'auditLogService') {
        auditLogService.logAction.mockRejectedValue(error);
      } else {
        eventLogService.logEventAction.mockRejectedValue(error);
      }

      await expect(service.logActions(mockLogData)).rejects.toThrow(InternalServerErrorException);
      await expect(service.logActions(mockLogData)).rejects.toThrow('Failed to log actions');

      expect(loggerService.error).toHaveBeenCalledWith(
        `LoggingOrchestrationService - ${errorMsg}`,
        error,
        'LoggingOrchestrationService',
      );
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
  });

  describe('logActionsWithHistory', () => {
    const case_id = 123;
    const tenant_id = 'tenant-001';

    describe('without task_id (case history)', () => {
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

      it('should pass correct case and tenant IDs', async () => {
        const differentCaseId = 999;
        const differentTenantId = 'tenant-999';

        await service.logActionsWithHistory(mockLogData, differentCaseId, differentTenantId);

        const caseHistoryCall = caseHistoryService.logCaseHistoryAction.mock.calls[0][0];
        expect(caseHistoryCall.case_id).toBe(differentCaseId);
        expect(caseHistoryCall.tenant_id).toBe(differentTenantId);
      });

      it.each([
        ['case_id 0', 0, tenant_id, 0],
        ['empty tenant_id', case_id, '', ''],
      ])('should handle edge case: %s', async (_desc, caseIdValue, tenantIdValue, expectedValue) => {
        await service.logActionsWithHistory(mockLogData, caseIdValue, tenantIdValue);

        const caseHistoryCall = caseHistoryService.logCaseHistoryAction.mock.calls[0][0];
        if (_desc.includes('case_id')) {
          expect(caseHistoryCall.case_id).toBe(expectedValue);
        } else {
          expect(caseHistoryCall.tenant_id).toBe(expectedValue);
        }
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

      it.each([
        ['0', 0],
        ['undefined', undefined],
      ])('should use case history when task_id is %s (falsy)', async (_desc, taskIdValue) => {
        await service.logActionsWithHistory(mockLogData, case_id, tenant_id, taskIdValue);

        expect(caseHistoryService.logCaseHistoryAction).toHaveBeenCalled();
        expect(taskHistoryService.logTaskHistoryAction).not.toHaveBeenCalled();
      });
    });

    describe('error handling', () => {
      it.each([
        ['auditLogService', 'Audit failed'],
        ['eventLogService', 'Event log failed'],
        ['caseHistoryService', 'Case history failed'],
      ])('should throw InternalServerErrorException when %s fails', async (serviceName, errorMsg) => {
        const error = new Error(errorMsg);
        
        if (serviceName === 'auditLogService') {
          auditLogService.logAction.mockRejectedValue(error);
        } else if (serviceName === 'eventLogService') {
          eventLogService.logEventAction.mockRejectedValue(error);
        } else {
          caseHistoryService.logCaseHistoryAction.mockRejectedValue(error);
        }

        await expect(service.logActionsWithHistory(mockLogData, case_id, tenant_id)).rejects.toThrow(
          InternalServerErrorException,
        );

        expect(loggerService.error).toHaveBeenCalledWith(
          `LoggingOrchestrationService - ${errorMsg}`,
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

      it('should handle non-Error exceptions', async () => {
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
    });

    it('should handle multiple consecutive calls with different scenarios', async () => {
      await service.logActionsWithHistory(mockLogData, 1, 'tenant-1');
      await service.logActionsWithHistory(mockLogData, 2, 'tenant-2', 100);
      await service.logActionsWithHistory(mockLogData, 3, 'tenant-3');

      expect(auditLogService.logAction).toHaveBeenCalledTimes(3);
      expect(caseHistoryService.logCaseHistoryAction).toHaveBeenCalledTimes(2);
      expect(taskHistoryService.logTaskHistoryAction).toHaveBeenCalledTimes(1);
    });
  });
});
