import { Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AlertRepository } from '../repository/alert.repository';
import { IngestAlertDto } from './dto/IngestAlert.dto';
import { Alert, CaseCreationType, CaseStatus, Priority, Prisma } from '@prisma/client-cms';
import { CreateCaseDto } from '../case/dto/create-case.dto';
import { ConfigService } from '@nestjs/config';
import { UpdateAlertDTO } from './dto/UpdateAlert.dto';
import { extractReferenceId } from '../repository/utils/extractReferenceId';
import { JsonValue } from '../repository/utils/types/JsonValue';
import { CaseCreationService } from '../case/services/case-creation.service';
import { LoggingOrchestrationService } from '../logging-orchestration/logging-orchestration.service';
import { Outcome } from 'src/utils/types/outcome';
import { EventLogService } from '../event_log/eventLog.service';
import { GoldLakehouseService } from '../gold-lakehouse/gold-lakehouse.service';
import { transactionDataResponseDTO } from './dto/transactionHistory.dto';
import { AlertedTypology } from './types/alert.types';
@Injectable()
export class AlertService {
  constructor(
    private readonly loggerService: LoggerService,
    private readonly configService: ConfigService,
    private readonly alertRepository: AlertRepository,
    private readonly caseCreationService: CaseCreationService,
    private readonly loggingOrchestrationService: LoggingOrchestrationService,
    private readonly eventLogService: EventLogService,
    private readonly goldLakehouseService: GoldLakehouseService,
  ) {}

  async createNewAlert(alert: IngestAlertDto, tenantId: string, source: string, caseId: number): Promise<Alert | null> {
    this.loggerService.log('Start - Alert Creation', AlertService.name);
    const txtp = alert.transaction.TxTp;
    const message = alert.message || 'Suspicious activity detected';
    try {
      await this.alertRepository.createTransaction(tenantId, alert.transaction);
      const newAlert = await this.alertRepository.createAlert({
        tenantId,
        priority: Priority.NEW,
        source,
        txtp,
        message,
        report: alert.report,
        transaction: alert.transaction,
        networkMap: alert.networkMap,
        confidencePer: 0,
        caseId,
      });

      if (!newAlert) {
        throw new Error('Failed to create alert');
      }

      this.loggerService.log(`End - Alert Creation - ${newAlert.alert_id}`, AlertService.name);
      return newAlert;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(`Error creating alert: ${errorMessage}`, errorStack, AlertService.name);
      throw new InternalServerErrorException('Failed to create alert');
    }
  }

