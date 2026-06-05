import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CaseStatus, TaskStatus, CaseType, Priority } from '@prisma/client-cms';
import { FraudReport, FraudReportOutcome } from './report.model';
import { NotificationService } from '../notification/notification.service';
import { CouchdbService } from 'src/modules/couchdb/couchdb.service';
import { EvidenceService } from '../evidence/evidence.service';
import { EventLogService } from '../event_log/eventLog.service';
import { UploadReportDto } from './dto/upload-report.dto';
import * as crypto from 'node:crypto';
import { AgeingSummary, monthlyTrend, resolutionTrend, statusDetails } from './types/report.types';
import getDateRange from './helpers/getDateRange';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidenceService: EvidenceService,
    private readonly couchdbService: CouchdbService,
    private readonly notificationService: NotificationService,
    private readonly eventLogService: EventLogService,
  ) {}

  private static readonly CLOSED_STATUSES: CaseStatus[] = [
    CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
    CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
    CaseStatus.STATUS_81_CLOSED_REFUTED,
    CaseStatus.STATUS_82_CLOSED_CONFIRMED,
    CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
    CaseStatus.STATUS_99_ABANDONED,
    CaseStatus.STATUS_84_COMPLETED,
  ];

  private static readonly STATUS_DISTRIBUTION_MAP: Record<CaseStatus, string> = {
    [CaseStatus.STATUS_10_ASSIGNED]: 'assigned',
    [CaseStatus.STATUS_20_IN_PROGRESS]: 'assigned',
    [CaseStatus.STATUS_00_DRAFT]: 'draft',
    [CaseStatus.STATUS_21_SUSPENDED]: 'suspended',
    [CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL]: 'pendingApproval',
    [CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL]: 'pendingApproval',
    [CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT]: 'draft',
    [CaseStatus.STATUS_03_RETURNED]: 'draft',
    [CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL]: 'pendingApproval',
    [CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED]: 'closed',
    [CaseStatus.STATUS_72_AUTOCLOSED_REFUTED]: 'closed',
    [CaseStatus.STATUS_81_CLOSED_REFUTED]: 'closed',
    [CaseStatus.STATUS_82_CLOSED_CONFIRMED]: 'closed',
    [CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE]: 'closed',
    [CaseStatus.STATUS_99_ABANDONED]: 'closed',
    [CaseStatus.STATUS_84_COMPLETED]: 'closed',
  };

  /**
   * Builds the common Prisma `where` fragments shared by every report query
   * (case type / priority / investigator / tenant scoping via the related alert).
   */
  private buildCommonCaseFilters(filters?: {
    caseType?: string;
    priority?: string;
    investigator?: string;
    tenantId?: string;
  }): Record<string, any> {
    const where: Record<string, any> = {};
    if (filters?.caseType) where.case_type = filters.caseType;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.investigator) where.case_owner_user_id = filters.investigator;
    if (filters?.tenantId) where.tenant_id = filters.tenantId;
    return where;
  }

  /**
   * If a `requestingUserId` is supplied (investigator view), wrap the base filter
   * with the standard "scope to this investigator" OR clause:
   *   - cases they own,
   *   - cases with a task assigned to them,
   *   - unassigned cases (which they could pick up),
   *   - cases ready for assignment.
   *
   * The OR clause is ANDed with the supplied `baseFilters`, so the existing
   * filters (date window, caseType, priority, tenantId, …) are preserved on
   * every branch — investigators still only see cases that match those filters.
   */
  private applyInvestigatorScope(baseFilters: any, requestingUserId?: string, tenantId?: string): any {
    if (!requestingUserId) return baseFilters;
    return {
      AND: [
        baseFilters,
        {
          OR: [
            {
              case_owner_user_id: requestingUserId,
            },
            {
              case_creator_user_id: requestingUserId,
            },
            {
              tasks: {
                some: {
                  assigned_user_id: requestingUserId,
                },
              },
            },
            {
              case_owner_user_id: null,
            },
            {
              status: CaseStatus.STATUS_00_DRAFT,
            },
          ],
        },
      ],
    };
  }

  private avgResolutionDays(cases: Array<{ created_at: Date; updated_at: Date }>): number {
    if (cases.length === 0) return 0;
    const totalDays = cases.reduce((sum, c) => sum + (c.updated_at.getTime() - c.created_at.getTime()) / (1000 * 60 * 60 * 24), 0);
    return totalDays / cases.length;
  }

  /** Folds a `groupBy(status)` result into the public status-distribution shape. */
  private computeStatusDistribution(statusCounts: Array<{ status: CaseStatus; _count: { case_id: number } }>): {
    assigned: number;
    inProgress: number;
    draft: number;
    suspended: number;
    pendingApproval: number;
    closed: number;
  } {
    const distribution = {
      assigned: 0,
      inProgress: 0,
      draft: 0,
      suspended: 0,
      pendingApproval: 0,
      closed: 0,
    };

    statusCounts.forEach(({ status, _count }) => {
      if (ReportsService.CLOSED_STATUSES.includes(status)) {
        distribution.closed += _count.case_id;
        return;
      }
      const mapped = ReportsService.STATUS_DISTRIBUTION_MAP[status];
      if (mapped) {
        (distribution as Record<string, number>)[mapped] += _count.case_id;
      }
    });

    return distribution;
  }

  private computeCaseTypes(
    typeCounts: Array<{ case_type: CaseType | null; _count: { case_id: number } }>,
  ): Array<{ name: string; count: number; color: string }> {
    return typeCounts.map(({ case_type: caseType, _count }) => ({
      name: caseType ?? 'NONE',
      count: _count.case_id,
      color: this.getCaseTypeColor(caseType),
    }));
  }

  private computeOutcomes(outcomeCounts: Array<{ status: CaseStatus; _count: { case_id: number } }>): {
    resolved: number;
    confirmed: number;
    inconclusive: number;
    pending: number;
  } {
    const outcomes = { resolved: 0, confirmed: 0, inconclusive: 0, pending: 0 };

    outcomeCounts.forEach(({ status, _count }) => {
      if (status === CaseStatus.STATUS_82_CLOSED_CONFIRMED || status === CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED) {
        outcomes.confirmed += _count.case_id;
      } else if (status === CaseStatus.STATUS_81_CLOSED_REFUTED || status === CaseStatus.STATUS_72_AUTOCLOSED_REFUTED) {
        outcomes.resolved += _count.case_id;
      } else if (status === CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE) {
        outcomes.inconclusive += _count.case_id;
      }
    });

    return outcomes;
  }

  /**
   * Aggregates created/closed case counts grouped by `created_at` date over
   * the last 6 months. For investigators, results are restricted strictly to
   * cases they own or have a task assigned to (NOT unassigned / ready-for-
   * assignment cases) — the trend should reflect only the user's own work.
   */
  private async computeMonthlyTrend(filters?: {
    caseType?: string;
    priority?: string;
    investigator?: string;
    tenantId?: string;
    requestingUserId?: string;
  }): Promise<monthlyTrend[]> {
    const now = new Date();
    const trendStartDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const base: any = {
      created_at: { gte: trendStartDate },
      ...this.buildCommonCaseFilters(filters),
    };
    const where = filters?.requestingUserId
      ? {
          AND: [
            base,
            {
              OR: [
                { case_owner_user_id: filters.requestingUserId }, // Cases owned by this investigator
                {
                  tasks: {
                    some: {
                      assigned_user_id: filters.requestingUserId, // Cases with tasks assigned to this investigator
                    },
                  },
                },
              ],
            },
          ],
        }
      : base;

    const recentCases = await this.prisma.case.findMany({
      where,
      select: { created_at: true, updated_at: true, status: true },
      orderBy: { created_at: 'asc' },
    });

    const casesByDate = new Map<string, { created: number; closed: number }>();

    recentCases.forEach((c) => {
      const createdDate = c.created_at.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      if (!casesByDate.has(createdDate)) {
        casesByDate.set(createdDate, { created: 0, closed: 0 });
      }
      const entry = casesByDate.get(createdDate)!;
      entry.created += 1;
      if (ReportsService.CLOSED_STATUSES.includes(c.status)) {
        entry.closed += 1;
      }
    });

    const trend: monthlyTrend[] = [];
    casesByDate.forEach((value, date) => {
      trend.push({
        month: date,
        casesCreated: value.created,
        casesClosed: value.closed,
      });
    });
    return trend;
  }

  private async computeStatusDetails(
    statusCounts: Array<{ status: CaseStatus; _count: { case_id: number } }>,
    totalCases: number,
    whereClause: any,
  ): Promise<statusDetails[]> {
    return await Promise.all(
      statusCounts.map(async ({ status, _count }) => {
        const percentage = totalCases > 0 ? ((_count.case_id / totalCases) * 100).toFixed(1) : '0.0';

        const casesInStatus = await this.prisma.case.findMany({
          where: { ...whereClause, status },
          select: { created_at: true, updated_at: true },
        });

        let avgTimeInStatus = 'N/A';
        if (casesInStatus.length > 0) {
          const avgDays = Math.round(this.avgResolutionDays(casesInStatus));
          avgTimeInStatus = avgDays === 0 ? '< 1 day' : `${avgDays} ${avgDays === 1 ? 'day' : 'days'}`;
        }

        return {
          status: this.formatStatusName(status),
          count: _count.case_id,
          percentage: `${percentage}%`,
          avgTimeInStatus,
          currentTrendPeriod: '+0%',
        };
      }),
    );
  }

  private async computeResolutionTrend(filters?: {
    caseType?: string;
    priority?: string;
    investigator?: string;
    tenantId?: string;
    requestingUserId?: string;
  }): Promise<Array<{ month: string; avgResolutionTime: number; casesResolved: number }>> {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => {
      const index = 5 - i; // counts down
      const monthStart = new Date(now.getFullYear(), now.getMonth() - index, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - index + 1, 0, 23, 59, 59, 999);
      return { monthStart, monthEnd };
    });

    const commonFilters = this.buildCommonCaseFilters(filters);

    return await Promise.all(
      months.map(async ({ monthStart, monthEnd }) => {
        const base = {
          updated_at: { gte: monthStart, lte: monthEnd },
          status: { in: ReportsService.CLOSED_STATUSES },
          ...commonFilters,
        };
        const where = this.applyInvestigatorScope(base, filters?.requestingUserId);

        const monthClosedCases = await this.prisma.case.findMany({
          where,
          select: { created_at: true, updated_at: true },
        });

        return {
          month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
          avgResolutionTime: Math.round(this.avgResolutionDays(monthClosedCases)),
          casesResolved: monthClosedCases.length,
        };
      }),
    );
  }

  async getCaseStatus(
    dateRange?: string,
    filters?: {
      caseType?: string;
      priority?: string;
      investigator?: string;
      tenantId: string;
      requestingUserId?: string;
    },
  ): Promise<{
    stats: {
      totalCases: number;
      closedCases: number;
      openCases: number;
      avgResolutionTime: number;
      highPriorityCases: number;
    };
    recentCases: Array<{
      priority: string;
      count: number;
    }>;
    statusDistribution: {
      assigned: number;
      inProgress: number;
      draft: number;
      suspended: number;
      pendingApproval: number;
      closed: number;
    };
    caseTypes: Array<{
      name: string;
      count: number;
      color: string;
    }>;
    outcomes: {
      resolved: number;
      confirmed: number;
      inconclusive: number;
      pending: number;
    };
    monthlyTrend: monthlyTrend[];
    resolutionTrend: Array<{
      month: string;
      avgResolutionTime: number;
      casesResolved: number;
    }>;
    statusDetails: statusDetails[];
  }> {
    const { startDate, endDate } = getDateRange(dateRange);
    const dateWindow = { gte: startDate, lte: endDate };

    // Build the overall scope: date window + filters + (optional) investigator restriction.
    const baseFilters = { created_at: dateWindow, ...this.buildCommonCaseFilters(filters) };
    const whereClause = filters?.investigator ? {} : this.applyInvestigatorScope(baseFilters, filters?.requestingUserId, filters?.tenantId);
    const closedCasesWhere = this.applyInvestigatorScope(
      { ...baseFilters, status: { in: ReportsService.CLOSED_STATUSES } },
      filters?.requestingUserId,
      filters?.tenantId,
    );

    // Run all aggregate queries that share these scopes in parallel.
    const [allCases, statusCounts, typeCounts, totalCases, closedCases, closedCasesWithTimes, outcomeCounts] = await Promise.all([
      this.prisma.case.findMany({
        where: whereClause,
        select: { status: true, priority: true },
      }),
      this.prisma.case.groupBy({ by: ['status'], where: whereClause, _count: { case_id: true } }),
      this.prisma.case.groupBy({ by: ['case_type'], where: whereClause, _count: { case_id: true } }),
      this.prisma.case.count({ where: whereClause }),
      this.prisma.case.count({ where: closedCasesWhere }),
      this.prisma.case.findMany({
        where: closedCasesWhere,
        select: { created_at: true, updated_at: true },
      }),
      this.prisma.case.groupBy({
        by: ['status'],
        where: closedCasesWhere,
        _count: { case_id: true },
      }),
    ]);

    // Pure transformations.
    const statusDistribution = this.computeStatusDistribution(statusCounts);
    const caseTypes = this.computeCaseTypes(typeCounts);
    const outcomes = this.computeOutcomes(outcomeCounts);
    const avgResolutionTime = this.avgResolutionDays(closedCasesWithTimes);

    // Trend / detail queries (independent — run in parallel).
    const [monthlyTrend, statusDetails, resolutionTrend] = await Promise.all([
      this.computeMonthlyTrend(filters),
      this.computeStatusDetails(statusCounts, totalCases, whereClause),
      this.computeResolutionTrend(filters),
    ]);

    const openCases = allCases.filter((c) => !ReportsService.CLOSED_STATUSES.includes(c.status)).length;

    const lowPriorityCases = allCases.filter(
      (c) => c.priority === Priority.NEW && !ReportsService.CLOSED_STATUSES.includes(c.status),
    ).length;
    const mediumPriorityCases = allCases.filter(
      (c) => (c.priority === Priority.CRITICAL || c.priority === Priority.URGENT) && !ReportsService.CLOSED_STATUSES.includes(c.status),
    ).length;
    const highPriorityCases = allCases.filter(
      (c) => c.priority === Priority.BREACH && !ReportsService.CLOSED_STATUSES.includes(c.status),
    ).length;

    const recentCases = [
      {
        priority: 'Low',
        count: lowPriorityCases,
      },
      {
        priority: 'Medium',
        count: mediumPriorityCases,
      },
      {
        priority: 'High',
        count: highPriorityCases,
      },
    ];

    return {
      stats: {
        totalCases,
        closedCases,
        openCases,
        avgResolutionTime: Math.round(avgResolutionTime),
        highPriorityCases,
      },
      recentCases,
      statusDistribution,
      caseTypes,
      outcomes,
      monthlyTrend,
      resolutionTrend,
      statusDetails,
    };
  }

  async getInvestigatorWorkload(
    dateRange?: string,
    tenantId?: string,
  ): Promise<{
    stats: {
      totalInvestigators: number;
      avgCasesPerInvestigator: number;
      avgResolutionTime: number;
      caseClosureRate: number;
    };
    workloadData: Array<{
      investigatorId: string;
      name: string;
      activeCases: number;
      pendingTasks: number;
    } | null>;
    volumeTrend: Array<{
      month: string;
      investigators: Record<string, number>;
    }>;
    efficiencyData: Array<{
      name: string;
      avgDays: number;
    } | null>;
    outcomeData: Array<{
      name: string;
      confirmed: number;
      refuted: number;
      inconclusive: number;
    } | null>;
    performanceData: Array<{
      investigatorId: string;
      investigator: string;
      role: string;
      totalCases: number;
      activeCases: number;
      completedCases: number;
      pendingTasks: number;
      completionRate: number;
      avgResolutionTime: number;
      caseClosureRate: number;
      performanceTrend: string;
    } | null>;
  }> {
    const { startDate, endDate } = getDateRange(dateRange);

    const investigators = await this.prisma.case.findMany({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
        case_owner_user_id: { not: null },
        tenant_id: tenantId,
      },
      select: {
        case_owner_user_id: true,
      },
      distinct: ['case_owner_user_id'],
    });

    const workloadData = await Promise.all(
      investigators.map(async ({ case_owner_user_id: caseOwnerUserId }) => {
        if (!caseOwnerUserId) return null;

        const [activeCases, pendingTasks] = await Promise.all([
          this.prisma.case.count({
            where: {
              case_owner_user_id: caseOwnerUserId,
              created_at: {
                gte: startDate,
                lte: endDate,
              },
              status: {
                notIn: [
                  CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
                  CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
                  CaseStatus.STATUS_81_CLOSED_REFUTED,
                  CaseStatus.STATUS_82_CLOSED_CONFIRMED,
                  CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
                ],
              },
            },
          }),
          this.prisma.task.count({
            where: {
              assigned_user_id: caseOwnerUserId,
              status: {
                in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
              },
            },
          }),
        ]);

        return {
          investigatorId: caseOwnerUserId,
          name: `User ${caseOwnerUserId}`,
          activeCases,
          pendingTasks,
        };
      }),
    );

    const validWorkloadData = workloadData.filter(Boolean);

    const efficiencyData = await Promise.all(
      investigators.map(async ({ case_owner_user_id: caseOwnerUserId }) => {
        if (!caseOwnerUserId) return null;

        const cases = await this.prisma.case.findMany({
          where: {
            case_owner_user_id: caseOwnerUserId,
            created_at: {
              gte: startDate,
              lte: endDate,
            },
            tenant_id: tenantId,
            status: {
              in: [
                CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
                CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
                CaseStatus.STATUS_81_CLOSED_REFUTED,
                CaseStatus.STATUS_82_CLOSED_CONFIRMED,
                CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
              ],
            },
          },
          select: {
            created_at: true,
            updated_at: true,
          },
        });

        const avgResolutionDays =
          cases.length > 0
            ? cases.reduce((sum, case_) => {
                const resolutionTime = Math.floor((case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24));
                return sum + resolutionTime;
              }, 0) / cases.length
            : 0;

        return {
          name: caseOwnerUserId,
          avgDays: Math.round(avgResolutionDays),
        };
      }),
    );

    const outcomeData = await Promise.all(
      investigators.map(async ({ case_owner_user_id: caseOwnerUserId }) => {
        if (!caseOwnerUserId) return null;

        const [confirmed, refuted, inconclusive] = await Promise.all([
          this.prisma.case.count({
            where: {
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              tenant_id: tenantId,
              status: {
                in: [CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED, CaseStatus.STATUS_82_CLOSED_CONFIRMED],
              },
            },
          }),
          this.prisma.case.count({
            where: {
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              tenant_id: tenantId,
              status: {
                in: [CaseStatus.STATUS_72_AUTOCLOSED_REFUTED, CaseStatus.STATUS_81_CLOSED_REFUTED],
              },
            },
          }),
          this.prisma.case.count({
            where: {
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              status: CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
              tenant_id: tenantId,
            },
          }),
        ]);

        return {
          name: caseOwnerUserId,
          confirmed,
          refuted,
          inconclusive,
        };
      }),
    );

    const performanceData = await Promise.all(
      investigators.map(async ({ case_owner_user_id: caseOwnerUserId }) => {
        if (!caseOwnerUserId) return null;

        const [totalCases, activeCases, closedCases, pendingTasks, closedCasesWithTimes] = await Promise.all([
          this.prisma.case.count({
            where: {
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              tenant_id: tenantId,
            },
          }),
          this.prisma.case.count({
            where: {
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              tenant_id: tenantId,
              status: {
                notIn: [
                  CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
                  CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
                  CaseStatus.STATUS_81_CLOSED_REFUTED,
                  CaseStatus.STATUS_82_CLOSED_CONFIRMED,
                  CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
                ],
              },
            },
          }),
          this.prisma.case.count({
            where: {
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              tenant_id: tenantId,
              status: {
                in: [
                  CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
                  CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
                  CaseStatus.STATUS_81_CLOSED_REFUTED,
                  CaseStatus.STATUS_82_CLOSED_CONFIRMED,
                  CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
                ],
              },
            },
          }),
          this.prisma.task.count({
            where: {
              assigned_user_id: caseOwnerUserId,
              tenant_id: tenantId,
              status: {
                in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
              },
            },
          }),
          this.prisma.case.findMany({
            where: {
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              tenant_id: tenantId,
              status: {
                in: [
                  CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
                  CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
                  CaseStatus.STATUS_81_CLOSED_REFUTED,
                  CaseStatus.STATUS_82_CLOSED_CONFIRMED,
                  CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
                ],
              },
            },
            select: {
              created_at: true,
              updated_at: true,
            },
          }),
        ]);

        const avgResolutionTime =
          closedCasesWithTimes.length > 0
            ? closedCasesWithTimes.reduce((sum, case_) => {
                const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
                return sum + resolutionTime;
              }, 0) / closedCasesWithTimes.length
            : 0;

        const completionRate = totalCases > 0 ? Math.round((closedCases / totalCases) * 100) : 0;

        return {
          investigatorId: caseOwnerUserId,
          investigator: caseOwnerUserId,
          role: 'Investigator',
          totalCases,
          activeCases,
          completedCases: closedCases,
          pendingTasks,
          completionRate,
          avgResolutionTime: Math.round(avgResolutionTime),
          caseClosureRate: completionRate,
          performanceTrend: completionRate >= 80 ? 'Improving' : completionRate <= 50 ? 'Declining' : 'Stable',
        };
      }),
    );

    const now = new Date();

    const volumeTrend = await Promise.all(
      Array.from({ length: 6 }, (_, i) => 5 - i).map(async (i) => {
        const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
        const monthLabel = monthStart.toLocaleString('default', { month: 'short', year: 'numeric' });

        const investigatorCounts = await Promise.all(
          investigators.map(async ({ case_owner_user_id: caseOwnerUserId }) => {
            if (!caseOwnerUserId) return { caseOwnerUserId: null, count: 0 };

            const caseCount = await this.prisma.case.count({
              where: {
                case_owner_user_id: caseOwnerUserId,
                created_at: {
                  gte: monthStart,
                  lte: monthEnd,
                },
                tenant_id: tenantId,
              },
            });

            return { caseOwnerUserId, count: caseCount };
          }),
        );

        const investigatorsMap: Record<string, number> = {};
        investigatorCounts.forEach(({ caseOwnerUserId, count }) => {
          if (caseOwnerUserId) {
            investigatorsMap[caseOwnerUserId] = count;
          }
        });

        return { month: monthLabel, investigators: investigatorsMap };
      }),
    );

    const totalInvestigators = validWorkloadData.length;
    const avgCasesPerInvestigator =
      totalInvestigators > 0 ? validWorkloadData.reduce((sum, w) => sum + (w?.activeCases ?? 0), 0) / totalInvestigators : 0;

    const validPerformanceData = performanceData.filter(Boolean);
    const totalResolutionTime = validPerformanceData.reduce((sum, w) => sum + (w?.avgResolutionTime ?? 0), 0);
    const investigatorsWithClosedCases = validPerformanceData.filter((w) => (w?.avgResolutionTime ?? 0) > 0).length;
    const avgResolutionTime = investigatorsWithClosedCases > 0 ? totalResolutionTime / investigatorsWithClosedCases : 0;

    const totalClosureRate = validPerformanceData.reduce((sum, w) => sum + (w?.caseClosureRate ?? 0), 0);
    const avgCaseClosureRate = validPerformanceData.length > 0 ? totalClosureRate / validPerformanceData.length : 0;

    return {
      stats: {
        totalInvestigators,
        avgCasesPerInvestigator: Math.round(avgCasesPerInvestigator),
        avgResolutionTime: Math.round(avgResolutionTime),
        caseClosureRate: Math.round(avgCaseClosureRate),
      },
      workloadData: validWorkloadData,
      volumeTrend,
      efficiencyData: efficiencyData.filter(Boolean),
      outcomeData: outcomeData.filter(Boolean),
      performanceData: performanceData.filter(Boolean),
    };
  }

  async getEventLogs(dateRange?: string): Promise<{
    stats: {
      totalLogs: number;
      caseActions: number;
    };
    eventLogs: Array<{
      event_log_id: string | number;
      user_id: string;
      operation: string;
      entity_name: string;
      action_performed: string;
      outcome: string;
      performed_at: string;
      type: 'Info' | 'Success' | 'Warning' | 'Error';
    }>;
  }> {
    const { startDate, endDate } = getDateRange(dateRange);

    const eventLogs = await this.eventLogService.getLogs(100, 0);

    const filteredLogs = eventLogs.filter((log) => log.performed_at >= startDate && log.performed_at <= endDate);

    const caseActions = filteredLogs.filter((log) => log.entity_name === 'Case' || log.action_performed.includes('Case')).length;

    const formattedLogs = filteredLogs.map((log) => ({
      event_log_id: log.event_log_id ? log.event_log_id : '',
      user_id: log.user_id ? log.user_id : '',
      operation: log.operation ? log.operation : '',
      entity_name: log.entity_name ? log.entity_name : '',
      action_performed: log.action_performed ? log.action_performed : '',
      outcome: log.outcome ? log.outcome : '',
      performed_at: log.performed_at.toLocaleString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }),
      type: this.getAuditLogType(log.outcome),
    }));

    return {
      stats: {
        totalLogs: filteredLogs.length,
        caseActions,
      },
      eventLogs: formattedLogs,
    };
  }

  async getCaseAgeing(
    dateRange?: string,
    filters?: {
      tenantId: string;
      requestingUserId?: string;
    },
  ): Promise<{
    stats: {
      avgCaseAge: number;
      avgResolutionTime: number;
      casesOver15Days: number;
      casesOver30Days: number;
    };
    ageingByStatus: AgeingSummary[];
    resolutionTrend: resolutionTrend[];
    ageingDistribution: Array<{
      ageRange: string;
      count: number;
      percentage: number;
      color: string;
    }>;
    caseTypeResolution: Array<{
      caseType: 'FRAUD' | 'AML' | 'FRAUD_AND_AML';
      avgDays: number;
    }>;
    caseDetails: Array<{
      caseId: number;
      type: string;
      status: string;
      createdDate: string;
      ageDays: number;
      priority: Priority;
      userId: string | null;
      investigator: string;
    }>;
  }> {
    const baseFilters: any = {};

    if (filters?.tenantId) {
      baseFilters.alert = {
        tenant_id: filters.tenantId,
      };
    }

    let whereClause: any;

    // If requestingUserId is provided (investigator), filter to show only unassigned, ready for assignment, or assigned to them
    if (filters?.requestingUserId) {
      whereClause = {
        AND: [
          baseFilters,
          {
            OR: [
              { case_owner_user_id: filters.requestingUserId }, // Cases owned by this investigator
              {
                tasks: {
                  some: {
                    assigned_user_id: filters.requestingUserId, // Cases with tasks assigned to this investigator
                  },
                },
              },
              { case_owner_user_id: null }, // Unassigned cases
              { status: 'STATUS_02_READY_FOR_ASSIGNMENT' }, // Cases ready for assignment
            ],
          },
        ],
      };
    } else {
      whereClause = baseFilters;
    }

    const cases = await this.prisma.case.findMany({
      where: whereClause,
      select: {
        case_id: true,
        status: true,
        case_type: true,
        created_at: true,
        updated_at: true,
        priority: true,
        case_owner_user_id: true,
      },
    });

    const now = new Date();
    const casesWithAge = cases.map((case_) => {
      const ageDays = Math.floor((now.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24));
      return { ...case_, ageDays };
    });

    const avgCaseAge = casesWithAge.length > 0 ? casesWithAge.reduce((sum, case_) => sum + case_.ageDays, 0) / casesWithAge.length : 0;

    const closedStatuses = [
      CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
      CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
      CaseStatus.STATUS_81_CLOSED_REFUTED,
      CaseStatus.STATUS_82_CLOSED_CONFIRMED,
      CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
    ];

    const closedCasesWithTimes = casesWithAge.filter((case_) => closedStatuses.includes(case_.status as any));

    const avgResolutionTime =
      closedCasesWithTimes.length > 0
        ? closedCasesWithTimes.reduce((sum, case_) => {
            const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
            return sum + resolutionTime;
          }, 0) / closedCasesWithTimes.length
        : 0;

    const casesOver15Days = casesWithAge.filter((c) => c.ageDays > 15).length;
    const casesOver30Days = casesWithAge.filter((c) => c.ageDays >= 30).length;

    const ageingByStatus: AgeingSummary[] = [];
    const statusGroups = casesWithAge.reduce<Record<string, typeof casesWithAge>>((acc, case_) => {
      const { status } = case_;
      const existingCases = acc[status] ?? [];
      return {
        ...acc,
        [status]: [...existingCases, case_],
      };
    }, {});

    Object.entries(statusGroups).forEach(([status, cases]) => {
      ageingByStatus.push({
        status: this.formatStatusName(status as CaseStatus),
        age0to7: cases.filter((c) => c.ageDays <= 7).length,
        age8to15: cases.filter((c) => c.ageDays > 7 && c.ageDays <= 15).length,
        age16to30: cases.filter((c) => c.ageDays > 15 && c.ageDays < 30).length,
        age30Plus: cases.filter((c) => c.ageDays >= 30).length,
      });
    });

    const ageingDistribution = [
      { ageRange: '0-7 days', count: casesWithAge.filter((c) => c.ageDays <= 7).length, percentage: 0, color: '#10b981' },
      {
        ageRange: '8-15 days',
        count: casesWithAge.filter((c) => c.ageDays > 7 && c.ageDays <= 15).length,
        percentage: 0,
        color: '#f59e0b',
      },
      {
        ageRange: '16-30 days',
        count: casesWithAge.filter((c) => c.ageDays > 15 && c.ageDays < 30).length,
        percentage: 0,
        color: '#ef4444',
      },
      { ageRange: '30+ days', count: casesWithAge.filter((c) => c.ageDays >= 30).length, percentage: 0, color: '#7c2d12' },
    ];

    const total = ageingDistribution.reduce((sum, item) => sum + item.count, 0);
    const ageingDistributionWithPercentage = ageingDistribution.map((item) => ({
      ...item,
      percentage: total > 0 ? Math.round((item.count / total) * 100) : 0,
    }));

    const caseTypeResolution = await Promise.all(
      Object.values(CaseType).map(async (type) => {
        const caseTypeBaseFilters: any = {
          status: {
            in: closedStatuses,
          },
          case_type: type,
        };

        if (filters?.tenantId) {
          caseTypeBaseFilters.alert = {
            tenant_id: filters.tenantId,
          };
        }

        let caseTypeWhereClause: any;

        // Apply the same user filtering logic
        if (filters?.requestingUserId) {
          caseTypeWhereClause = {
            AND: [
              caseTypeBaseFilters,
              {
                OR: [
                  { case_owner_user_id: filters.requestingUserId }, // Cases owned by this investigator
                  {
                    tasks: {
                      some: {
                        assigned_user_id: filters.requestingUserId, // Cases with tasks assigned to this investigator
                      },
                    },
                  },
                  { case_owner_user_id: null }, // Unassigned cases
                  { status: 'STATUS_02_READY_FOR_ASSIGNMENT' }, // Cases ready for assignment
                ],
              },
            ],
          };
        } else {
          caseTypeWhereClause = caseTypeBaseFilters;
        }

        const closedCasesOfType = await this.prisma.case.findMany({
          where: caseTypeWhereClause,
          select: {
            created_at: true,
            updated_at: true,
          },
        });

        if (closedCasesOfType.length === 0) {
          return null;
        }

        const avgResolutionTime =
          closedCasesOfType.reduce((sum, case_) => {
            const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
            return sum + resolutionTime;
          }, 0) / closedCasesOfType.length;

        return {
          caseType: type,
          avgDays: Math.round(avgResolutionTime),
        };
      }),
    ).then((results) => results.filter((item) => item !== null));

    const resolutionTrend: resolutionTrend[] = [];
    const currentDate = new Date();
    const trendStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1);

    const recentClosedBaseFilters: any = {
      updated_at: {
        gte: trendStartDate,
      },
      status: {
        in: [
          CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
          CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
          CaseStatus.STATUS_81_CLOSED_REFUTED,
          CaseStatus.STATUS_82_CLOSED_CONFIRMED,
          CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
        ],
      },
    };

    if (filters?.tenantId) {
      recentClosedBaseFilters.alert = {
        tenant_id: filters.tenantId,
      };
    }

    let recentClosedWhereClause: any;

    // Apply the same user filtering logic
    if (filters?.requestingUserId) {
      recentClosedWhereClause = {
        AND: [
          recentClosedBaseFilters,
          {
            OR: [
              { case_owner_user_id: filters.requestingUserId }, // Cases owned by this investigator
              {
                tasks: {
                  some: {
                    assigned_user_id: filters.requestingUserId, // Cases with tasks assigned to this investigator
                  },
                },
              },
              { case_owner_user_id: null }, // Unassigned cases
              { status: 'STATUS_02_READY_FOR_ASSIGNMENT' }, // Cases ready for assignment
            ],
          },
        ],
      };
    } else {
      recentClosedWhereClause = recentClosedBaseFilters;
    }

    const recentClosedCases = await this.prisma.case.findMany({
      where: recentClosedWhereClause,
      select: {
        created_at: true,
        updated_at: true,
      },
      orderBy: {
        updated_at: 'asc',
      },
    });

    recentClosedCases.forEach((case_) => {
      const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
      resolutionTrend.push({
        month: case_.updated_at.toLocaleDateString('en-US', { day: 'numeric', month: 'long', year: 'numeric' }),
        avgDays: Math.round(resolutionTime),
      });
    });

    const caseDetails = casesWithAge.map((case_) => ({
      caseId: case_.case_id,
      type: case_.case_type ?? 'NONE',
      status: this.formatStatusName(case_.status),
      createdDate: case_.created_at.toLocaleDateString('en-US'),
      ageDays: case_.ageDays,
      priority: case_.priority,
      userId: case_.case_owner_user_id ?? null,
      investigator: case_.case_owner_user_id ?? 'Unassigned',
    }));

    return {
      stats: {
        avgCaseAge: Math.round(avgCaseAge),
        avgResolutionTime: Math.round(avgResolutionTime),
        casesOver15Days,
        casesOver30Days,
      },
      ageingByStatus,
      resolutionTrend,
      ageingDistribution: ageingDistributionWithPercentage,
      caseTypeResolution,
      caseDetails,
    };
  }

  private getCaseTypeColor(caseType: CaseType | null): string {
    switch (caseType) {
      case CaseType.FRAUD:
        return '#ef4444';
      case CaseType.AML:
        return '#8b5cf6';
      case CaseType.FRAUD_AND_AML:
        return '#f59e0b';
      default:
        return '#3b82f6';
    }
  }

  private formatStatusName(status: CaseStatus): string {
    return status.replace('STATUS_', '').replace(/_/gv, ' ');
  }

  private getAuditLogType(outcome: string | null | undefined): 'Info' | 'Success' | 'Warning' | 'Error' {
    if (!outcome || typeof outcome !== 'string') return 'Info';

    if (outcome.includes('SUCCESS') || outcome.includes('COMPLETED')) return 'Success';
    if (outcome.includes('WARNING')) return 'Warning';
    if (outcome.includes('ERROR') || outcome.includes('FAILED')) return 'Error';
    return 'Info';
  }

  async getFilters(): Promise<{
    caseTypes: Array<{
      value: string;
      label: string;
    }>;
    priorities: Array<{
      value: Priority;
      label: Priority;
    }>;
    investigators: Array<{
      value: string;
      label: string;
    }>;
  }> {
    const caseTypes = await this.prisma.case.findMany({
      select: { case_type: true },
      distinct: ['case_type'],
    });

    const priorities = await this.prisma.case.findMany({
      select: { priority: true },
      distinct: ['priority'],
    });

    const investigators = await this.prisma.case.findMany({
      where: { case_owner_user_id: { not: null } },
      select: { case_owner_user_id: true },
      distinct: ['case_owner_user_id'],
    });

    return {
      caseTypes: caseTypes.map((ct) => ({
        value: ct.case_type ?? 'NONE',
        label: ct.case_type ?? 'None',
      })),
      priorities: priorities.map((p) => ({
        value: p.priority,
        label: p.priority,
      })),
      investigators: investigators.map((i) => ({
        value: i.case_owner_user_id ?? '',
        label: i.case_owner_user_id ? `User ${i.case_owner_user_id.slice(0, 8)}` : 'Unassigned',
      })),
    };
  }

  private sha256(buffer: Buffer): string {
    return crypto.createHash('sha256').update(buffer).digest('hex');
  }

  private encrypt(buffer: Buffer): { encrypted: Buffer; key: string; iv: string; authTag: string } {
    const key = crypto.randomBytes(32);
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      key: key.toString('base64'),
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
    };
  }

  async generateFraudReport(file: any, dto: UploadReportDto, userId?: string, tenantId?: string, role?: string): Promise<FraudReport> {
    const allowed = 'application/pdf';
    if (!allowed.includes(file.mimetype)) {
      throw new BadRequestException(`File type ${file.mimetype} is not allowed for ${dto.reportType}. File: ${file.originalname}`);
    }

    if (role === 'CMS_SUPERVISOR') {
      const caseTasks = await this.prisma.task.findMany({
        where: { case_id: dto.caseId },
      });

      const investigationTasks = caseTasks.filter((task) => task.name?.toLowerCase().includes('investigate'));

      const incompleteTasks = investigationTasks.filter((task) => task.status !== TaskStatus.STATUS_30_COMPLETED);

      if (incompleteTasks.length > 0) {
        const taskNames = incompleteTasks.map((t) => t.name).join(', ');
        throw new BadRequestException(`Cannot generate report: The following investigation tasks must be completed first: ${taskNames}`);
      }
    }
    const caseData = await this.prisma.case.findUnique({ where: { case_id: dto.caseId } });
    if (!caseData) throw new Error('Case not found');
    const db = this.couchdbService.getDatabase();
    const existingReportsResult = await db.find({ selector: { caseId: dto.caseId, category: 'report' } });
    const existingReports = existingReportsResult.docs as FraudReport[];
    const nextVersion = existingReports.length > 0 ? Math.max(...existingReports.map((r) => r.version || 1)) + 1 : 1;
    const reportId = `${dto.caseId}-InvestigationReport-v${nextVersion}`;
    const fileName = `${reportId}.pdf`;
    const evidenceResult = await this.evidenceService.getEvidenceByCaseId(
      dto.caseId,
      userId ?? '',
      tenantId ?? '',
      role ?? 'CMS_SUPERVISOR',
    );
    const evidenceSummary = evidenceResult.evidence;

    const report: any = {
      userId,
      tenantId,
      role,
      reportId,
      caseId: dto.caseId,
      reportType: 'INVESTIGATION_REPORT',
      metadata: [],
      keyFindings: '',
      evidenceSummary,
      decisions: FraudReportOutcome.UNDER_MONITORING,
      investigatorInputs: dto.investigatorInputs,
      supervisorRemarks: dto.supervisorRemarks,
      recommendations: '',
      archived: false,
      version: nextVersion,
      history: [],
      category: 'report',
    };
    const insertResult = await this.couchdbService.insertDocument(reportId, report);

    const currentRev = insertResult.rev;

    const { encrypted, key, iv, authTag } = this.encrypt(file.buffer);
    const hash = this.sha256(encrypted);

    const attachmentResult = await this.couchdbService.insertAttachment(reportId, currentRev, fileName, encrypted, file.mimetype);

    report.metadata.push({
      fileName,
      fileSize: file.size,
      filePath: attachmentResult.filePath,
      mimeType: file.mimetype,
      hash,
      encryption: { key, iv, authTag },
      caseType: caseData.case_type ?? '',
      investigator: caseData.case_owner_user_id ?? '',
      supervisor: '',
      description: dto.description ?? '',
      submittedAt: new Date().toISOString(),
    });

    await this.couchdbService.updateDocument(reportId, report);

    // Send notification to Compliance Officer
    await this.notificationService.sendGroupNotification({
      candidateGroup: 'COMPLIANCE_OFFICER',
      type: 'GENERIC',
      message: `Fraud report ${reportId} for case ${report.caseId} has been approved. Outcome: ${dto.outcome}`,
      metadata: { reportId, caseId: report.caseId, outcome: dto.outcome },
    });

    return report;
  }

  async editFraudReport(reportId: string, updates: Partial<FraudReport>, userId?: string): Promise<FraudReport> {
    const existing = await this.couchdbService.getDocument(reportId);
    if (!existing) throw new Error('Report not found');
    if (existing.locked) {
      // Create new version
      const newVersion = (existing.version ?? 1) + 1;
      const newReport: FraudReport = {
        ...existing,
        ...updates,
        reportId: `${existing.caseId}-v${newVersion}`,
        version: newVersion,
        locked: false,
        history: [...(existing.history ?? []), existing],
        category: 'report',
        metadata: {
          ...existing.metadata,
          submittedAt: new Date().toISOString(),
        },
      };
      await this.couchdbService.insertDocument(newReport.reportId, newReport);
      return newReport;
    } else {
      // Update unlocked report
      const updated: FraudReport = {
        ...existing,
        ...updates,
        category: 'report',
        metadata: {
          ...existing.metadata,
          submittedAt: new Date().toISOString(),
        },
      };
      await this.couchdbService.updateDocument(reportId, updated);
      return updated;
    }
  }

  async approveFraudReport(
    reportId: string,
    outcome: FraudReportOutcome,
    supervisor: string,
    supervisorUserId: string,
  ): Promise<FraudReport> {
    const report = await this.couchdbService.getDocument(reportId);
    if (!report) throw new Error('Report not found');
    report.archived = true;
    report.locked = true;
    report.metadata.approvedAt = new Date().toISOString();
    report.decisions = outcome;
    report.supervisorRemarks = supervisor;
    report.category = 'report';
    await this.couchdbService.updateDocument(reportId, report);
    // Send notification to Compliance Officer
    await this.notificationService.sendGroupNotification({
      candidateGroup: 'COMPLIANCE_OFFICER',
      type: 'GENERIC',
      message: `Fraud report ${reportId} for case ${report.caseId} has been approved. Outcome: ${outcome}`,
      metadata: { reportId, caseId: report.caseId, outcome },
    });
    return report;
  }

  async getFraudReports(caseId: string, userId = 'SYSTEM'): Promise<FraudReport[]> {
    // Fetch all reports for case from CouchDB
    const db = this.couchdbService.getDatabase();
    const result = await db.find({ selector: { caseId, category: 'report' } });
    // Accept userId as an optional second argument for audit logging
    // Sort reports by version descending (latest first)
    const reports = (result.docs as FraudReport[]).sort((a, b) => (b.version || 0) - (a.version || 0));
    return reports;
  }
}
