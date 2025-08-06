import {
  Injectable,
  NotFoundException,
  InternalServerErrorException,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { CloseAlertDto } from './dto/close-alert.dto';
import { AuditLogService } from '../audit/auditLog.service';
import {
  AlertStatus,
  Priority,
  CaseCreationType,
  CaseStatus,
  CaseType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class TriageService {
  private readonly logger = new Logger(TriageService.name);

  constructor(
    private prisma: PrismaService,
    private audit: AuditLogService,
  ) {}

  async handleNewAlert(dto: SubmitAlertDto, userId: string, tenantId: string) {
    // Determine the alert source
    const source = 'REST API';
    // Determine the alert type (txtp)
    let txtp = '';
    if (
      dto.result.report &&
      typeof (dto.result.report as any).txtp === 'string'
    ) {
      txtp = (dto.result.report as any).txtp;
    } else if (
      dto.result.transaction &&
      typeof (dto.result.transaction as any).txtp === 'string'
    ) {
      txtp = (dto.result.transaction as any).txtp;
    } else if (
      dto.result.networkMap &&
      typeof (dto.result.networkMap as any).txtp === 'string'
    ) {
      txtp = (dto.result.networkMap as any).txtp;
    }

    try {
      const alert = await this.prisma.alert.create({
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
        actionPerformed: `Created new alert ${alert.alert_id}`,
        outcome: 'SUCCESS',
      });

      return alert;
    } catch (error) {
      this.logger.error('Error creating alert', error);
      throw new InternalServerErrorException('Failed to create alert');
    }
  }

  async updateAlertData(
    alertId: string,
    dto: UpdateAlertDto,
    userId: string,
    tenantId: string,
  ) {
    const alert = await this.prisma.alert.findUnique({
      where: {
        alert_id: alertId,
        tenant_id: tenantId,
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    if (alert.tenant_id !== tenantId) {
      throw new NotFoundException(
        `Alert ${alertId} not accessible for this tenant`,
      );
    }

    if (alert.alert_status === AlertStatus.CLOSED) {
      throw new BadRequestException(
        `Alert ${alertId} is closed status and can not be updated`,
      );
    }

    try {
      const updated = await this.prisma.alert.update({
        where: {
          alert_id: alertId,
          tenant_id: tenantId,
        },
        data: {
          confidence_per: dto.confidence_per,
          priority: dto.priority,
        },
      });

      await this.audit.logAction({
        userId,
        operation: 'ALERT_UPDATED',
        entityName: 'Alert',
        actionPerformed:
          `Updated alert ${alertId}` +
          (dto.confidence_per !== undefined
            ? `, confidence_per=${dto.confidence_per}`
            : '') +
          (dto.priority !== undefined ? `, priority=${dto.priority}` : ''),
        outcome: 'SUCCESS',
      });

      return updated;
    } catch (error) {
      this.logger.error(`Update failed for alert ${alertId}`, error);
      throw new InternalServerErrorException('Failed to update alert');
    }
  }

  async manualCloseAlert(
    alertId: string,
    closeAlertDto: CloseAlertDto,
    userId: string,
    tenantId: string,
  ) {
    const alert = await this.prisma.alert.findUnique({
      where: {
        alert_id: alertId,
        tenant_id: tenantId,
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    if (alert.tenant_id !== tenantId) {
      throw new NotFoundException(
        `Alert ${alertId} not accessible for this tenant`,
      );
    }

    if (alert.alert_status === AlertStatus.CLOSED) {
      throw new BadRequestException(`Alert ${alertId} is already closed`);
    }

    try {
      const updated = await this.prisma.alert.update({
<<<<<<< HEAD
        where: {
          alert_id: alertId,
          tenant_id: tenantId,
        },
        data: { alert_status: status },
=======
        where: { alert_id: alertId },
        data: { alert_status: AlertStatus.CLOSED },
>>>>>>> 0f8431d (feat(manual-alert): add close alert in case of false positive)
      });

      await this.audit.logAction({
        userId,
        operation: 'ALERT_CLOSED',
        entityName: 'Alert',
        actionPerformed: `Closed alert ${alertId} with reason: ${closeAlertDto.reason}  at ${new Date().toISOString()}`,
        outcome: 'SUCCESS',
      });

      return updated;
    } catch (error) {
      this.logger.error(`Close failed for alert ${alertId}`, error);
      throw new InternalServerErrorException('Failed to close alert');
    }
  }
<<<<<<< HEAD
=======

  async investigateAlert(
    alertId: string,
    caseType: CaseType,
    userId: string,
    tenantId: string,
  ) {
    const alert = await this.prisma.alert.findUnique({
      where: { alert_id: alertId },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }

    if (alert.tenant_id !== tenantId) {
      throw new NotFoundException(
        `Alert ${alertId} not accessible for this tenant`,
      );
    }

    const casePriority = alert.priority ?? Priority.LOW;

    try {
      const createdCase = await this.prisma.case.create({
        data: {
          case_creator_user_id: userId,
          case_owner_user_id: userId,
          tenant_id: tenantId,
          priority: casePriority,
          status: CaseStatus.DRAFT,
          parent_id: null,
          case_type: caseType,
          case_creation_type: CaseCreationType.MANUAL,
        },
      });

      const updatedAlert = await this.prisma.alert.update({
        where: { alert_id: alertId },
        data: {
          alert_status: AlertStatus.SENT_FOR_INVESTIGATION,
          case_id: createdCase.case_id,
        },
      });

      await this.audit.logAction({
        userId,
        operation: 'ALERT_SENT_FOR_INVESTIGATION',
        entityName: 'Alert',
        actionPerformed: `Created case ${createdCase.case_id} for alert ${alertId}`,
        outcome: 'SUCCESS',
      });

      return updatedAlert;
    } catch (error) {
      this.logger.error(
        `Failed to update alert ${alertId} for investigation`,
        error,
      );
      throw new InternalServerErrorException(
        'Failed to update alert for investigation',
      );
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
    const {
      tenantId,
      priority,
      status,
      type,
      search,
      page,
      limit,
      sortBy,
      sortOrder,
    } = params;

    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('Limit must be a positive integer');
    }

    // Validate sortBy
    const validSortFields = ['priority', 'created_at'];
    if (!validSortFields.includes(sortBy)) {
      throw new BadRequestException(
        `Invalid sortBy field: ${sortBy}. Must be one of ${validSortFields.join(', ')}`,
      );
    }
    if (!['asc', 'desc'].includes(sortOrder)) {
      throw new BadRequestException('sortOrder must be "asc" or "desc"');
    }

    const whereClause: any = {
      tenant_id: tenantId,
    };

    if (priority) {
      if (
        !Object.values(Priority).includes(priority.toUpperCase() as Priority)
      ) {
        throw new BadRequestException(`Invalid priority: ${priority}`);
      }
      whereClause.priority = priority.toUpperCase();
    }

    if (status) {
      if (
        !Object.values(AlertStatus).includes(
          status.toUpperCase() as AlertStatus,
        )
      ) {
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

      if (
        Object.values(AlertStatus).includes(search.toUpperCase() as AlertStatus)
      ) {
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
        throw new NotFoundException(
          `Alert ${alertId} is not accessible for this tenant`,
        );
      }

      this.logger.log(
        `Alert ${alertId} opened by user ${userId} at ${new Date().toISOString()}`,
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tenant_id, ...sanitizedAlert } = alert;
      return sanitizedAlert;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      this.logger.error(`Failed to fetch alert ${alertId}`, error);
      throw new InternalServerErrorException(
        'Unable to retrieve alert details',
      );
    }
  }
>>>>>>> 0f8431d (feat(manual-alert): add close alert in case of false positive)
}
