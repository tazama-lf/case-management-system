import { LoggerService } from '@tazama-lf/frms-coe-lib';
import { AlertRepository } from '../repository/alert.repository';
import { BadRequestException, InternalServerErrorException, Injectable } from '@nestjs/common';
import { Alert, CaseType, Priority, Prisma } from '@prisma/client-cms';

const VALID_SORT_FIELDS = ['alert_id', 'txtp', 'priority', 'confidence_per', 'alert_status', 'source', 'alert_type', 'created_at'];
const DISPLAY_ALERT_PREFIX = 'ALERT';
const MIN_ENUM_SEARCH_LENGTH = 3;

interface GetAlertsForUserParams {
  tenantId: string;
  priority?: string;
  type?: string;
  alertType?: string;
  nullAlertType?: boolean;
  search?: unknown;
  source?: string;
  startDate?: string;
  endDate?: string;
  reportStatus?: string;
  page: number;
  limit: number;
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

interface DateRange {
  parsedStartDate?: Date;
  parsedEndDate?: Date;
}

interface AlertsForUserResponse {
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
}

@Injectable()
export class AlertStatisticsService {
  constructor(
    private readonly alertRepository: AlertRepository,
    private readonly logger: LoggerService,
  ) {}

  async getAlertsForUser(params: GetAlertsForUserParams): Promise<AlertsForUserResponse> {
    const { page, limit, sortBy, sortOrder } = params;

    this.validatePagination(page, limit);
    this.validateSort(sortBy, sortOrder);

    const dateRange = this.parseDateRange(params);
    const whereClause = this.buildWhereClause(params, dateRange);

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

  private validatePagination(page: number, limit: number): void {
    if (!Number.isInteger(page) || page < 1) {
      throw new BadRequestException('Page must be a positive integer');
    }
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BadRequestException('Limit must be a positive integer');
    }
  }

  private validateSort(sortBy: string, sortOrder: 'asc' | 'desc'): void {
    if (!VALID_SORT_FIELDS.includes(sortBy)) {
      throw new BadRequestException(`Invalid sortBy field: ${sortBy}. Must be one of ${VALID_SORT_FIELDS.join(', ')}`);
    }
    if (!['asc', 'desc'].includes(sortOrder)) {
      throw new BadRequestException('sortOrder must be "asc" or "desc"');
    }
  }

  private parseDateRange(params: GetAlertsForUserParams): DateRange {
    const { startDate, endDate } = params;
    const parsedStartDate = startDate ? new Date(startDate) : undefined;
    if (parsedStartDate && Number.isNaN(parsedStartDate.getTime())) {
      throw new BadRequestException(`Invalid startDate: ${startDate}`);
    }

    const parsedEndDate = endDate ? new Date(endDate) : undefined;
    if (parsedEndDate && Number.isNaN(parsedEndDate.getTime())) {
      throw new BadRequestException(`Invalid endDate: ${endDate}`);
    }

    return { parsedStartDate, parsedEndDate };
  }

  private buildWhereClause(params: GetAlertsForUserParams, dateRange: DateRange): Prisma.AlertWhereInput {
    const whereClause: Prisma.AlertWhereInput = {
      tenant_id: params.tenantId,
      ...this.getReportStatusFilter(params.reportStatus),
      ...this.getPriorityFilter(params.priority),
      ...this.getAlertTypeFilter(params.alertType, params.nullAlertType),
      ...this.getDirectFilters(params, dateRange),
      ...this.getSearchFilter(params.search),
    };

    return whereClause;
  }

  private getReportStatusFilter(reportStatus?: string): Prisma.AlertWhereInput {
    if (!reportStatus) return {};

    const reportStatusFilter: Prisma.AlertWhereInput = {
      alert_data: {
        path: ['status'],
        equals: reportStatus,
      },
    };
    if (reportStatus.toUpperCase() === 'NALT') {
      reportStatusFilter.case_id = null;
    }

    return reportStatusFilter;
  }

  private getPriorityFilter(priority?: string): Prisma.AlertWhereInput {
    if (!priority) return {};

    const normalizedPriority = priority.toUpperCase() as Priority;
    if (!Object.values(Priority).includes(normalizedPriority)) {
      throw new BadRequestException(`Invalid priority: ${priority}`);
    }
    return { priority: normalizedPriority };
  }