  async updateAlert(
    alertId: number,
    userId: string,
    updateData: UpdateAlertDTO,
    tx?: Prisma.TransactionClient,
    userName?: string,
  ): Promise<Alert> {
    this.loggerService.log(`Start - Alert Update - ${alertId}`, AlertService.name);
    try {
      // Fetch the alert to get tenant_id
      const existingAlert = await this.alertRepository.getAlertById(alertId, tx);
      if (!existingAlert) {
        throw new NotFoundException(`Alert with id ${alertId} not found`);
      }

      const updatedAlert = await this.alertRepository.updateAlert(alertId, updateData, tx);

      // Only include user name in message if it's available
      const actionMessage = userName ? `${alertId} - Triaged by user ${userName}` : `${alertId} - Triaged`;

      await this.loggingOrchestrationService.logActions({
        userId,
        operation: 'ALERT_UPDATED',
        entityName: AlertService.name,
        actionPerformed: actionMessage,
        outcome: Outcome.SUCCESS,
        tenantId: existingAlert.tenant_id,
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

  async handleAlertOrNALT(data: IngestAlertDto, userId: string, tenantId: string, source: string): Promise<Alert | null> {
    if (data.report.status === 'NALT') {
      const createdNALT = await this.createNewAlert(data, tenantId, source, 0);
      if (!createdNALT) {
        throw new Error('Failed to create NALT alert');
      }
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
      const createdCase = await this.caseCreationService.createCase(caseDetail, userId, tenantId, 'SUPERVISOR');
      this.loggerService.log(`handle AlertOrNALT CaseType: ${createdCase.case_type}`);
      const createdAlert = await this.createNewAlert(data, tenantId, source, createdCase.case_id);
      return createdAlert;
    }
  }

  async getAlertTransactionalData(
    alertId: number,
    tenantId: string,
    userJwt?: string,
  ): Promise<{ transactionData: transactionDataResponseDTO }> {
    this.loggerService.log(`Alert ID:  ${alertId}`, AlertService.name);

    const alert = await this.alertRepository.getAlertById(alertId);
    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    if (alert.tenant_id !== tenantId) {
      throw new NotFoundException(`Alert ${alertId} is not accessible for this tenant`);
    }

    const referenceIdData = await this.alertRepository.getReferenceId(alert.txtp, tenantId);
    const referenceId = extractReferenceId(alert.transaction as unknown as JsonValue, 10, 0, referenceIdData.referenceIdName);
    if (!referenceId) {
      throw new Error('ReferenceId not found in transaction data');
    }

    const transactiondataSql = `
      SELECT * from transaction_detail where end_to_end_id = $1`;

    const transactionData = await this.goldLakehouseService.runSqlQuery(transactiondataSql, 1000, [referenceId], userJwt);

    if (!transactionData.data) {
      throw new InternalServerErrorException(`Transaction history data not found for AlertId ${alertId}`);
    }
    this.loggerService.log(`Fetched transaction data for Alert ID ${alertId}: ${JSON.stringify(transactionData)}`, AlertService.name);
    return { transactionData };
  }

  private extractAlertedTypologies(alertData: Prisma.JsonValue): AlertedTypology[] {
    try {
      if (!alertData || typeof alertData !== 'object') {
        return [];
      }

      const data = alertData as Record<string, any>;
      const { tadpResult } = data;

      if (!tadpResult || typeof tadpResult !== 'object') {
        return [];
      }

      const { typologyResult } = tadpResult as Record<string, any>;

      if (!Array.isArray(typologyResult)) {
        return [];
      }

      const alertedTypologies = typologyResult
        .filter((typ) => {
          if (!typ || typeof typ !== 'object') return false;
          const result = typeof typ.result === 'number' ? typ.result : 0;
          const alertThreshold = typ.workflow?.alertThreshold ?? 0;
          return result >= alertThreshold;
        })
        .map((typ) => ({
          id: typ.id ?? 'unknown',
          cfg: typ.cfg ?? 'Unknown',
          result: typeof typ.result === 'number' ? typ.result : 0,
          alertThreshold: typ.workflow?.alertThreshold ?? 0,
          interdictionThreshold: typ.workflow?.interdictionThreshold ?? 0,
          ruleResults: Array.isArray(typ.ruleResults) ? typ.ruleResults : [],
        }));

      return alertedTypologies;
    } catch (error) {
      this.loggerService.error('Error extracting alerted typologies:', error, AlertService.name);
      return [];
    }
  }

  async getAlertDetails(
    alertId: number,
    tenantId: string,
    userId: string,
  ): Promise<{
    priority: Priority | null;
    source: string | null;
    created_at: Date;
    alert_id: number | null;
    priority_score: number | null;
    alert_type: string | null;
    prediction_outcome: string | null;
    txtp: string;
    message: string;
    alert_data: Prisma.JsonValue;
    transaction: Prisma.JsonValue;
    network_map: Prisma.JsonValue;
    confidence_per: number;
    case_id: number | null;
    alerted_typologies: AlertedTypology[];
  } | null> {
    try {
      const alert = await this.alertRepository.getAlertById(alertId);

      if (!alert) {
        throw new NotFoundException(`Alert ${alertId} not found`);
      }

      if (alert.tenant_id !== tenantId) {
        throw new NotFoundException(`Alert ${alertId} is not accessible for this tenant`);
      }

      this.loggerService.log(`Alert ${alertId} opened by user ${userId} for review at ${new Date().toISOString()}`, AlertService.name);

      const alertedTypologies = this.extractAlertedTypologies(alert.alert_data);

      const { tenant_id: tenantIdDb, ...sanitizedAlert } = alert;
      return {
        ...sanitizedAlert,
        alerted_typologies: alertedTypologies,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.loggerService.error(`Failed to fetch alert ${alertId}: ${errorMessage}`, errorStack, AlertService.name);
      throw new InternalServerErrorException('Unable to retrieve alert details');
    }
  }

  async getAlertActionHistory(
    alertId: number,
    tenantId: string,
    userId: string,
  ): Promise<{
    alertId: number;
    tenantId: string;
    userId: string;
    history: Array<{
      event_log_id: number;
      user_id: string;
      operation: string;
      entity_name: string;
      action_performed: string;
      outcome: string;
      performed_at: Date;
    }>;
  }> {
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
