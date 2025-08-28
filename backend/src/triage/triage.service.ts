import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SubmitAlertDto } from './dto/submit-alert.dto';
import { UpdateAlertDto } from './dto/update-alert.dto';
import { CloseAlertDto } from './dto/close-alert.dto';
import { CreateCaseDto } from '../case/dto/create-case.dto';
import { CreateCommentDto } from '../comment/dto/create-comment.dto';
import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AuditLogService } from '../audit/auditLog.service';
import { CaseService } from '../case/case.service';
import { TaskService } from '../task/task.service';
import { CommentService } from '../comment/comment.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Priority, CaseCreationType, CaseStatus, AlertType, Prisma, TaskStatus } from '@prisma/client';
import { Outcome } from 'src/audit/types/outcome';

@Injectable()
export class TriageService {
  constructor(
    private readonly logger: LoggerService,
    private prisma: PrismaService,
    private audit: AuditLogService,
    private caseService: CaseService,
    private taskService: TaskService,
    private commentService: CommentService,
    private configService: ConfigService,
  ) {}

  async handleNewAlert(alert: SubmitAlertDto, userId: string, tenantId: string, source: string) {
    const txtp = alert.transaction.TxTp;

    try {
      const systemUuid = this.configService.get<string>('SYSTEM_UUID', userId);
      const caseDetail: CreateCaseDto = {
        tenantId,
        caseCreatorUserId: userId,
        caseOwnerUserId: systemUuid,
        status: CaseStatus.DRAFT_00,
        priority: Priority.NEW,
        caseCreationType: CaseCreationType.AUTOMATIC_SYSTEM,
      };

      const createdCase = await this.caseService.createCase(caseDetail, userId);

      const createdTask = await this.taskService.createTask(
        {
          caseId: createdCase.case_id,
          assignedUserId: userId,
          status: TaskStatus.ASSIGNED_10,
          name: 'Triage Alert',
          description: `Created for triaging alert for case:${createdCase.case_id}`,
        },
        userId,
      );

      this.logger.log(`Task created: ${createdTask.task_id}`, TriageService.name);

      const newAlert = await this.prisma.alert.create({
        data: {
          tenant_id: tenantId,
          priority: Priority.NEW,
          source: source,
          txtp: txtp,
          message: String(alert.message),
          alert_data: JSON.parse(JSON.stringify(alert.report)),
          transaction: JSON.parse(JSON.stringify(alert.transaction)),
          network_map: JSON.parse(JSON.stringify(alert.networkMap)),
          confidence_per: 0,
          case_id: createdCase.case_id,
        },
      });
      await this.audit.logAction({
        userId,
        operation: 'ALERT_CREATED',
        entityName: 'Alert',
        actionPerformed: `Created new alert ${newAlert.alert_id}`,
        outcome: Outcome.SUCCESS,
      });

      return newAlert;
    } catch (error) {
      this.logger.error(`Error creating alert :${error.message}`, TriageService.name);
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

    try {
      const updatedAlert = await this.prisma.alert.update({
        where: { alert_id: alertId },
        data: {
          confidence_per: dto.confidence_per,
          priority: dto.priority,
          alert_type: dto.alertType,
          prediction_outcome: dto.predictionOutcome,
        },
      });

      const createCommentDto = new CreateCommentDto();
      createCommentDto.caseId = updatedAlert.case_id;
      createCommentDto.note = dto.note;

      this.commentService.addComment(createCommentDto, userId);

      await this.audit.logAction({
        userId,
        operation: 'ALERT_UPDATED',
        entityName: 'Alert',
        actionPerformed:
          `Updated alert ${alertId}` +
          (dto.confidence_per !== undefined ? `, confidence_per=${dto.confidence_per}` : '') +
          (dto.priority !== undefined ? `, priority=${dto.priority}` : '') +
          (dto.alertType !== undefined ? `, alert_type=${dto.alertType}` : ''),
        outcome: Outcome.SUCCESS,
      });

      return updatedAlert;
    } catch (error) {
      this.logger.error(`Update failed for alert ${alertId} : ${error.message}`, TriageService.name);
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

    try {
      const existingCase = await this.caseService.retrieveCase(alert?.case_id, userId);

      if (
        existingCase.status === CaseStatus.CLOSED_CONFIRMED_82 ||
        existingCase.status === CaseStatus.CLOSED_REFUTED_81 ||
        existingCase.status === CaseStatus.CLOSED_INCONCLUSIVE_83
      ) {
        throw new BadRequestException(`Case ${existingCase.case_id} linked with alert ${alertId} is already closed`);
      }

      const closedCase = await this.caseService.updateCase(existingCase.case_id, { status: closeAlertDto.status }, userId);

      const createCommentDto = new CreateCommentDto();
      createCommentDto.caseId = closedCase.case_id;
      createCommentDto.note = closeAlertDto.reason;

      this.commentService.addComment(createCommentDto, userId);

      await this.audit.logAction({
        userId,
        operation: 'ALERT_CLOSED',
        entityName: 'Alert',
        actionPerformed: `Closed case for alert ${alertId} with reason: ${closeAlertDto.reason}  at ${new Date().toISOString()}`,
        outcome: Outcome.SUCCESS,
      });

      return closedCase;
    } catch (error) {
      this.logger.error(`Failed to close case for alert ${alertId} : ${error.message}`, TriageService.name);
      throw new InternalServerErrorException('Failed to close alert');
    }
  }

  async getAlertsForUser(params: {
    tenantId: string;
    priority?: string;
    type?: string;
    alertType?: string;
    search?: string;
    source?: string;
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }) {
    const { tenantId, priority, type, alertType, search, source, page, limit, sortBy, sortOrder } = params;

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

    if (alertType) {
      if (!Object.values(AlertType).includes(alertType.toUpperCase() as AlertType)) {
        throw new BadRequestException(`Invalid alertType: ${alertType}`);
      }
      whereClause.alert_type = alertType.toUpperCase() as AlertType;
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
      this.logger.error(`Failed to fetch alerts : ${error.message}`, TriageService.name);
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

      this.logger.log(`Alert ${alertId} opened by user ${userId} for review at ${new Date().toISOString()}`, TriageService.name);

      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { tenant_id, ...sanitizedAlert } = alert;
      return sanitizedAlert;
    } catch (error) {
      if (error instanceof NotFoundException) throw error;

      this.logger.error(`Failed to fetch alert ${alertId} : ${error.message}`, TriageService.name);
      throw new InternalServerErrorException('Unable to retrieve alert details');
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
}
