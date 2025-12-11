import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AlertRepository } from '../repository/alert.repository';
import { BadRequestException, InternalServerErrorException, Injectable } from '@nestjs/common';
import { Alert, AlertType, Priority, Prisma } from '@prisma/client';

@Injectable()
export class AlertStatisticsService {
    constructor(
        private readonly alertRepository: AlertRepository,
        private readonly logger: LoggerService,
    ) { }

    async getAlertsForUser(params: {
        tenantId: string;
        priority?: string;
        type?: string;
        alertType?: string;
        search?: unknown;
        source?: string;
        reportStatus?: string;
        page: number;
        limit: number;
        sortBy: string;
        sortOrder: 'asc' | 'desc';
    }) {
        const { tenantId, priority, type, alertType, search, source, reportStatus, page, limit, sortBy, sortOrder } = params;

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
            if (typeof search === 'string' && Object.values(AlertType).includes(search.toUpperCase() as AlertType)) {
                searchConditions.push({
                    alert_type: { equals: search.toUpperCase() as AlertType },
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
            this.logger.error(`Failed to fetch alerts: ${error.message}`, AlertStatisticsService.name);
            throw new InternalServerErrorException('Unable to fetch alert list');
        }
    }
}
