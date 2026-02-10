import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { AuditLogService } from '../audit/auditLog.service';
import { EventLogService } from '../event_log/eventLog.service';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { LogDataDTO } from './dto/LogData.dto';
import { TaskHistoryService } from '../task_history/taskHistory.service';
import { CaseHistoryService } from '../case_history/caseHistory.service';

@Injectable()
export class LoggingOrchestrationService {
  constructor(
    private readonly auditLogService: AuditLogService,
    private readonly eventLogService: EventLogService,
    private readonly loggerService: LoggerService,
    private readonly caseHistoryService: CaseHistoryService,
    private readonly taskHistoryService: TaskHistoryService,
  ) {}

  async logActions(logData: LogDataDTO): Promise<void> {
    try {
      const performedAt = new Date();
      await this.auditLogService.logAction({ ...logData, performedAt });
      await this.eventLogService.logEventAction({ ...logData, performedAt });
    } catch (error) {
      this.loggerService.error('LoggingOrchestrationService', error, LoggingOrchestrationService.name);
      throw new InternalServerErrorException('Failed to log actions', error.message);
    }
  }

  async logActionsWithHistory(logData: LogDataDTO, case_id: number, task_id?: number): Promise<void> {
    try {
      const performedAt = new Date();
      await this.auditLogService.logAction(logData);

      if (!task_id) {
        await Promise.all([
          this.eventLogService.logEventAction(logData),
          this.caseHistoryService.logCaseHistoryAction({
            userId: logData.userId,
            operation: logData.operation,
            entityName: logData.entityName,
            actionPerformed: logData.actionPerformed,
            case_id,
            performedAt,
          }),
        ]);
      } else {
        await Promise.all([
          this.eventLogService.logEventAction(logData),
          this.taskHistoryService.logTaskHistoryAction({
            userId: logData.userId,
            operation: logData.operation,
            entityName: logData.entityName,
            actionPerformed: logData.actionPerformed,
            case_id,
            task_id,
            performedAt,
          }),
        ]);
      }
    } catch (error) {
      this.loggerService.error('LoggingOrchestrationService', error, LoggingOrchestrationService.name);
      throw new InternalServerErrorException('Failed to log actions with history', error.message);
    }
  }
}
