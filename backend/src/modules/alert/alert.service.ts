import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AlertRepository } from '../repository/alert.repository';
import { IngestAlertDto } from './dto/IngestAlert.dto';
import { Alert, CaseCreationType, CaseStatus, Priority } from '@prisma/client-cms';
import { CreateCaseDto } from '../case/dto/create-case.dto';
import { ConfigService } from '@nestjs/config';
import { CaseCreationApprovalService } from '../case/services/case-creation-approval.service';
import { UpdateAlertDTO } from './dto/UpdateAlert.dto';
import { AuditLogService } from '../audit/auditLog.service';
import { EventLogService } from '../event_log/eventLog.service';
import { CaseCreationService } from '../case/services/case-creation.service';

@Injectable()
export class AlertService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
    private readonly alertRepository: AlertRepository,
    private readonly caseCreationService: CaseCreationService,
    private readonly eventLogService: EventLogService,
  ) {}

  async createNewAlert(alert: IngestAlertDto, tenantId: string, source: string, caseId: number) {
    this.loggerService.log(`Start - Alert Creation`, AlertService.name);
    const txtp = alert.transaction.TxTp;
    alert.message = alert.message ?? 'Generic Alert Message';
    try {
      await this.alertRepository.createTransaction(tenantId, alert.transaction);
      const newAlert = await this.alertRepository.createAlert({
        tenantId,
        priority: Priority.NEW,
        source: source,
        txtp: txtp,
        message: alert.message,
        report: alert.report,
        transaction: alert.transaction,
        networkMap: alert.networkMap,
        confidencePer: 0,
        caseId: caseId,
      });

      this.loggerService.log(`End - Alert Creation - ${newAlert.alert_id}`, AlertService.name);
      return newAlert;
    } catch (error) {
      this.loggerService.error(`Error creating alert: ${error.message}`, error, AlertService.name);
      throw new InternalServerErrorException('Failed to create alert');
    }
  }

  async updateAlert(alertId: number, userId: string, updateData: UpdateAlertDTO): Promise<Alert> {
    this.loggerService.log(`Start - Alert Update - ${alertId}`, AlertService.name);
    try {
      const updatedAlert = await this.alertRepository.updateAlert(alertId, updateData);

      await this.auditLogService.logAction({
        userId,
        operation: 'ALERT_UPDATED',
        entityName: AlertService.name,
        actionPerformed: `${alertId} - Triaged by user ${userId}`,
        outcome: `Alert ${alertId} updated successfully`,
      });

      await this.eventLogService.logEventAction({
        userId,
        operation: 'Alert updated',
        entityName: AlertService.name,
        actionPerformed: `${alertId} - Triaged by user ${userId}`,
        outcome: `Alert with Alert ID: ${alertId} updated successfully`,
      });

      this.loggerService.log(`End - Alert Update - ${alertId}`, AlertService.name);
      return updatedAlert;
    } catch (error) {
      this.loggerService.error(`Error updating alert ${alertId}: ${error.message}`, error, AlertService.name);
      throw new InternalServerErrorException(`Failed to update alert ${alertId}`);
    }
  }

  async handleAlertOrNALT(data: IngestAlertDto, userId: string, tenantId: string, source: string) {
    if (data.report.status === 'NALT') {
      const createdNALT = await this.createNewAlert(data, tenantId, source, 0);
      return createdNALT;
    } else {
      const systemUUID = this.configService.get<string>('SYSTEM_UUID', userId);
      const caseDetail: CreateCaseDto = {
        tenantId,
        caseCreatorUserId: systemUUID,
        status: CaseStatus.STATUS_00_DRAFT,
        priority: Priority.NEW,
        caseCreationType: CaseCreationType.AUTOMATIC_SYSTEM,
      };

      const createdCase = await this.caseCreationService.createCase(caseDetail, userId);
      const createdAlert = await this.createNewAlert(data, tenantId, source, createdCase.case_id);
      return createdAlert;
    }
  }
}
