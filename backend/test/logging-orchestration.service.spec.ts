import { Test, TestingModule } from '@nestjs/testing';
import { LoggingOrchestrationService } from '../src/modules/logging-orchestration/logging-orchestration.service';
import { EventLogService } from '../src/modules/event_log/eventLog.service';
import { TaskHistoryService } from '../src/modules/task_history/taskHistory.service';
import { CaseHistoryService } from '../src/modules/case_history/caseHistory.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { InternalServerErrorException } from '@nestjs/common';
import { LogDataDTO } from '../src/modules/logging-orchestration/dto/LogData.dto';
import { Outcome } from '../src/utils/types/outcome';

describe('LoggingOrchestrationService', () => {
  let service: LoggingOrchestrationService;
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
          provide: EventLogService,
          useValue: { logEventAction: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: LoggerService,
          useValue: { log: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn(), verbose: jest.fn() },
        },
        {
          provide: CaseHistoryService,
          useValue: { logCaseHistoryAction: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: TaskHistoryService,
          useValue: { logTaskHistoryAction: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<LoggingOrchestrationService>(LoggingOrchestrationService);
    eventLogService = module.get(EventLogService) as jest.Mocked<EventLogService>;
    loggerService = module.get(LoggerService) as jest.Mocked<LoggerService>;
    caseHistoryService = module.get(CaseHistoryService) as jest.Mocked<CaseHistoryService>;
    taskHistoryService = module.get(TaskHistoryService) as jest.Mocked<TaskHistoryService>;

    jest.clearAllMocks();
  });

  describe('logActions', () => {
    it('should call eventLogService with correct fields including performedAt', async () => {
      await service.logActions(mockLogData);

      expect(eventLogService.logEventAction).toHaveBeenCalledTimes(1);
      expect(eventLogService.logEventAction).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: mockLogData.userId,
          operation: mockLogData.operation,
          entityName: mockLogData.entityName,
          actionPerformed: mockLogData.actionPerformed,
          outcome: mockLogData.outcome,
          performedAt: expect.any(Date),
        }),
      );
    });

    it.each([
      ['CREATE', Outcome.SUCCESS],
      ['UPDATE', Outcome.FAILURE],
      ['DELETE', Outcome.SUCCESS],
    ])('should log with operation %s and outcome %s', async (operation, outcome) => {
      const logData = { ...mockLogData, operation, outcome };
      await service.logActions(logData);

      const call = eventLogService.logEventAction.mock.calls[0][0];
      expect(call.operation).toBe(operation);
      expect(call.outcome).toBe(outcome);
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

    it('should handle non-Error exceptions', async () => {
      eventLogService.logEventAction.mockRejectedValue('String error');

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
      it('should call event and case history services', async () => {
        await service.logActionsWithHistory(mockLogData, case_id, tenant_id);

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
        await service.logActionsWithHistory(mockLogData, 999, 'tenant-999');

        const call = caseHistoryService.logCaseHistoryAction.mock.calls[0][0];
        expect(call.case_id).toBe(999);
        expect(call.tenant_id).toBe('tenant-999');
      });

      it.each([
        ['case_id 0', 0, tenant_id],
        ['empty tenant_id', case_id, ''],
      ])('should handle edge case: %s', async (_desc, caseIdValue, tenantIdValue) => {
        await service.logActionsWithHistory(mockLogData, caseIdValue, tenantIdValue);

        const call = caseHistoryService.logCaseHistoryAction.mock.calls[0][0];
        expect(call.case_id).toBe(caseIdValue);
        expect(call.tenant_id).toBe(tenantIdValue);
      });
    });

    describe('with task_id (task history)', () => {
      const task_id = 456;

      it('should call event and task history services, not case history', async () => {
        await service.logActionsWithHistory(mockLogData, case_id, tenant_id, task_id);

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
        await service.logActionsWithHistory(mockLogData, 888, 'tenant-888', 789);

        const call = taskHistoryService.logTaskHistoryAction.mock.calls[0][0];
        expect(call.task_id).toBe(789);
        expect(call.case_id).toBe(888);
        expect(call.tenant_id).toBe('tenant-888');
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
        ['eventLogService', 'Event log failed'],
        ['caseHistoryService', 'Case history failed'],
      ])('should throw InternalServerErrorException when %s fails', async (serviceName, errorMsg) => {
        const error = new Error(errorMsg);

        if (serviceName === 'eventLogService') {
          eventLogService.logEventAction.mockRejectedValue(error);
        } else {
          caseHistoryService.logCaseHistoryAction.mockRejectedValue(error);
        }

        await expect(service.logActionsWithHistory(mockLogData, case_id, tenant_id)).rejects.toThrow(InternalServerErrorException);

        expect(loggerService.error).toHaveBeenCalledWith(`LoggingOrchestrationService - ${errorMsg}`, error, 'LoggingOrchestrationService');
      });

      it('should throw InternalServerErrorException when taskHistoryService fails', async () => {
        const error = new Error('Task history failed');
        taskHistoryService.logTaskHistoryAction.mockRejectedValue(error);

        await expect(service.logActionsWithHistory(mockLogData, case_id, tenant_id, 123)).rejects.toThrow(InternalServerErrorException);

        expect(loggerService.error).toHaveBeenCalledWith(
          'LoggingOrchestrationService - Task history failed',
          error,
          'LoggingOrchestrationService',
        );
      });

      it('should handle non-Error exceptions', async () => {
        caseHistoryService.logCaseHistoryAction.mockRejectedValue('String error');

        await expect(service.logActionsWithHistory(mockLogData, case_id, tenant_id)).rejects.toThrow(InternalServerErrorException);

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

      expect(eventLogService.logEventAction).toHaveBeenCalledTimes(3);
      expect(caseHistoryService.logCaseHistoryAction).toHaveBeenCalledTimes(2);
      expect(taskHistoryService.logTaskHistoryAction).toHaveBeenCalledTimes(1);
    });
  });
});