  private getAlertTypeFilter(alertType?: string, nullAlertType?: boolean): Prisma.AlertWhereInput {
    if (nullAlertType) {
      return { alert_type: null };
    }

    if (!alertType) return {};

    const normalizedAlertType = alertType.toUpperCase() as CaseType;
    if (!Object.values(CaseType).includes(normalizedAlertType)) {
      throw new BadRequestException(`Invalid alertType: ${alertType}`);
    }
    return { alert_type: normalizedAlertType };
  }

  private getDirectFilters(params: GetAlertsForUserParams, dateRange: DateRange): Prisma.AlertWhereInput {
    const directFilters: Prisma.AlertWhereInput = {};

    if (params.type) {
      directFilters.txtp = params.type;
    }
    if (params.source) {
      directFilters.source = params.source;
    }
    if (dateRange.parsedStartDate !== undefined || dateRange.parsedEndDate !== undefined) {
      directFilters.created_at = {
        ...(dateRange.parsedStartDate && { gte: dateRange.parsedStartDate }),
        ...(dateRange.parsedEndDate && { lte: dateRange.parsedEndDate }),
      };
    }

    return directFilters;
  }

  private getSearchFilter(search?: unknown): Prisma.AlertWhereInput {
    const searchString = this.normalizeSearch(search);
    if (!searchString) return {};
    if (this.isDisplayAlertPrefixSearch(searchString)) return {};

    return { OR: this.buildSearchConditions(searchString) };
  }

  private normalizeSearch(search?: unknown): string {
    if (search === 0) return '';

    if (typeof search === 'string' || typeof search === 'number' || typeof search === 'boolean' || typeof search === 'bigint') {
      return String(search).trim();
    }
    return '';
  }

  private isDisplayAlertPrefixSearch(searchString: string): boolean {
    const normalizedSearch = searchString.replace(/[\-_\s]/gv, '').toUpperCase();
    return normalizedSearch !== '' && DISPLAY_ALERT_PREFIX.includes(normalizedSearch);
  }

  private buildSearchConditions(searchString: string): Prisma.AlertWhereInput[] {
    const alertIdSearch = searchString.replace(/^alert(?:-|_|\s)*/iv, '');
    const searchConditions: Prisma.AlertWhereInput[] = [
      { txtp: { contains: searchString, mode: 'insensitive' } },
      { source: { contains: searchString, mode: 'insensitive' } },
    ];

    this.addTransactionIdSearchConditions(searchConditions, searchString);
    this.addNumericSearchConditions(searchConditions, alertIdSearch);
    this.addEnumSearchConditions(searchConditions, searchString);

    return searchConditions;
  }

  private addTransactionIdSearchConditions(searchConditions: Prisma.AlertWhereInput[], searchString: string): void {
    searchConditions.push({
      transaction: {
        path: ['FIToFIPmtSts', 'GrpHdr', 'MsgId'],
        equals: searchString,
      },
    });
    searchConditions.push({
      transaction: {
        path: ['FIToFICstmrCdt', 'GrpHdr', 'MsgId'],
        equals: searchString,
      },
    });
  }

  private addNumericSearchConditions(searchConditions: Prisma.AlertWhereInput[], alertIdSearch: string): void {
    const numericSearch = Number(alertIdSearch);
    if (Number.isNaN(numericSearch)) return;

    searchConditions.push({ alert_id: { equals: numericSearch } });
  }

  private addEnumSearchConditions(searchConditions: Prisma.AlertWhereInput[], searchString: string): void {
    const normalizedSearch = searchString.toUpperCase();
    if (normalizedSearch.length < MIN_ENUM_SEARCH_LENGTH) return;

    Object.values(Priority)
      .filter((priority) => priority.includes(normalizedSearch))
      .forEach((priority) => {
        searchConditions.push({
          priority: { equals: priority },
        });
      });

    Object.values(CaseType)
      .filter((alertType) => alertType.includes(normalizedSearch))
      .forEach((alertType) => {
        searchConditions.push({
          alert_type: { equals: alertType },
        });
      });
  }
}
