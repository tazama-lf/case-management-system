import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../../prisma/prisma.service';
import { CaseStatus, TaskStatus, CaseType, Priority, Prisma, SlaState } from '@prisma/client-cms';
import { FraudReport, FraudReportOutcome } from './report.model';
import { NotificationService } from '../notification/notification.service';
import { CouchdbService } from 'src/modules/couchdb/couchdb.service';
import { EvidenceService } from '../evidence/evidence.service';
import { EventLogService } from '../event_log/eventLog.service';
import { UploadReportDto } from './dto/upload-report.dto';
import * as crypto from 'node:crypto';
import { AgeingSummary, monthlyTrend, resolutionTrend, statusDetails } from './types/report.types';
import getDateRange from './helpers/getDateRange';
import { SlaPolicyUtil, DEFAULT_TENANT_KEY } from '../shared/utils/sla-policy.util';
import { computeCaseSlaState } from '../alert-priority/sla-state.util';

/** One independent count per `CaseStatus` — see `ReportsService.STATUS_DISTRIBUTION_MAP`. */
export interface ReportStatusDistribution {
  draft: number;
  pendingCaseCreationApproval: number;
  readyForAssignment: number;
  returned: number;
  assigned: number;
  inProgress: number;
  suspended: number;
  pendingFinalApproval: number;
  pendingCaseReopeningApproval: number;
  autoclosedConfirmed: number;
  autoclosedRefuted: number;
  closedRefuted: number;
  closedConfirmed: number;
  closedInconclusive: number;
  abandoned: number;
}

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly evidenceService: EvidenceService,
    private readonly couchdbService: CouchdbService,
    private readonly notificationService: NotificationService,
    private readonly eventLogService: EventLogService,
    private readonly slaPolicyUtil: SlaPolicyUtil,
  ) {}

  private static readonly CLOSED_STATUSES: CaseStatus[] = [
    CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
    CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
    CaseStatus.STATUS_81_CLOSED_REFUTED,
    CaseStatus.STATUS_82_CLOSED_CONFIRMED,
    CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
    CaseStatus.STATUS_99_ABANDONED,
  ];

  /**
   * Every `CaseStatus` maps to its own independent bucket — none are folded
   * together (e.g. STATUS_82_CLOSED_CONFIRMED and STATUS_83_CLOSED_INCONCLUSIVE
   * are reported separately, not merged into a single "closed" bucket).
   */
  private static readonly STATUS_DISTRIBUTION_MAP: Record<CaseStatus, string> = {
    [CaseStatus.STATUS_00_DRAFT]: 'draft',
    [CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL]: 'pendingCaseCreationApproval',
    [CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT]: 'readyForAssignment',
    [CaseStatus.STATUS_03_RETURNED]: 'returned',
    [CaseStatus.STATUS_10_ASSIGNED]: 'assigned',
    [CaseStatus.STATUS_20_IN_PROGRESS]: 'inProgress',
    [CaseStatus.STATUS_21_SUSPENDED]: 'suspended',
    [CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL]: 'pendingFinalApproval',
    [CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL]: 'pendingCaseReopeningApproval',
    [CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED]: 'autoclosedConfirmed',
    [CaseStatus.STATUS_72_AUTOCLOSED_REFUTED]: 'autoclosedRefuted',
    [CaseStatus.STATUS_81_CLOSED_REFUTED]: 'closedRefuted',
    [CaseStatus.STATUS_82_CLOSED_CONFIRMED]: 'closedConfirmed',
    [CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE]: 'closedInconclusive',
    [CaseStatus.STATUS_99_ABANDONED]: 'abandoned',
  };

  /**
   * FRAUD_AND_AML container cases are excluded everywhere, except while
   * they're still DRAFT or pending case creation approval - at that point
   * they haven't split into their FRAUD/AML siblings yet, so they should
   * still count under their own type in every report/dashboard query.
   */
  private static readonly NON_CONTAINER_CASE_FILTER: Prisma.CaseWhereInput = {
    OR: [
      { case_type: null },
      { case_type: { not: CaseType.FRAUD_AND_AML } },
      {
        case_type: CaseType.FRAUD_AND_AML,
        status: { in: [CaseStatus.STATUS_00_DRAFT, CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL] },
      },
    ],
  };

  /**
   * Abandoned cases are excluded from every report/dashboard query, not just
   * treated as closed - abandoning a case isn't a genuine resolution, so it
   * shouldn't count toward totals, closed/resolved figures, ageing, or
   * investigator workload. `CLOSED_STATUSES` still lists STATUS_99_ABANDONED
   * so it's correctly excluded from "open" breakdowns, but this filter is
   * what keeps abandoned cases out of every count entirely.
   */
  private static readonly EXCLUDE_ABANDONED_FILTER: Prisma.CaseWhereInput = {
    status: { not: CaseStatus.STATUS_99_ABANDONED },
  };

  private static withNonContainerCaseFilter(where: Prisma.CaseWhereInput = {}): Prisma.CaseWhereInput {
    const andFilters = where.AND ? (Array.isArray(where.AND) ? where.AND : [where.AND]) : [];
    return {
      ...where,
      AND: [...andFilters, ReportsService.NON_CONTAINER_CASE_FILTER, ReportsService.EXCLUDE_ABANDONED_FILTER],
    };
  }

  private static withNonContainerTaskCaseFilter(where: Prisma.TaskWhereInput = {}): Prisma.TaskWhereInput {
    return {
      ...where,
      case: {
        is: ReportsService.withNonContainerCaseFilter(),
      },
    };
  }

  /**
   * Builds the common Prisma `where` fragments shared by every report query
   * (case type / priority / investigator / tenant scoping via the related alert).
   */
  private buildCommonCaseFilters(filters?: {
    caseType?: string;
    priority?: string;
    investigator?: string;
    tenantId?: string;
  }): Prisma.CaseWhereInput {
    const where: Record<string, any> = {};
    if (filters?.caseType) where.case_type = filters.caseType;
    if (filters?.priority) where.priority = filters.priority;
    if (filters?.investigator) where.case_owner_user_id = filters.investigator;
    if (filters?.tenantId) where.tenant_id = filters.tenantId;
    return ReportsService.withNonContainerCaseFilter(where);
  }

  /**
   * If a `requestingUserId` is supplied (investigator view), wrap the base filter
   * with the standard "scope to this investigator" OR clause:
   *   - cases they own,
   *   - cases with a task assigned to them,
   *   - every DRAFT case (visible to all investigators, not just its creator),
   *   - every READY_FOR_ASSIGNMENT case (the claimable pool),
   *   - unowned PENDING_CASE_CREATION_APPROVAL cases (matches the Cases page's
   *     "unowned" rule for this status — no creator check).
   *
   * The OR clause is ANDed with the supplied `baseFilters`, so the existing
   * filters (date window, caseType, priority, tenantId, …) are preserved on
   * every branch — investigators still only see cases that match those filters.
   */
  private applyInvestigatorScope(baseFilters: any, requestingUserId?: string): any {
    if (!requestingUserId) return baseFilters;

    return {
      AND: [
        baseFilters,
        {
          OR: [
            // Tasks assigned to the user
            {
              tasks: {
                some: {
                  assigned_user_id: requestingUserId,
                },
              },
            },
            // Case owner is the user
            {
              case_owner_user_id: requestingUserId,
            },
            // Every DRAFT or READY_FOR_ASSIGNMENT case, regardless of owner.
            {
              AND: [{ status: { in: [CaseStatus.STATUS_00_DRAFT, CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT] } }],
            },
            // Unowned pending-approval cases (matches the Cases page's rule for this status)
            {
              AND: [{ status: CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL }, { case_owner_user_id: null }],
            },
          ],
        },
      ],
    };
  }

  private avgResolutionDays(cases: Array<{ created_at: Date; updated_at: Date }>): number | null {
    if (cases.length === 0) return null;
    const totalDays = cases.reduce((sum, c) => sum + (c.updated_at.getTime() - c.created_at.getTime()) / (1000 * 60 * 60 * 24), 0);
    return totalDays / cases.length;
  }

  /** Folds a `groupBy(status)` result into the public status-distribution shape, one independent bucket per `CaseStatus`. */
  private computeStatusDistribution(statusCounts: Array<{ status: CaseStatus; _count: { case_id: number } }>): ReportStatusDistribution {
    const distribution = Object.values(ReportsService.STATUS_DISTRIBUTION_MAP).reduce<Record<string, number>>(
      (acc, key) => ({ ...acc, [key]: 0 }),
      {},
    ) as unknown as ReportStatusDistribution;

    statusCounts.forEach(({ status, _count }) => {
      const mapped = ReportsService.STATUS_DISTRIBUTION_MAP[status];
      if (mapped) {
        (distribution as unknown as Record<string, number>)[mapped] += _count.case_id;
      }
    });

    return distribution;
  }

  private computeCaseTypes(
    typeCounts: Array<{ case_type: CaseType | null; _count: { case_id: number } }>,
  ): Array<{ name: string; count: number; color: string }> {
    return typeCounts
      .filter((item): item is { case_type: CaseType; _count: { case_id: number } } => item.case_type !== null)
      .map(({ case_type: caseType, _count }) => ({
        name: caseType,
        count: _count.case_id,
        color: this.getCaseTypeColor(caseType),
      }));
  }

  private computeOutcomes(outcomeCounts: Array<{ status: CaseStatus; _count: { case_id: number } }>): {
    resolved: number;
    refuted: number;
    confirmed: number;
    inconclusive: number;
    pending: number;
  } {
    const outcomes = { resolved: 0, refuted: 0, confirmed: 0, inconclusive: 0, pending: 0 };

    outcomeCounts.forEach(({ status, _count }) => {
      if (status === CaseStatus.STATUS_82_CLOSED_CONFIRMED || status === CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED) {
        outcomes.confirmed += _count.case_id;
      } else if (status === CaseStatus.STATUS_81_CLOSED_REFUTED || status === CaseStatus.STATUS_72_AUTOCLOSED_REFUTED) {
        outcomes.refuted += _count.case_id;
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
  private async computeMonthlyTrend(
    filters?: {
      caseType?: string;
      priority?: string;
      investigator?: string;
      tenantId?: string;
      requestingUserId?: string;
    },
    dateRange?: string,
  ): Promise<monthlyTrend[]> {
    const { startDate, endDate } = getDateRange(dateRange);
    const dateWindow = { gte: startDate, lte: endDate };
    const commonFilters = this.buildCommonCaseFilters(filters);
    const createdWhere = this.applyInvestigatorScope({ ...commonFilters, created_at: dateWindow }, filters?.requestingUserId);
    const closedWhere = this.applyInvestigatorScope(
      { ...commonFilters, updated_at: dateWindow, status: { in: ReportsService.CLOSED_STATUSES } },
      filters?.requestingUserId,
    );

    const [createdCases, closedCases] = await Promise.all([
      this.prisma.case.findMany({
        where: createdWhere,
        select: { created_at: true },
      }),
      this.prisma.case.findMany({
        where: closedWhere,
        select: { updated_at: true },
      }),
    ]);

    const casesByDate = new Map<string, { created: number; closed: number }>();

    const formatDate = (date: Date): string =>
      date.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

    createdCases.forEach((c) => {
      const createdDate = formatDate(c.created_at);

      if (!casesByDate.has(createdDate)) {
        casesByDate.set(createdDate, { created: 0, closed: 0 });
      }

      const entry = casesByDate.get(createdDate);

      if (entry) {
        entry.created += 1;
      }
    });

    closedCases.forEach((c) => {
      const closedDate = formatDate(c.updated_at);

      if (!casesByDate.has(closedDate)) {
        casesByDate.set(closedDate, { created: 0, closed: 0 });
      }

      const entry = casesByDate.get(closedDate);

      if (entry) {
        entry.closed += 1;
      }
    });

    return Array.from(casesByDate.entries())
      .map(([date, counts]) => ({
        month: date,
        casesCreated: counts.created,
        casesClosed: counts.closed,
      }))
      .sort((a, b) => new Date(a.month).getTime() - new Date(b.month).getTime());
  }

  private async computeStatusDetails(
    statusCounts: Array<{ status: CaseStatus; _count: { case_id: number } }>,
    totalOpenCases: number,
    whereClause: any,
  ): Promise<statusDetails[]> {
    const countByStatus = new Map(statusCounts.map(({ status, _count }) => [status, _count.case_id]));
    const casesInOpenStatuses = await this.prisma.case.findMany({
      where: whereClause,
      select: { status: true, created_at: true, updated_at: true },
    });
    const casesByStatus = casesInOpenStatuses.reduce<Partial<Record<CaseStatus, Array<{ created_at: Date; updated_at: Date }>>>>(
      (acc, caseItem) => ({
        ...acc,
        [caseItem.status]: [...(acc[caseItem.status] ?? []), caseItem],
      }),
      {},
    );

    return Object.values(CaseStatus)
      .filter((status) => !ReportsService.CLOSED_STATUSES.includes(status) && status !== CaseStatus.STATUS_03_RETURNED)
      .map((status) => {
        const count = countByStatus.get(status) ?? 0;
        const percentage = totalOpenCases > 0 ? ((count / totalOpenCases) * 100).toFixed(1) : '0.0';
        const avgAgeDays = this.avgResolutionDays(casesByStatus[status] ?? []);
        const roundedAgeDays = avgAgeDays === null ? null : Math.round(avgAgeDays);
        const avgTimeInStatus =
          roundedAgeDays === null ? 'N/A' : roundedAgeDays === 0 ? '< 1 day' : `${roundedAgeDays} ${roundedAgeDays === 1 ? 'day' : 'days'}`;

        return {
          status: this.formatStatusName(status),
          count,
          percentage: `${percentage}%`,
          avgTimeInStatus,
          currentTrendPeriod: '0',
        };
      });
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
          avgResolutionTime: Math.round(this.avgResolutionDays(monthClosedCases) ?? 0),
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
      isInvestigator?: boolean;
      tenantId: string;
      requestingUserId?: string;
    },
  ): Promise<{
    stats: {
      totalCases: number;
      closedCases: number;
      openCases: number;
      avgResolutionTime: number | null;
      highPriorityCases: number;
      availableCases: number;
      openAssignedCases: number;
      resolvedThisMonth: number;
      overdueCases: number;
    };
    recentCases: Array<{
      priority: string;
      count: number;
    }>;
    statusDistribution: ReportStatusDistribution;
    caseTypes: Array<{
      name: string;
      count: number;
      color: string;
    }>;
    outcomes: {
      resolved: number;
      refuted: number;
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
    openPriorityCounts: Array<{
      priority: string;
      count: number;
      description: string;
    }>;
    openStatusCounts: Array<{
      status: string;
      count: number;
    }>;
  }> {
    const { startDate, endDate } = getDateRange(dateRange);
    const dateWindow = { gte: startDate, lte: endDate };
    // Build the overall scope: date window + filters + (optional) investigator restriction.
    const baseFilters = { created_at: dateWindow, ...this.buildCommonCaseFilters(filters) };
    const whereClause = filters?.isInvestigator ? this.applyInvestigatorScope(baseFilters, filters.requestingUserId) : baseFilters;
    // "Available" means ready for assignment - the specific claimable pool, not
    // every unowned case in any open status.
    const availableCasesWhere: Prisma.CaseWhereInput = {
      ...baseFilters,
      status: CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT,
    };
    const openCasesWhere: Prisma.CaseWhereInput = { ...whereClause, status: { notIn: ReportsService.CLOSED_STATUSES } };
    // "Open & Assigned" excludes closed AND draft cases - a draft isn't being
    // actively investigated yet, so it shouldn't count as open & assigned work,
    // even though it still shows up in the general open status/priority breakdown.
    const openAssignedCasesWhere: Prisma.CaseWhereInput = {
      ...whereClause,
      status: { notIn: [...ReportsService.CLOSED_STATUSES, CaseStatus.STATUS_00_DRAFT] },
    };
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const resolvedThisMonthWhere = this.applyInvestigatorScope(
      {
        ...this.buildCommonCaseFilters(filters),
        status: { in: ReportsService.CLOSED_STATUSES },
        updated_at: { gte: monthStart, lte: now },
      },
      filters?.isInvestigator ? filters.requestingUserId : undefined,
    );
    const closedWindowFilters = {
      updated_at: dateWindow,
      ...this.buildCommonCaseFilters(filters),
    };
    // Closed Cases is role-scoped like every other stat - Investigators see their
    // own closed cases, Supervisors see all. The Dashboard's own "closed this
    // month" concept is resolvedThisMonthWhere above, scoped the same way.
    const closedCasesWhere = this.applyInvestigatorScope(
      { ...closedWindowFilters, status: { in: ReportsService.CLOSED_STATUSES } },
      filters?.requestingUserId,
    );
    // Run all aggregate queries that share these scopes in parallel.
    const [
      openScopedCases,
      statusCounts,
      typeCounts,
      totalCases,
      closedCases,
      availableCases,
      openAssignedCases,
      resolvedThisMonth,
      closedCasesWithTimes,
      outcomeCounts,
    ] = await Promise.all([
      this.prisma.case.findMany({
        where: openCasesWhere,
        select: { status: true, priority: true, sla_due_at: true, sla_started_at: true },
      }),
      this.prisma.case.groupBy({ by: ['status'], where: whereClause, _count: { case_id: true } }),
      // Case Types chart is open-cases-only - closed FRAUD/AML cases shouldn't
      // inflate a breakdown meant to reflect the current active caseload.
      this.prisma.case.groupBy({ by: ['case_type'], where: openCasesWhere, _count: { case_id: true } }),
      this.prisma.case.count({ where: whereClause }),
      this.prisma.case.count({ where: closedCasesWhere }),
      this.prisma.case.count({ where: availableCasesWhere }),
      this.prisma.case.count({ where: openAssignedCasesWhere }),
      this.prisma.case.count({ where: resolvedThisMonthWhere }),
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
    const [monthlyTrend, statusDetails, resolutionTrend, slaEscalationRatios] = await Promise.all([
      this.computeMonthlyTrend(filters),
      this.computeStatusDetails(statusCounts, totalCases, whereClause),
      this.computeResolutionTrend(filters),
      this.slaPolicyUtil.getEscalationRatios(filters?.tenantId ?? DEFAULT_TENANT_KEY),
    ]);

    const openCases = openScopedCases.length;

    // "Open Cases by Priority" excludes closed AND draft cases - a draft hasn't
    // been triaged yet, so it shouldn't skew the priority breakdown of active work.
    const priorityScopedCases = openScopedCases.filter((c) => c.status !== CaseStatus.STATUS_00_DRAFT);
    const lowPriorityCases = priorityScopedCases.filter((c) => c.priority === Priority.LOW).length;
    const mediumPriorityCases = priorityScopedCases.filter((c) => c.priority === Priority.MEDIUM).length;
    const highPriorityCases = priorityScopedCases.filter((c) => c.priority === Priority.HIGH).length;
    // Overdue means SLA state BREACHED - the same derived state shown on the Cases
    // page (sla-state.util.ts), not just a raw sla_due_at < now comparison.
    const overdueCases = openScopedCases.filter((c) => computeCaseSlaState(c, slaEscalationRatios) === SlaState.BREACHED).length;
    const rawStatusCounts = openScopedCases.reduce<Partial<Record<CaseStatus, number>>>(
      (acc, c) => ({ ...acc, [c.status]: (acc[c.status] ?? 0) + 1 }),
      {},
    );
    const openStatusCounts = Object.values(CaseStatus)
      .filter((status) => !ReportsService.CLOSED_STATUSES.includes(status) && status !== CaseStatus.STATUS_03_RETURNED)
      .map((status) => ({ status, count: rawStatusCounts[status] ?? 0 }));

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
        avgResolutionTime: avgResolutionTime === null ? null : Math.round(avgResolutionTime),
        highPriorityCases,
        availableCases,
        openAssignedCases,
        resolvedThisMonth,
        overdueCases,
      },
      recentCases,
      statusDistribution,
      caseTypes,
      outcomes,
      monthlyTrend,
      resolutionTrend,
      statusDetails,
      openPriorityCounts: [
        { priority: 'Low', count: lowPriorityCases, description: 'Low priority cases requiring attention' },
        { priority: 'Medium', count: mediumPriorityCases, description: 'Medium priority cases requiring attention' },
        { priority: 'High', count: highPriorityCases, description: 'High priority cases requiring attention' },
      ],
      openStatusCounts,
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
      where: ReportsService.withNonContainerCaseFilter({
        created_at: {
          gte: startDate,
          lte: endDate,
        },
        case_owner_user_id: { not: null },
        tenant_id: tenantId,
      }),
      select: {
        case_owner_user_id: true,
      },
      distinct: ['case_owner_user_id'],
    });

    const workloadData = await Promise.all(
      investigators.map(async ({ case_owner_user_id: caseOwnerUserId }) => {
        if (!caseOwnerUserId) return null;

        const [activeCases, pendingTasks] = await Promise.all([
          // Active means closed AND draft excluded, same as the Dashboard's
          // "Open & Assigned Cases" - a draft isn't active investigation work yet.
          this.prisma.case.count({
            where: ReportsService.withNonContainerCaseFilter({
              case_owner_user_id: caseOwnerUserId,
              created_at: {
                gte: startDate,
                lte: endDate,
              },
              status: { notIn: [...ReportsService.CLOSED_STATUSES, CaseStatus.STATUS_00_DRAFT] },
            }),
          }),
          this.prisma.task.count({
            where: ReportsService.withNonContainerTaskCaseFilter({
              assigned_user_id: caseOwnerUserId,
              status: {
                in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
              },
            }),
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
          where: ReportsService.withNonContainerCaseFilter({
            case_owner_user_id: caseOwnerUserId,
            created_at: {
              gte: startDate,
              lte: endDate,
            },
            tenant_id: tenantId,
            status: { in: ReportsService.CLOSED_STATUSES },
          }),
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
            where: ReportsService.withNonContainerCaseFilter({
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              tenant_id: tenantId,
              status: {
                in: [CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED, CaseStatus.STATUS_82_CLOSED_CONFIRMED],
              },
            }),
          }),
          this.prisma.case.count({
            where: ReportsService.withNonContainerCaseFilter({
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              tenant_id: tenantId,
              status: {
                in: [CaseStatus.STATUS_72_AUTOCLOSED_REFUTED, CaseStatus.STATUS_81_CLOSED_REFUTED],
              },
            }),
          }),
          this.prisma.case.count({
            where: ReportsService.withNonContainerCaseFilter({
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              status: CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
              tenant_id: tenantId,
            }),
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
            where: ReportsService.withNonContainerCaseFilter({
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              tenant_id: tenantId,
            }),
          }),
          // Active means closed AND draft excluded, same as the Dashboard's
          // "Open & Assigned Cases" - a draft isn't active investigation work yet.
          this.prisma.case.count({
            where: ReportsService.withNonContainerCaseFilter({
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              tenant_id: tenantId,
              status: { notIn: [...ReportsService.CLOSED_STATUSES, CaseStatus.STATUS_00_DRAFT] },
            }),
          }),
          this.prisma.case.count({
            where: ReportsService.withNonContainerCaseFilter({
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              tenant_id: tenantId,
              status: { in: ReportsService.CLOSED_STATUSES },
            }),
          }),
          this.prisma.task.count({
            where: ReportsService.withNonContainerTaskCaseFilter({
              assigned_user_id: caseOwnerUserId,
              tenant_id: tenantId,
              status: {
                in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
              },
            }),
          }),
          this.prisma.case.findMany({
            where: ReportsService.withNonContainerCaseFilter({
              case_owner_user_id: caseOwnerUserId,
              created_at: { gte: startDate, lte: endDate },
              tenant_id: tenantId,
              status: { in: ReportsService.CLOSED_STATUSES },
            }),
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
              where: ReportsService.withNonContainerCaseFilter({
                case_owner_user_id: caseOwnerUserId,
                created_at: {
                  gte: monthStart,
                  lte: monthEnd,
                },
                tenant_id: tenantId,
              }),
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
      avgCaseAge: number | null;
      avgResolutionTime: number | null;
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
      caseType: 'FRAUD' | 'AML';
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
    let baseFilters: any = {};

    if (filters?.tenantId) {
      baseFilters.tenant_id = filters.tenantId;
    }
    baseFilters = ReportsService.withNonContainerCaseFilter(baseFilters);

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

    const avgCaseAge = casesWithAge.length > 0 ? casesWithAge.reduce((sum, case_) => sum + case_.ageDays, 0) / casesWithAge.length : null;

    const closedCasesWithTimes = casesWithAge.filter((case_) => ReportsService.CLOSED_STATUSES.includes(case_.status as any));

    const avgResolutionTime =
      closedCasesWithTimes.length > 0
        ? closedCasesWithTimes.reduce((sum, case_) => {
            const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
            return sum + resolutionTime;
          }, 0) / closedCasesWithTimes.length
        : null;

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
      Object.values(CaseType)
        .filter((type) => type !== CaseType.FRAUD_AND_AML)
        .map(async (type) => {
          let caseTypeBaseFilters: any = {
            status: {
              in: ReportsService.CLOSED_STATUSES,
            },
            case_type: type,
          };

          if (filters?.tenantId) {
            caseTypeBaseFilters.tenant_id = filters.tenantId;
          }
          caseTypeBaseFilters = ReportsService.withNonContainerCaseFilter(caseTypeBaseFilters);

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

    let recentClosedBaseFilters: any = {
      updated_at: {
        gte: trendStartDate,
      },
      status: { in: ReportsService.CLOSED_STATUSES },
    };

    if (filters?.tenantId) {
      recentClosedBaseFilters.tenant_id = filters.tenantId;
    }
    recentClosedBaseFilters = ReportsService.withNonContainerCaseFilter(recentClosedBaseFilters);

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
        avgCaseAge: avgCaseAge === null ? null : Math.round(avgCaseAge),
        avgResolutionTime: avgResolutionTime === null ? null : Math.round(avgResolutionTime),
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

  async getFilters(filters?: { tenantId?: string; requestingUserId?: string }): Promise<{
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
      where: ReportsService.withNonContainerCaseFilter(filters?.tenantId ? { tenant_id: filters.tenantId } : {}),
      select: { case_type: true },
      distinct: ['case_type'],
    });

    const priorities = await this.prisma.case.findMany({
      where: ReportsService.withNonContainerCaseFilter(filters?.tenantId ? { tenant_id: filters.tenantId } : {}),
      select: { priority: true },
      distinct: ['priority'],
    });

    const investigators = await this.prisma.case.findMany({
      where: ReportsService.withNonContainerCaseFilter({
        ...(filters?.tenantId ? { tenant_id: filters.tenantId } : {}),
        ...(filters?.requestingUserId ? { case_owner_user_id: filters.requestingUserId } : { case_owner_user_id: { not: null } }),
      }),
      select: { case_owner_user_id: true },
      distinct: ['case_owner_user_id'],
    });
    const investigatorIds = investigators.map((i) => i.case_owner_user_id).filter((userId): userId is string => Boolean(userId));
    const usernames = await this.prisma.cms_usernames.findMany({
      where: {
        ...(filters?.tenantId ? { tenant_id: filters.tenantId } : {}),
        user_id: { in: investigatorIds },
      },
      select: { user_id: true, name: true },
    });
    const nameByUserId = new Map(usernames.map((user) => [user.user_id, user.name]));

    return {
      caseTypes: caseTypes
        .filter((ct): ct is { case_type: CaseType } => ct.case_type !== null)
        .map((ct) => ({
          value: ct.case_type,
          label: ct.case_type,
        })),
      priorities: priorities.map((p) => ({
        value: p.priority,
        label: p.priority,
      })),
      investigators: investigators.map((i) => ({
        value: i.case_owner_user_id ?? '',
        label: i.case_owner_user_id ? (nameByUserId.get(i.case_owner_user_id) ?? i.case_owner_user_id) : 'Unassigned',
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
        where: ReportsService.withNonContainerTaskCaseFilter({ case_id: dto.caseId }),
      });

      const investigationTasks = caseTasks.filter((task) => task.name?.toLowerCase().includes('investigate'));

      const incompleteTasks = investigationTasks.filter((task) => task.status !== TaskStatus.STATUS_30_COMPLETED);

      if (incompleteTasks.length > 0) {
        const taskNames = incompleteTasks.map((t) => t.name).join(', ');
        throw new BadRequestException(`Cannot generate report: The following investigation tasks must be completed first: ${taskNames}`);
      }
    }
    const caseData = await this.prisma.case.findFirst({ where: ReportsService.withNonContainerCaseFilter({ case_id: dto.caseId }) });
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
