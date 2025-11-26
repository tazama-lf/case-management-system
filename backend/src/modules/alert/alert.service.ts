import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AlertRepository } from '../repository/alert.repository';
import { IngestAlertDto } from '../../dtos/IngestAlert.dto';
import { Alert, CaseCreationType, CaseStatus, Priority } from '@prisma/client';
import { CreateCaseDto } from '../case/dto/index.dto';
import { ConfigService } from '@nestjs/config';
import { CaseCreationApprovalService } from '../case/services/case-creation-approval.service';
import { UpdateAlertDTO } from './dto/UpdateAlert.dto';
import { AuditLogService } from '../audit/auditLog.service';

@Injectable()
export class AlertService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly auditLogService: AuditLogService,
    private readonly configService: ConfigService,
    private readonly alertRepository: AlertRepository,
    private readonly caseCreationService: CaseCreationApprovalService,
  ) {}

  async createNewAlert(alert: IngestAlertDto, tenantId: string, source: string, caseId: string) {
    this.loggerService.log(`Start - Alert Creation`, AlertService.name);
    const txtp = alert.transaction.TxTp;
    alert.message = alert.message ?? 'Suspicious activity detected';
    try {
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

  async updateAlert(alertId: string, userId: string, updateData: UpdateAlertDTO): Promise<Alert> {
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
      this.loggerService.log(`End - Alert Update - ${alertId}`, AlertService.name);

      return updatedAlert;
    } catch (error) {
      this.loggerService.error(`Error updating alert ${alertId}: ${error.message}`, error, AlertService.name);
      throw new InternalServerErrorException(`Failed to update alert ${alertId}`);
    }
  }

  async handleAlertOrNALT(data: IngestAlertDto, userId: string, tenantId: string, source: string) {
    if (data.report.status === 'NALT') {
      const createdNALT = await this.createNewAlert(data, tenantId, source, '');
      return createdNALT;
    } else {
      const systemUuid = this.configService.get<string>('SYSTEM_UUID', userId);
      const caseDetail: CreateCaseDto = {
        tenantId,
        caseCreatorUserId: systemUuid,
        caseOwnerUserId: userId,
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
