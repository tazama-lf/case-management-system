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

    /**
     * Build time range filter based on predefined range or custom dates
     */
    private buildTimeRangeFilter(timeRange?: string, startDate?: string, endDate?: string): Prisma.DateTimeFilter | undefined {
        const now = new Date();
        this.logger.log(`Building time range filter - timeRange: ${timeRange}, startDate: ${startDate}, endDate: ${endDate}`);
        
        // Handle custom date range
        if (startDate || endDate) {
            const filter: Prisma.DateTimeFilter = {};
            
            if (startDate) {
                const start = new Date(startDate);
                if (isNaN(start.getTime())) {
                    this.logger.warn(`Invalid startDate provided: ${startDate}`);
                    return undefined;
                }
                start.setHours(0, 0, 0, 0); // Start of day
                filter.gte = start;
            }
            
            if (endDate) {
                const end = new Date(endDate);
                if (isNaN(end.getTime())) {
                    this.logger.warn(`Invalid endDate provided: ${endDate}`);
                    return undefined;
                }
                end.setHours(23, 59, 59, 999); // End of day
                filter.lte = end;
            }
            
            return filter;
        }
        
        // Handle predefined time ranges
        if (!timeRange) return undefined;
        
        const filter: Prisma.DateTimeFilter = {};
        
        switch (timeRange) {
            case 'today':
                this.logger.log('Applying today filter');
                const today = new Date();
                today.setHours(0, 0, 0, 0);
                const todayEnd = new Date();
                todayEnd.setHours(23, 59, 59, 999);
                filter.gte = today;
                filter.lte = todayEnd;
                break;
                
            case 'yesterday':
                this.logger.log('Applying yesterday filter');
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                yesterday.setHours(0, 0, 0, 0);
                const yesterdayEnd = new Date();
                yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
                yesterdayEnd.setHours(23, 59, 59, 999);
                filter.gte = yesterday;
                filter.lte = yesterdayEnd;
                break;
                
            case 'last7':
                this.logger.log('Applying last 7 days filter');
                const last7 = new Date();
                last7.setDate(last7.getDate() - 7);
                last7.setHours(0, 0, 0, 0);
                const nowEnd7 = new Date();
                nowEnd7.setHours(23, 59, 59, 999);
                filter.gte = last7;
                filter.lte = nowEnd7;
                break;
                
            case 'last30':
                this.logger.log('Applying last 30 days filter');
                const last30 = new Date();
                last30.setDate(last30.getDate() - 30);
                last30.setHours(0, 0, 0, 0);
                const nowEnd30 = new Date();
                nowEnd30.setHours(23, 59, 59, 999);
                filter.gte = last30;
                filter.lte = nowEnd30;
                break;
                
            case 'last90':
                this.logger.log('Applying last 90 days filter');
                const last90 = new Date();
                last90.setDate(last90.getDate() - 90);
                last90.setHours(0, 0, 0, 0);
                const nowEnd90 = new Date();
                nowEnd90.setHours(23, 59, 59, 999);
                filter.gte = last90;
                filter.lte = nowEnd90;
                break;
                
            case 'thisMonth':
                this.logger.log('Applying this month filter');
                const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                thisMonth.setHours(0, 0, 0, 0);
                const nowEndMonth = new Date();
                nowEndMonth.setHours(23, 59, 59, 999);
                filter.gte = thisMonth;
                filter.lte = nowEndMonth;
                break;
                
            case 'lastYear':
                this.logger.log('Applying last year filter');
                const lastYear = new Date();
                lastYear.setFullYear(lastYear.getFullYear() - 1);
                lastYear.setHours(0, 0, 0, 0);
                const nowEndYear = new Date();
                nowEndYear.setHours(23, 59, 59, 999);
                filter.gte = lastYear;
                filter.lte = nowEndYear;
                break;
                
            default:
                // Invalid time range, return undefined to ignore
                this.logger.warn(`Unknown time range: ${timeRange}`);
                return undefined;
        }
        
        this.logger.log(`Final time filter created: ${JSON.stringify(filter)}`);
        return filter;
    }

    // Test method to verify date calculations (can be removed in production)
    testDateCalculations() {
        const testCases = ['today', 'yesterday', 'last7', 'last30', 'last90', 'thisMonth', 'lastYear'];
        
        testCases.forEach(timeRange => {
            const filter = this.buildTimeRangeFilter(timeRange);
            console.log(`\n🔍 Test ${timeRange}:`, {
                gte: filter?.gte instanceof Date ? filter.gte.toISOString() : filter?.gte,
                lte: filter?.lte instanceof Date ? filter.lte.toISOString() : filter?.lte,
                gteReadable: filter?.gte instanceof Date ? filter.gte.toLocaleString() : filter?.gte,
                lteReadable: filter?.lte instanceof Date ? filter.lte.toLocaleString() : filter?.lte
            });
        });
    }

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
        timeRange?: string;
        startDate?: string;
        endDate?: string;
    }) {
        const { tenantId, priority, type, alertType, search, source, reportStatus, page, limit, sortBy, sortOrder, timeRange, startDate, endDate } = params;

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

        // Add time range filtering
        if (timeRange || startDate || endDate) {
            this.logger.log(`Applying time filter - timeRange: ${timeRange}, startDate: ${startDate}, endDate: ${endDate}`);
            const timeFilter = this.buildTimeRangeFilter(timeRange, startDate, endDate);
            if (timeFilter) {
                whereClause.created_at = timeFilter;
                this.logger.log(`Time filter applied: ${JSON.stringify(timeFilter)}`);
                this.logger.log(`Date objects - gte: ${timeFilter.gte}, lte: ${timeFilter.lte}`);
            } else {
                this.logger.warn('Time filter could not be applied - invalid parameters');
            }
        }

        console.log('🔍 Final whereClause being sent to Prisma:', JSON.stringify(whereClause, null, 2));

        try {
            const alerts = await this.alertRepository.findMany({
                where: whereClause,
                sortBy: sortBy as keyof Alert,
                sortOrder,
                page,
                limit,
            });

            const totalCount = await this.alertRepository.count({ where: whereClause });

            this.logger.log(`Query returned ${alerts.length} alerts out of ${totalCount} total`);

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
