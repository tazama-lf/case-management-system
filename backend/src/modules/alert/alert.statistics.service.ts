import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AlertRepository } from '../repository/alert.repository';
import { BadRequestException, InternalServerErrorException, Injectable } from '@nestjs/common';
import { Alert, CaseType, Priority, Prisma } from '@prisma/client-cms';

@Injectable()
export class AlertStatisticsService {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly logger: LoggerService,
  ) {}

  async getAlertsForUser(params: {
    tenantId: string;
    priority?: string;
    type?: string;
    alertType?: string;
    nullAlertType?: boolean;
    search?: unknown;
    source?: string;
    reportStatus?: string;
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
  }): Promise<{
    data: Array<{
      alert_id: number;
      txtp: string;
      priority: Priority | null;
      confidence_per: number;
      source: string | null;
      alert_type: string | null;
      created_at: Date;
      transaction: Prisma.JsonValue;
      alert_data: Prisma.JsonValue;
    }>;
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  }> {
    const { tenantId, priority, type, alertType, nullAlertType, search, source, reportStatus, page, limit, sortBy, sortOrder } = params;

    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('Limit must be a positive integer');
    }

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

    if (reportStatus) {
      whereClause.alert_data = {
        path: ['status'],
        equals: reportStatus,
      };
      if (reportStatus.toUpperCase() === 'NALT') {
        whereClause.case_id = null;
      }
    }

    if (priority) {
      if (!Object.values(Priority).includes(priority.toUpperCase() as Priority)) {
        throw new BadRequestException(`Invalid priority: ${priority}`);
      }
      whereClause.priority = priority.toUpperCase() as Priority;
    }

    if (nullAlertType) {
      // Filter for alerts with no alert_type (NULL)
      whereClause.alert_type = null;
    } else if (alertType) {
      if (!Object.values(CaseType).includes(alertType.toUpperCase() as CaseType)) {
        throw new BadRequestException(`Invalid alertType: ${alertType}`);
      }
      whereClause.alert_type = alertType.toUpperCase() as CaseType;
    }

    if (type) {
      whereClause.txtp = type;
    }
    if (source) {
      whereClause.source = source;
    }

    if (search) {
      const searchConditions: Prisma.AlertWhereInput[] = [
        { txtp: { contains: search as string, mode: 'insensitive' } },
        { source: { contains: search as string, mode: 'insensitive' } },
      ];

      if (!isNaN(Number(search))) {
        searchConditions.push({ alert_id: { equals: Number(search) } });
        searchConditions.push({ case_id: { equals: Number(search) } });
      }

      if (typeof search === 'string' && Object.values(Priority).includes(search.toUpperCase() as Priority)) {
        searchConditions.push({
          priority: { equals: search.toUpperCase() as Priority },
        });
      }
      if (typeof search === 'string' && Object.values(CaseType).includes(search.toUpperCase() as CaseType)) {
        searchConditions.push({
          alert_type: { equals: search.toUpperCase() as CaseType },
        });
      }
      whereClause.OR = searchConditions;
    }

    try {
      const alerts = await this.alertRepository.findMany({
        where: whereClause,
        sortBy: sortBy as keyof Alert,
        sortOrder,
        page,
        limit,
      });

      const totalCount = await this.alertRepository.count({ where: whereClause });

      return {
        data: alerts,
        page,
        limit,
        total: totalCount,
        totalPages: Math.ceil(totalCount / limit),
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      this.logger.error(`Failed to fetch alerts: ${errorMessage}`, errorStack, AlertStatisticsService.name);
      throw new InternalServerErrorException('Unable to fetch alert list');
    }
  }
}
