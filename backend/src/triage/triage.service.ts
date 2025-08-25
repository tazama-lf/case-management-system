import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { CloseAlertDto } from './dto/close-alert.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { ConvertAlertToCase } from './dto/convert-alert-to-case.dto';
import { AuditLogService } from '../audit/auditLog.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AlertStatus, Priority, CaseCreationType, CaseStatus, AlertType, Prisma } from '@prisma/client';

@Injectable()
export class TriageService {
  constructor(
    private readonly logger: LoggerService,
    private prisma: PrismaService,
    private audit: AuditLogService,
  ) {}

  async handleNewAlert(dto: SubmitAlertDto, userId: string, tenantId: string, source: string) {
    // Determine the alert type (txtp)
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
      throw new InternalServerErrorException('Failed to close alert');
    }
  }

  async getAlertsForUser(params: {
    tenantId: string;
    priority?: string;
    status?: string;
    type?: string;
    alertType?: string;
    search?: string;
    source?: string;
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }) {
    const { tenantId, priority, status, search, source, page, limit, sortBy, sortOrder } = params;
    let type = params.type;
    const alertType = params.alertType;

    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('Limit must be a positive integer');
    }

    // Validate sortBy - allow sorting by any field in the select clause
    const validSortFields = ['alert_id', 'txtp', 'priority', 'confidence_per', 'alert_status', 'source', 'alert_type', 'created_at'];
    if (!validSortFields.includes(sortBy)) {
      throw new BadRequestException(`Invalid sortBy field: ${sortBy}. Must be one of ${validSortFields.join(', ')}`);
    }
    if (!['asc', 'desc'].includes(sortOrder)) {
      throw new BadRequestException('sortOrder must be "asc" or "desc"');
    }

    const whereClause: Prisma.AlertWhereInput = {
      tenant_id: tenantId,
    };

    if (priority) {
      if (!Object.values(Priority).includes(priority.toUpperCase() as Priority)) {
        throw new BadRequestException(`Invalid priority: ${priority}`);
      }
      whereClause.priority = priority.toUpperCase() as Priority;
    }

    if (status) {
      if (!Object.values(AlertStatus).includes(status.toUpperCase() as AlertStatus)) {
        throw new BadRequestException(`Invalid status: ${status}`);
      }
      whereClause.alert_status = status.toUpperCase() as AlertStatus;
    }

    if (alertType) {
      if (!Object.values(AlertType).includes(alertType.toUpperCase() as AlertType)) {
        throw new BadRequestException(`Invalid alertType: ${alertType}`);
      }
      whereClause.alert_type = alertType.toUpperCase() as AlertType;
    } else if (type && Object.values(AlertType).includes(type.toUpperCase() as AlertType)) {
      // If alertType is not present, but type is, and it's a valid AlertType, use it as alert_type
      whereClause.alert_type = type.toUpperCase() as AlertType;
      // Unset type so it's not used for txtp filtering
      type = undefined;
    }

    if (type) {
      whereClause.txtp = type;
    }
    if (source) {
      whereClause.source = source;
    }

    if (search) {
      const searchConditions: Prisma.AlertWhereInput[] = [
        { txtp: { contains: search, mode: 'insensitive' } },
        { source: { contains: search, mode: 'insensitive' } },
      ];

      // Very basic UUID check. A proper validation should be used in a real app.
      if (search.length === 36) {
        searchConditions.push({ alert_id: { equals: search } });
        searchConditions.push({ case_id: { equals: search } });
      }

      if (Object.values(Priority).includes(search.toUpperCase() as Priority)) {
        searchConditions.push({
          priority: { equals: search.toUpperCase() as Priority },
        });
      }

      if (Object.values(AlertStatus).includes(search.toUpperCase() as AlertStatus)) {
        searchConditions.push({
          alert_status: { equals: search.toUpperCase() as AlertStatus },
        });
      }
      if (Object.values(AlertType).includes(search.toUpperCase() as AlertType)) {
        searchConditions.push({
          alert_type: { equals: search.toUpperCase() as AlertType },
        });
      }
      whereClause.OR = searchConditions;
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
          source: true,
          alert_type: true,
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
    const caseOwner = convertAlertToCase.caseOwnerUserId ?? userId;
    try {
      const newCase = await this.prisma.case.create({
        data: {
          case_creator_user_id: userId,
          case_owner_user_id: caseOwner,
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
      throw new InternalServerErrorException('Failed to convert alert to case');
    }
  }

  async getAlertActionHistory(alertId: string, tenantId: string, userId: string) {
    const alert = await this.prisma.alert.findFirst({
      where: {
        alert_id: alertId,
        tenant_id: tenantId,
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert with ID ${alertId} was not found for tenant ${tenantId}.`);
    }

    const history = await this.audit.getActionHistoryForAlert(alertId);
    return {
      alertId,
      tenantId,
      userId,
      history,
    };
  }

  async getFilterOptions(tenantId: string) {
    try {
      const sourceResult = await this.prisma.alert.findMany({
        where: { tenant_id: tenantId },
        select: { source: true },
        distinct: ['source'],
      });
      const sources = sourceResult.map((s) => s.source).filter(Boolean) as string[];

      return {
        priorities: Object.values(Priority),
        statuses: Object.values(AlertStatus),
        alertTypes: Object.values(AlertType),
        sources,
      };
    } catch (error) {
      this.logger.error(`Failed to get filter options for tenant ${tenantId}`, error);
      throw new InternalServerErrorException('Unable to retrieve filter options');
    }
  }
}
