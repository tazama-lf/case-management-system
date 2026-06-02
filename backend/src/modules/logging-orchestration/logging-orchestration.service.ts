import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { EventLogService } from '../event_log/eventLog.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { LogDataDTO } from './dto/LogData.dto';
import { TaskHistoryService } from '../task_history/taskHistory.service';
import { CaseHistoryService } from '../case_history/caseHistory.service';

@Injectable()
export class LoggingOrchestrationService {
  constructor(
    private readonly eventLogService: EventLogService,
    private readonly loggerService: LoggerService,
    private readonly caseHistoryService: CaseHistoryService,
    private readonly taskHistoryService: TaskHistoryService,
  ) {}

  async logActions(logData: LogDataDTO): Promise<void> {
    try {
      if (!logData.tenantId) {
        throw new Error('Missing tenantId in logActions');
      }
      const performedAt = new Date();
      await this.eventLogService.logEventAction({
        userId: logData.userId,
        tenantId: logData.tenantId,
        operation: logData.operation,
        entityName: logData.entityName,
        actionPerformed: logData.actionPerformed,
        outcome: logData.outcome,
        performedAt,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.loggerService.error(`LoggingOrchestrationService - ${errorMessage}`, error, LoggingOrchestrationService.name);
      throw new InternalServerErrorException('Failed to log actions', errorMessage);
    }
  }

  async logActionsWithHistory(logData: LogDataDTO, caseId: number, tenantId: string, taskId?: number): Promise<void> {
    try {
      const effectiveTenantId = logData.tenantId || tenantId;
      if (!effectiveTenantId) {
        throw new Error('Missing tenantId in logActionsWithHistory');
      }
      const performedAt = new Date();

      if (taskId) {
        await Promise.all([
          this.eventLogService.logEventAction({
            // eslint-disable-next-line @typescript-eslint/no-misused-spread -- We want to allow logData to override tenantId if it exists, but fall back to the provided tenantId if not
            ...logData,
            tenantId: effectiveTenantId,
          }),
          this.taskHistoryService.logTaskHistoryAction({
            userId: logData.userId,
            operation: logData.operation,
            entityName: logData.entityName,
            actionPerformed: logData.actionPerformed,
            case_id: caseId,
            task_id: taskId,
            tenant_id: tenantId,
            performedAt,
          }),
        ]);
        return;
      }
      await Promise.all([
        this.eventLogService.logEventAction({
          // eslint-disable-next-line @typescript-eslint/no-misused-spread -- We want to allow logData to override tenantId if it exists, but fall back to the provided tenantId if not
          ...logData,
          tenantId: effectiveTenantId,
        }),
        this.caseHistoryService.logCaseHistoryAction({
          userId: logData.userId,
          operation: logData.operation,
          entityName: logData.entityName,
          actionPerformed: logData.actionPerformed,
          case_id: caseId,
          tenant_id: tenantId,
          performedAt,
        }),
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.loggerService.error(`LoggingOrchestrationService - ${errorMessage}`, error, LoggingOrchestrationService.name);
      throw new InternalServerErrorException('Failed to log actions with history', errorMessage);
    }
  }
}
