import { Injectable, InternalServerErrorException, BadRequestException, NotFoundException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AlertRepository } from '../repository/alert.repository';
import { IngestAlertDto } from './dto/IngestAlert.dto';
import { Alert, CaseCreationType, CaseStatus, CaseType, Priority, Prisma, TaskStatus } from '@prisma/client-cms';
import { CreateCaseDto } from '../case/dto/create-case.dto';
import { ConfigService } from '@nestjs/config';
import { CaseCreationApprovalService } from '../case/services/case-creation-approval.service';
import { UpdateAlertDTO } from './dto/UpdateAlert.dto';
import { TransactionDataRespository } from '../repository/transactionalData.respository';
import { extractReferenceId } from '../repository/utils/extractReferenceId';
import { JsonValue } from '../repository/utils/types/JsonValue';
import { CaseCreationService } from '../case/services/case-creation.service';
import { LoggingOrchestrationService } from '../logging-orchestration/logging-orchestration.service';
import { Outcome } from 'src/utils/types/outcome';
import { EventLogService } from '../event_log/eventLog.service';

@Injectable()
export class AlertService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly configService: ConfigService,
    private readonly alertRepository: AlertRepository,
    private readonly caseCreationService: CaseCreationService,
    private readonly transactionDataRespository: TransactionDataRespository,
    private readonly caseCreateService: CaseCreationService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
    private readonly eventLogService: EventLogService,
  ) {}

  async createNewAlert(alert: IngestAlertDto, tenantId: string, source: string, caseId: number): Promise<Alert> {
    this.loggerService.log('Start - Alert Creation', AlertService.name);
    const txtp = alert.transaction.TxTp;
    alert.message = alert.message ?? 'Suspicious activity detected';
    try {
      await this.alertRepository.createTransaction(tenantId, alert.transaction);
      const newAlert = await this.alertRepository.createAlert({
        tenantId,
        priority: Priority.NEW,
        source,
        txtp,
        message: alert.message,
        report: alert.report,
        transaction: alert.transaction,
        networkMap: alert.networkMap,
        confidencePer: 0,
        caseId,
      });

      this.loggerService.log(`End - Alert Creation - ${newAlert.alert_id}`, AlertService.name);
      return newAlert;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(`Error creating alert: ${errorMessage}`, errorStack, AlertService.name);
      throw new InternalServerErrorException('Failed to create alert');
    }
  }

  async updateAlert(alertId: number, userId: string, updateData: UpdateAlertDTO, tx?: Prisma.TransactionClient): Promise<Alert> {
    this.loggerService.log(`Start - Alert Update - ${alertId}`, AlertService.name);
    try {
      const updatedAlert = await this.alertRepository.updateAlert(alertId, updateData, tx);

      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'ALERT_UPDATED',
        entityName: AlertService.name,
        actionPerformed: `${alertId} - Triaged by user ${userId}`,
        outcome: Outcome.SUCCESS,
      });

      this.loggerService.log(`End - Alert Update - ${alertId}`, AlertService.name);
      return updatedAlert;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(`Error updating alert ${alertId}: ${errorMessage}`, errorStack, AlertService.name);
      throw new InternalServerErrorException(`Failed to update alert ${alertId}`);
    }
  }

  async handleAlertOrNALT(data: IngestAlertDto, userId: string, tenantId: string, source: string): Promise<Alert> {
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
      const createdCase = await this.caseCreationService.createCase(caseDetail, userId, tenantId);
      this.loggerService.log(`handle AlertOrNALT CaseType: ${caseDetail.caseType}`);
      if (caseDetail.caseType === CaseType.FRAUD_AND_AML) {
        await this.caseCreateService.createCaseWithInvestigationTask(
          CaseType.FRAUD,
          userId,
          tenantId,
          createdCase.case_id,
          createdCase.priority,
        );
        await this.caseCreateService.createCaseWithInvestigationTask(
          CaseType.AML,
          userId,
          tenantId,
          createdCase.case_id,
          createdCase.priority,
        );
      }
      const createdAlert = await this.createNewAlert(data, tenantId, source, createdCase.case_id);
      return createdAlert;
    }
  }

  async getAlertTransactionalData(alertId: number) {
    this.loggerService.log(`Alert ID:  ${alertId}`, AlertService.name);
    if (alertId == null || alertId == undefined) {
      throw new BadRequestException('AlertID is missing');
    }

    const alert = await this.alertRepository.getAlertById(alertId);
    this.loggerService.log(`alert:  ${JSON.stringify(alert)}`, AlertService.name);
    this.loggerService.log(`Alert txtp:  ${alert.txtp}`, AlertService.name);
    if (alert) {
      const referenceIdData = await this.alertRepository.getReferenceId(alert.txtp);
      this.loggerService.log(`ReferenceId:  ${referenceIdData.referenceIdName}`, AlertService.name);
      const referenceId = extractReferenceId(alert.transaction as unknown as JsonValue, 10, 0, referenceIdData.referenceIdName);
      if (!referenceId) {
        throw new Error('ReferenceId not found in transaction data');
      }
      this.loggerService.log(`referenceId: ${referenceId}`, AlertService.name);
      const transactionData = await this.transactionDataRespository.getTransactionalData(referenceId);
      this.loggerService.log(`transactionData:  ${JSON.stringify(transactionData)}`, AlertService.name);
      if (!transactionData) throw new InternalServerErrorException(`transactionData not found for AlertId ${alertId}`);

      return transactionData;
    } else {
      throw new InternalServerErrorException(`Unable to fetch details for AlertId ${alertId}`);
    }
  }

  async getAlertDetails(alertId: number, tenantId: string, userId: string) {
    try {
      const alert = await this.alertRepository.getAlertById(alertId);

      if (!alert) {
        throw new NotFoundException(`Alert ${alertId} not found`);
      }

      if (alert.tenant_id !== tenantId) {
        throw new NotFoundException(`Alert ${alertId} is not accessible for this tenant`);
      }

      this.loggerService.log(`Alert ${alertId} opened by user ${userId} for review at ${new Date().toISOString()}`, AlertService.name);

      const { tenant_id, ...sanitizedAlert } = alert;
      return sanitizedAlert;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(`Failed to fetch alert ${alertId}: ${errorMessage}`, errorStack, AlertService.name);
      throw new InternalServerErrorException('Unable to retrieve alert details');
    }
  }

  async getAlertActionHistory(alertId: number, tenantId: string, userId: string) {
    const alert = await this.alertRepository.getAlertById(alertId);

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${alertId} was not found for tenant ${tenantId}.`);
    }

    const history = await this.eventLogService.getActionHistoryForAlert(alertId);
    return {
      alertId,
      tenantId,
      userId,
      history,
    };
  }
}
