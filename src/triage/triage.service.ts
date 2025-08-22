/* eslint-disable prettier/prettier */
import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { CloseAlertDto } from './dto/close-alert.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConvertAlertToCase } from './dto/convert-alert-to-case.dto';
import { AuditLogService } from '../audit/auditLog.service';
import { Alert, AlertStatus, AlertType, Priority, CaseCreationType, CaseType, CaseStatus } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TriageService {
  constructor(
    private readonly logger: LoggerService,
    private prisma: PrismaService,
    private audit: AuditLogService,
  ) {}

  async handleNewAlert(dto: SubmitAlertDto, userId: string, tenantId: string, source: string) {
    // Determine the transaction type (txtp)
    const txtp = typeof dto?.result?.transaction?.TxTp === 'string' ? dto.result.transaction.TxTp : '';

    try {
      const newAlert = await this.prisma.alert.create({
        data: {
          tenant_id: tenantId,
          priority: Priority.LOW,
          source: source,
          txtp: txtp,
          alert_status: AlertStatus.NEW,
          message: String(dto.result.message),
          alert_data: dto.result.report,
          transaction: dto.result.transaction,
          network_map: dto.result.networkMap,
          confidence_per: 0,
        },
      });
      await this.audit.logAction({
        userId,
        operation: 'ALERT_CREATED',
        entityName: 'Alert',
        actionPerformed: `Created new alert ${newAlert.alert_id}`,
        outcome: 'SUCCESS',
      });

      return newAlert;
    } catch (error) {
      this.logger.error('Error creating alert', error);
      await this.audit.logAction({
        userId,
        operation: 'ALERT_CREATION_FAILED',
        entityName: 'Alert',
        actionPerformed: `Failed to create alert: ${error.message}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('Failed to create alert');
    }
  }

  async updateAlertData(alertId: string, dto: UpdateAlertDto, userId: string, tenantId: string) {
    const existingAlert = await this.prisma.alert.findFirst({
      where: {
        alert_id: alertId,
        tenant_id: tenantId,
      },
    });

    if (!existingAlert) {
      throw new NotFoundException(`Alert with ID ${alertId} was not found for tenant ${tenantId}.`);
    }

    if (existingAlert.alert_status === AlertStatus.CLOSED) {
      throw new BadRequestException(`Alert ${alertId} is closed status and can not be updated`);
    }

    try {
      const updatedAlert = await this.prisma.alert.update({
        where: { alert_id: alertId },
        data: {
          confidence_per: dto.confidence_per,
          priority: dto.priority,
          alert_type: dto.alertType,
        },
      });

      await this.audit.logAction({
        userId,
        operation: 'ALERT_UPDATED',
        entityName: 'Alert',
        actionPerformed:
          `Updated alert ${alertId}` +
          (dto.confidence_per !== undefined ? `, confidence_per=${dto.confidence_per}` : '') +
          (dto.priority !== undefined ? `, priority=${dto.priority}` : '') +
          (dto.alertType !== undefined ? `, alert_type=${dto.alertType}` : ''),
        outcome: 'SUCCESS',
      });

      return updatedAlert;
    } catch (error) {
      this.logger.error(`Update failed for alert ${alertId}`, error);
      await this.audit.logAction({
        userId,
        operation: 'ALERT_UPDATE_FAILED',
        entityName: 'Alert',
        actionPerformed: `Failed to update alert ${alertId}: ${error.message}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('Failed to update alert');
    }
  }

  async manualCloseAlert(alertId: string, closeAlertDto: CloseAlertDto, userId: string, tenantId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: {
        alert_id: alertId,
        tenant_id: tenantId,
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${alertId} was not found for tenant ${tenantId}.`);
    }

    if (alert.alert_status === AlertStatus.CLOSED) {
      throw new BadRequestException(`Alert ${alertId} is already closed`);
    }

    try {
      const closedAlert = await this.prisma.alert.update({
        where: { alert_id: alertId },
        data: { alert_status: AlertStatus.CLOSED },
      });

      await this.audit.logAction({
        userId,
        operation: 'ALERT_CLOSED',
        entityName: 'Alert',
        actionPerformed: `Closed alert ${alertId} with reason: ${closeAlertDto.reason}  at ${new Date().toISOString()}`,
        outcome: 'SUCCESS',
      });

      return closedAlert;
    } catch (error) {
      this.logger.error(`Close failed for alert ${alertId}`, error);
      await this.audit.logAction({
        userId,
        operation: 'ALERT_CLOSE_FAILED',
        entityName: 'Alert',
        actionPerformed: `Failed to close alert ${alertId}: ${error.message}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('Failed to close alert');
    }
  }

  async getAlertsForUser(params: {
    tenantId: string;
    priority?: string;
    status?: string;
    type?: string;
    search?: string;
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }) {
    const { tenantId, priority, status, type, search, page, limit, sortBy, sortOrder } = params;

    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('Limit must be a positive integer');
    }

    // Validate sortBy
    const validSortFields = ['priority', 'created_at'];
    if (!validSortFields.includes(sortBy)) {
      throw new BadRequestException(`Invalid sortBy field: ${sortBy}. Must be one of ${validSortFields.join(', ')}`);
    }
    if (!['asc', 'desc'].includes(sortOrder)) {
      throw new BadRequestException('sortOrder must be "asc" or "desc"');
    }

    const whereClause: any = {
      tenant_id: tenantId,
    };

    if (priority) {
      if (!Object.values(Priority).includes(priority.toUpperCase() as Priority)) {
        throw new BadRequestException(`Invalid priority: ${priority}`);
      }
      whereClause.priority = priority.toUpperCase();
    }

    if (status) {
      if (!Object.values(AlertStatus).includes(status.toUpperCase() as AlertStatus)) {
        throw new BadRequestException(`Invalid status: ${status}`);
      }
      whereClause.alert_status = status.toUpperCase();
    }

    if (type) {
      whereClause.txtp = type;
    }

    if (search) {
      whereClause.OR = [];

      if (search.length === 36) {
        whereClause.OR.push({ alert_id: { equals: search } });
        whereClause.OR.push({ case_id: { equals: search } });
      }

      whereClause.OR.push({
        txtp: { contains: search, mode: 'insensitive' },
      });

      if (Object.values(Priority).includes(search.toUpperCase() as Priority)) {
        whereClause.OR.push({
          priority: { equals: search.toUpperCase() as Priority },
        });
      }

      if (Object.values(AlertStatus).includes(search.toUpperCase() as AlertStatus)) {
        whereClause.OR.push({
          alert_status: { equals: search.toUpperCase() as AlertStatus },
        });
      }
    }

    try {
      const alerts = await this.prisma.alert.findMany({
        where: whereClause,
        orderBy: { [sortBy]: sortOrder },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          alert_id: true,
          txtp: true,
          priority: true,
          confidence_per: true,
          alert_status: true,
          created_at: true,
        },
      });

      const totalCount = await this.prisma.alert.count({ where: whereClause });

      return {
        data: alerts,
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      };
    } catch (error) {
      this.logger.error('Failed to fetch alerts', error);
      await this.audit.logAction({
        userId: params.tenantId, // If you have a userId, use it; otherwise, use tenantId for traceability
        operation: 'ALERTS_FETCH_FAILED',
        entityName: 'Alert',
        actionPerformed: `Failed to fetch alerts for tenant ${params.tenantId}: ${error.message}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('Unable to fetch alert list');
    }
  }

  async getAlertDetails(alertId: string, tenantId: string, userId: string) {
    try {
      const alert = await this.prisma.alert.findUnique({
        where: { alert_id: alertId },
        select: {
          alert_id: true,
          txtp: true,
          priority: true,
          confidence_per: true,
          alert_status: true,
          created_at: true,
          source: true,
          message: true,
          alert_data: true,
          transaction: true,
          network_map: true,
          case_id: true,
          tenant_id: true,
        },
      });

      if (!alert) {
        throw new NotFoundException(`Alert ${alertId} not found`);
      }

      if (alert.tenant_id !== tenantId) {
        throw new NotFoundException(`Alert ${alertId} is not accessible for this tenant`);
      }

      this.logger.log(`Alert ${alertId} opened by user ${userId} for review at ${new Date().toISOString()}`);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tenant_id, ...sanitizedAlert } = alert;
      return sanitizedAlert;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      this.logger.error(`Failed to fetch alert ${alertId}`, error);
      await this.audit.logAction({
        userId,
        operation: 'ALERT_FETCH_FAILED',
        entityName: 'Alert',
        actionPerformed: `Failed to fetch alert ${alertId}: ${error.message}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('Unable to retrieve alert details');
    }
  }

  async convertToCase(alertId: string, convertAlertToCase: ConvertAlertToCase, userId: string, tenantId: string) {
    const alert = await this.prisma.alert.findUnique({
      where: { alert_id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    if (alert.tenant_id !== tenantId) {
      throw new NotFoundException(`Alert ${alertId} not accessible for this tenant`);
    }

    if (alert.alert_status === AlertStatus.CLOSED) {
      throw new BadRequestException(`Alert ${alertId} is already closed`);
    }

    if (alert.alert_status === AlertStatus.CONVERTED) {
      throw new BadRequestException(`Alert ${alertId} is already converted to a case`);
    }

    const casePriority = convertAlertToCase.priority ?? alert.priority;
    try {
      const newCase = await this.prisma.case.create({
        data: {
          case_creator_user_id: userId,
          case_owner_user_id: userId,
          tenant_id: alert.tenant_id,
          priority: casePriority,
          status: CaseStatus.DRAFT,
          parent_id: null,
          case_type: convertAlertToCase.caseType,
          case_creation_type: CaseCreationType.MANUAL,
        },
      });

      await this.prisma.alert.update({
        where: { alert_id: alertId },
        data: {
          alert_status: AlertStatus.CONVERTED,
          case_id: newCase.case_id,
        },
      });

      await this.audit.logAction({
        userId,
        operation: 'ALERT_CONVERTED_TO_CASE',
        entityName: 'Alert',
        actionPerformed: `Converted alert ${alertId} to case ${newCase.case_id}`,
        outcome: 'SUCCESS',
      });

      return newCase;
    } catch (error) {
      this.logger.error(`Failed to create convert alert ${alertId} to case`, error);
      await this.audit.logAction({
        userId,
        operation: 'ALERT_CONVERT_TO_CASE_FAILED',
        entityName: 'Alert',
        actionPerformed: `Failed to convert alert ${alertId} to case: ${error.message}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('Failed to convert alert to case');
    }
  }

  async handleAITriage(alertId: string, dto: SubmitAlertDto, userId: string, tenantId: string): Promise<void> {
    try {
      // Story 1G
      // If confidenceThreshold environment variable is not set, default to 100% → ensures low-confidence predictions always go to investigation.
      const confidenceThreshold = process.env.CONFIDENCE_THRESHOLD ? Number(process.env.CONFIDENCE_THRESHOLD) : 100;

      // === Check if interdiction is enabled and determine if transaction occurred ===
      const interdictionEnabled = process.env.CLIENT_SYSTEM_INTERDICTION_ENABLED === 'true';
      let transactionOccurred = true;

      if (interdictionEnabled) {
        const tadpResult = dto?.result?.report?.tadpResult;

        if (
          typeof tadpResult === 'object' &&
          tadpResult !== null &&
          'typologyResult' in tadpResult &&
          Array.isArray((tadpResult as any).typologyResult)
        ) {
          const typology = (tadpResult as any).typologyResult[0];
          const result = typeof typology?.result === 'number' ? typology.result : undefined;
          const interdictionThreshold =
            typeof typology?.workflow?.interdictionThreshold === 'number' ? typology.workflow.interdictionThreshold : undefined;

          if (result !== undefined && interdictionThreshold !== undefined && result > interdictionThreshold) {
            transactionOccurred = false;
          }
        }
      }

      // Story 1A
      // === 1. Get AI prediction and update alert ===
      const prediction = await this.predictAlert();
      const {
        confidence_per: predictedConfidence,
        priority: predictedPriority,
        alertType: predictedAlertType,
        isTruePositive: predictedTruePositive,
      } = prediction;

      const updateDto = new UpdateAlertDto();
      updateDto.priority = predictedPriority;
      updateDto.alertType = predictedAlertType;
      updateDto.confidence_per = predictedConfidence;
      await this.updateAlertData(alertId, updateDto, userId, tenantId);

      // Story 1F
      // === 2. Confidence below threshold → Investigation case ===
      if (predictedConfidence < confidenceThreshold) {
        await this.createInvestigationCase(alertId, userId, tenantId, prediction);
        return;
      }

      // Story 1B
      // === 3. High confidence & False Positive → Auto-close as REFUTED ===
      if (predictedConfidence >= confidenceThreshold && !predictedTruePositive) {
        await this.autoCloseAlert(alertId, AlertStatus.AUTOCLOSED_REFUTED, userId);
        return;
      }
      // === 4. High confidence & True Positive ===
      if (predictedTruePositive) {
        // Story 1I
        // Create master FRAUD_AND_AML case + child FRAUD & AML cases
        if (predictedAlertType === AlertType.FRAUD_AND_AML) {
          const masterCase = await this.createInvestigationCase(alertId, userId, tenantId, prediction, CaseType.FRAUD_AND_AML);
          await this.createInvestigationCase(alertId, userId, tenantId, prediction, CaseType.FRAUD, masterCase.case_id);
          await this.createInvestigationCase(alertId, userId, tenantId, prediction, CaseType.AML, masterCase.case_id);
          return;
        }

        // Story 1E
        // If AML suspicion create case
        if (predictedAlertType === AlertType.AML) {
          await this.createInvestigationCase(alertId, userId, tenantId, prediction, CaseType.AML);
          return;
        }

        // If fraud and transaction occured create case else autoclose
        if (predictedAlertType === AlertType.FRAUD) {
          // Story 1C
          if (!transactionOccurred) {
            await this.autoCloseAlert(alertId, AlertStatus.AUTOCLOSED_CONFIRMED, userId);
            return;
          }
          // Story 1D
          await this.createInvestigationCase(alertId, userId, tenantId, prediction, CaseType.FRAUD);
          return;
        }
      }
    } catch (error) {
      this.logger.error(`AI triage failed for alert ${alertId}`, error.stack);
      await this.audit.logAction({
        userId,
        operation: 'AI_TRIAGE_FAILED',
        entityName: 'Alert',
        actionPerformed: `AI triage failed for alert ${alertId}: ${error.message}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('AI triage process failed');
    }
  }

  private async autoCloseAlert(alertId: string, status: AlertStatus, userId: string) {
    try {
      await this.prisma.alert.update({
        where: { alert_id: alertId },
        data: { alert_status: status },
      });
      await this.audit.logAction({
        userId,
        operation: 'ALERT_AUTO_CLOSED',
        entityName: 'Alert',
        actionPerformed: `Auto closed alert ${alertId} with status: ${status} at ${new Date().toISOString()}`,
        outcome: 'SUCCESS',
      });
    } catch (error) {
      this.logger.error(`Auto close failed for alert ${alertId}`, error);
      await this.audit.logAction({
        userId,
        operation: 'ALERT_AUTO_CLOSE_FAILED',
        entityName: 'Alert',
        actionPerformed: `Failed to auto close alert ${alertId}: ${error.message}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('Failed to auto close alert');
    }
  }

  async createInvestigationCase(
    alertId: string,
    userId: string,
    tenantId: string,
    prediction?: any,
    caseType?: CaseType | null,
    parentId?: string | null,
  ): Promise<Alert> {
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        const createdCase = await tx.case.create({
          data: {
            case_creator_user_id: userId,
            case_owner_user_id: userId,
            tenant_id: tenantId,
            priority: prediction?.priority ?? null,
            status: CaseStatus.DRAFT,
            parent_id: parentId ?? null,
            case_type: caseType ?? null,
            case_creation_type: CaseCreationType.AUTOMATIC_SYSTEM,
          },
        });

        // Update alert
        const updatedAlert = await tx.alert.update({
          where: { alert_id: alertId },
          data: {
            alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
            priority: prediction?.priority,
            ...(parentId ? {} : { case_id: createdCase.case_id }),
          },
        });

        return { createdCase, updatedAlert };
      });

      await this.audit.logAction({
        userId,
        operation: 'ALERT_SENT_FOR_INVESTIGATION',
        entityName: 'Alert',
        actionPerformed: `Created case ${result.createdCase.case_id} for alert ${alertId}`,
        outcome: 'SUCCESS',
      });

      return result.updatedAlert; // return updated alert instead of case
    } catch (error) {
      this.logger.error(`Failed to create investigation case for alert ${alertId}. Error: ${error.message}`, error.stack);
      await this.audit.logAction({
        userId,
        operation: 'ALERT_INVESTIGATION_FAILED',
        entityName: 'Alert',
        actionPerformed: `Failed to create investigation case for alert ${alertId}: ${error.message}`,
        outcome: 'FAILURE',
      });
      throw new InternalServerErrorException('Failed to create investigation case');
    }
  }

  private async predictAlert(): Promise<{
    priority: Priority;
    alertType: AlertType;
    confidence_per: number;
    isTruePositive: boolean; // true = real alarm, false = false alarm
  }> {
    // --- Placeholder AI Prediction ---
    return {
      priority: Priority.MEDIUM,
      alertType: AlertType.FRAUD_AND_AML,
      confidence_per: 97,
      isTruePositive: true,
    };
  }
}
