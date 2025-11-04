import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseService } from '../case/case.service';
import { TaskService } from '../task/task.service';
import { AuditLogService } from '../audit/auditLog.service';
import { CaseStatus, TaskStatus, AlertType } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caseService: CaseService,
    private readonly taskService: TaskService,
    private readonly auditLogService: AuditLogService,
  ) {}

  private getDateRange(dateRange?: string): { startDate: Date; endDate: Date } {
    const now = new Date();
    let endDate = new Date(now);
    let startDate = new Date(now);

    switch (dateRange) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'yesterday':
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate.setDate(now.getDate() - 1);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last7':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'last30':
        startDate.setDate(now.getDate() - 30);
        break;
      case 'last90':
        startDate.setDate(now.getDate() - 90);
        break;
      case 'thisMonth':
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case 'lastYear':
        startDate = new Date(now.getFullYear() - 1, 0, 1);
        endDate = new Date(now.getFullYear() - 1, 11, 31);
        break;
      default:
        startDate.setDate(now.getDate() - 30);
    }

    return { startDate, endDate };
  }

  async getCaseStatus(dateRange?: string, filters?: { caseType?: string; priority?: string; investigator?: string }) {
    const { startDate, endDate } = this.getDateRange(dateRange);

    const whereClause: any = {
      created_at: {
        gte: startDate,
        lte: endDate,
      },
    };

    if (filters?.caseType) {
      whereClause.case_type = filters.caseType;
    }
    if (filters?.priority) {
      whereClause.priority = filters.priority;
    }
    if (filters?.investigator) {
      whereClause.case_owner_user_id = filters.investigator;
    }

    const statusCounts = await this.prisma.case.groupBy({
      by: ['status'],
      where: whereClause,
      _count: { case_id: true },
    });

    const typeCounts = await this.prisma.case.groupBy({
      by: ['case_type'],
      where: whereClause,
      _count: { case_id: true },
    });

    const totalCases = await this.prisma.case.count({
      where: whereClause,
    });

    const closedCasesWhere = {
      ...whereClause,
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

    const closedCases = await this.prisma.case.count({
      where: closedCasesWhere,
    });

    const allClosedCasesWithTimes = await this.prisma.case.findMany({
      where: {
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

    const avgResolutionTime =
      allClosedCasesWithTimes.length > 0
        ? allClosedCasesWithTimes.reduce((sum, case_) => {
            const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
            return sum + resolutionTime;
          }, 0) / allClosedCasesWithTimes.length
        : 0;

    const statusMap: Record<CaseStatus, string> = {
      [CaseStatus.STATUS_10_ASSIGNED]: 'assigned',
      [CaseStatus.STATUS_20_IN_PROGRESS]: 'inProgress',
      [CaseStatus.STATUS_00_DRAFT]: 'draft',
      [CaseStatus.STATUS_21_SUSPENDED]: 'suspended',
      [CaseStatus.STATUS_22_PENDING_FINAL_APPROVAL]: 'pendingApproval',
      [CaseStatus.STATUS_01_PENDING_CASE_CREATION_APPROVAL]: 'pendingApproval',
      [CaseStatus.STATUS_02_READY_FOR_ASSIGNMENT]: 'assigned',
      [CaseStatus.STATUS_03_RETURNED]: 'draft',
      [CaseStatus.STATUS_31_PENDING_CASE_REOPENING_APPROVAL]: 'pendingApproval',
      [CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED]: 'closed',
      [CaseStatus.STATUS_72_AUTOCLOSED_REFUTED]: 'closed',
      [CaseStatus.STATUS_81_CLOSED_REFUTED]: 'closed',
      [CaseStatus.STATUS_82_CLOSED_CONFIRMED]: 'closed',
      [CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE]: 'closed',
      [CaseStatus.STATUS_99_ABANDONED]: 'closed',
    };

    const closedStatuses = [
      CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED,
      CaseStatus.STATUS_72_AUTOCLOSED_REFUTED,
      CaseStatus.STATUS_81_CLOSED_REFUTED,
      CaseStatus.STATUS_82_CLOSED_CONFIRMED,
      CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
    ];

    const statusDistribution = {
      assigned: 0,
      inProgress: 0,
      draft: 0,
      suspended: 0,
      pendingApproval: 0,
      closed: 0,
    };

    statusCounts.forEach(({ status, _count }) => {
      if (closedStatuses.includes(status as any)) {
        statusDistribution.closed += _count.case_id;
      } else if (statusMap[status]) {
        const mappedStatus = statusMap[status] as keyof typeof statusDistribution;
        statusDistribution[mappedStatus] += _count.case_id;
      }
    });

    const caseTypes = typeCounts.map(({ case_type, _count }) => ({
      name: case_type || 'NONE',
      count: _count.case_id,
      color: this.getCaseTypeColor(case_type),
    }));

    const outcomeCounts = await this.prisma.case.groupBy({
      by: ['status'],
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
        status: {
          in: closedStatuses,
        },
      },
      _count: { case_id: true },
    });

    const outcomes = {
      resolved: 0,
      confirmed: 0,
      inconclusive: 0,
      pending: 0,
    };

    outcomeCounts.forEach(({ status, _count }) => {
      if (status === CaseStatus.STATUS_82_CLOSED_CONFIRMED || status === CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED) {
        outcomes.confirmed += _count.case_id;
      } else if (status === CaseStatus.STATUS_81_CLOSED_REFUTED || status === CaseStatus.STATUS_72_AUTOCLOSED_REFUTED) {
        outcomes.resolved += _count.case_id;
      } else if (status === CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE) {
        outcomes.inconclusive += _count.case_id;
      }
    });

    const monthlyTrend: any[] = [];
    const now = new Date();
    const trendStartDate = new Date(now.getFullYear(), now.getMonth() - 5, 1);

    const recentCases = await this.prisma.case.findMany({
      where: {
        created_at: {
          gte: trendStartDate,
        },
      },
      select: {
        created_at: true,
        updated_at: true,
        status: true,
      },
      orderBy: {
        created_at: 'asc',
      },
    });

    const casesByDate = new Map<string, { created: number; closed: number }>();

    recentCases.forEach((case_) => {
      const createdDate = case_.created_at.toLocaleDateString('en-US', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });

      if (!casesByDate.has(createdDate)) {
        casesByDate.set(createdDate, { created: 0, closed: 0 });
      }

      const dateEntry = casesByDate.get(createdDate)!;
      dateEntry.created += 1;

      if (closedStatuses.includes(case_.status as any)) {
        dateEntry.closed += 1;
      }
    });

    casesByDate.forEach((value, date) => {
      monthlyTrend.push({
        month: date,
        casesCreated: value.created,
        casesClosed: value.closed,
      });
    });

    const statusDetails: any[] = await Promise.all(
      statusCounts.map(async ({ status, _count }) => {
        const percentage = totalCases > 0 ? ((_count.case_id / totalCases) * 100).toFixed(1) : '0.0';

        const casesInStatus = await this.prisma.case.findMany({
          where: {
            ...whereClause,
            status: status,
          },
          select: {
            created_at: true,
            updated_at: true,
          },
        });

        let avgTimeInStatus = 'N/A';
        if (casesInStatus.length > 0) {
          const totalDays = casesInStatus.reduce((sum, case_) => {
            const timeInStatus = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
            return sum + timeInStatus;
          }, 0);
          const avgDays = Math.round(totalDays / casesInStatus.length);
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

    const resolutionTrend: Array<{ month: string; avgResolutionTime: number; casesResolved: number }> = [];
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);

      const monthClosedCases = await this.prisma.case.findMany({
        where: {
          updated_at: {
            gte: monthStart,
            lte: monthEnd,
          },
          status: {
            in: closedStatuses,
          },
        },
        select: {
          created_at: true,
          updated_at: true,
        },
      });

      const avgResolutionTimeMonth =
        monthClosedCases.length > 0
          ? monthClosedCases.reduce((sum, case_) => {
              const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
              return sum + resolutionTime;
            }, 0) / monthClosedCases.length
          : 0;

      resolutionTrend.push({
        month: monthStart.toLocaleString('default', { month: 'short', year: 'numeric' }),
        avgResolutionTime: Math.round(avgResolutionTimeMonth),
        casesResolved: monthClosedCases.length,
      });
    }

    return {
      stats: {
        totalCases,
        closedCases,
        openCases: totalCases - closedCases,
        avgResolutionTime: Math.round(avgResolutionTime),
      },
      statusDistribution,
      caseTypes,
      outcomes,
      monthlyTrend,
      resolutionTrend,
      statusDetails,
    };
  }

  async getInvestigatorWorkload(dateRange?: string) {
    const { startDate, endDate } = this.getDateRange(dateRange);

    const investigators = await this.prisma.case.findMany({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
        case_owner_user_id: { not: null },
      },
      select: {
        case_owner_user_id: true,
      },
      distinct: ['case_owner_user_id'],
    });

    const workloadData = await Promise.all(
      investigators.map(async ({ case_owner_user_id }) => {
        if (!case_owner_user_id) return null;

        const [activeCases, pendingTasks] = await Promise.all([
          this.prisma.case.count({
            where: {
              case_owner_user_id,
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
              assigned_user_id: case_owner_user_id,
              status: {
                in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
              },
            },
          }),
        ]);

        return {
          investigatorId: case_owner_user_id,
          name: `User ${case_owner_user_id}`,
          activeCases,
          pendingTasks,
        };
      }),
    );

    const validWorkloadData = workloadData.filter(Boolean);

    const efficiencyData = await Promise.all(
      investigators.map(async ({ case_owner_user_id }) => {
        if (!case_owner_user_id) return null;

        const cases = await this.prisma.case.findMany({
          where: {
            case_owner_user_id,
            created_at: {
              gte: startDate,
              lte: endDate,
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
          name: `User ${case_owner_user_id}`,
          avgDays: Math.round(avgResolutionDays),
        };
      }),
    );

    const outcomeData = await Promise.all(
      investigators.map(async ({ case_owner_user_id }) => {
        if (!case_owner_user_id) return null;

        const [confirmed, refuted, inconclusive] = await Promise.all([
          this.prisma.case.count({
            where: {
              case_owner_user_id,
              created_at: { gte: startDate, lte: endDate },
              status: {
                in: [CaseStatus.STATUS_71_AUTOCLOSED_CONFIRMED, CaseStatus.STATUS_82_CLOSED_CONFIRMED],
              },
            },
          }),
          this.prisma.case.count({
            where: {
              case_owner_user_id,
              created_at: { gte: startDate, lte: endDate },
              status: {
                in: [CaseStatus.STATUS_72_AUTOCLOSED_REFUTED, CaseStatus.STATUS_81_CLOSED_REFUTED],
              },
            },
          }),
          this.prisma.case.count({
            where: {
              case_owner_user_id,
              created_at: { gte: startDate, lte: endDate },
              status: CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE,
            },
          }),
        ]);

        return {
          name: `User ${case_owner_user_id}`,
          confirmed,
          refuted,
          inconclusive,
        };
      }),
    );

    const performanceData = await Promise.all(
      investigators.map(async ({ case_owner_user_id }) => {
        if (!case_owner_user_id) return null;

        const [totalCases, activeCases, closedCases, pendingTasks, closedCasesWithTimes] = await Promise.all([
          this.prisma.case.count({
            where: {
              case_owner_user_id,
              created_at: { gte: startDate, lte: endDate },
            },
          }),
          this.prisma.case.count({
            where: {
              case_owner_user_id,
              created_at: { gte: startDate, lte: endDate },
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
              case_owner_user_id,
              created_at: { gte: startDate, lte: endDate },
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
              assigned_user_id: case_owner_user_id,
              status: {
                in: [TaskStatus.STATUS_10_ASSIGNED, TaskStatus.STATUS_20_IN_PROGRESS],
              },
            },
          }),
          this.prisma.case.findMany({
            where: {
              case_owner_user_id,
              created_at: { gte: startDate, lte: endDate },
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
          investigatorId: case_owner_user_id,
          investigator: `User ${case_owner_user_id}`,
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

    const volumeTrend: Array<{ month: string; investigators: { [key: string]: number } }> = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0);
      const monthLabel = monthStart.toLocaleString('default', { month: 'short', year: 'numeric' });

      const monthData = { month: monthLabel, investigators: {} };

      for (const { case_owner_user_id } of investigators) {
        if (!case_owner_user_id) continue;

        const caseCount = await this.prisma.case.count({
          where: {
            case_owner_user_id,
            created_at: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        });

        monthData.investigators[`User ${case_owner_user_id}`] = caseCount;
      }

      volumeTrend.push(monthData);
    }

    const totalInvestigators = validWorkloadData.length;
    const avgCasesPerInvestigator =
      totalInvestigators > 0 ? validWorkloadData.reduce((sum, w) => sum + (w?.activeCases || 0), 0) / totalInvestigators : 0;

    const validPerformanceData = performanceData.filter(Boolean);
    const totalResolutionTime = validPerformanceData.reduce((sum, w) => sum + (w?.avgResolutionTime || 0), 0);
    const investigatorsWithClosedCases = validPerformanceData.filter((w) => (w?.avgResolutionTime || 0) > 0).length;
    const avgResolutionTime = investigatorsWithClosedCases > 0 ? totalResolutionTime / investigatorsWithClosedCases : 0;

    const totalClosureRate = validPerformanceData.reduce((sum, w) => sum + (w?.caseClosureRate || 0), 0);
    const avgCaseClosureRate = validPerformanceData.length > 0 ? totalClosureRate / validPerformanceData.length : 0;

    return {
      stats: {
        totalInvestigators,
        avgCasesPerInvestigator: Math.round(avgCasesPerInvestigator),
        avgResolutionTime: Math.round(avgResolutionTime),
        caseClosureRate: Math.round(avgCaseClosureRate),
      },
      workloadData: validWorkloadData,
      volumeTrend: volumeTrend,
      efficiencyData: efficiencyData.filter(Boolean),
      outcomeData: outcomeData.filter(Boolean),
      performanceData: performanceData.filter(Boolean),
    };
  }

  async getAuditLogs(dateRange?: string) {
    const { startDate, endDate } = this.getDateRange(dateRange);

    const auditLogs = await this.auditLogService.getLogs(100, 0);

    const filteredLogs = auditLogs.filter((log) => log.performed_at >= startDate && log.performed_at <= endDate);

    const caseActions = filteredLogs.filter(
      (log) => log.entity_name === 'Case' || (log.action_performed && log.action_performed.includes('Case')),
    ).length;

    const userSessions = filteredLogs.filter(
      (log) => log.action_performed && (log.action_performed.includes('login') || log.action_performed.includes('session')),
    ).length;

    const systemWarnings = filteredLogs.filter(
      (log) => log.outcome && (log.outcome.includes('WARNING') || log.outcome.includes('ERROR')),
    ).length;

    const formattedLogs = filteredLogs.map((log) => {
      return {
        audit_log_id: log.audit_log_id ? log.audit_log_id.toString() : '',
        user_id: log.user_id ? log.user_id.toString() : '',
        operation: log.operation ? log.operation.toString() : '',
        entity_name: log.entity_name ? log.entity_name.toString() : '',
        action_performed: log.action_performed ? log.action_performed.toString() : '',
        outcome: log.outcome ? log.outcome.toString() : '',
        performed_at: log.performed_at
          ? log.performed_at.toLocaleString('en-US', {
              month: '2-digit',
              day: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
            })
          : '',
        type: this.getAuditLogType(log.outcome || ''),
      };
    });

    return {
      stats: {
        totalLogs: filteredLogs.length,
        caseActions,
        userSessions,
        systemWarnings,
      },
      auditLogs: formattedLogs,
    };
  }

  async getCaseAgeing(dateRange?: string) {
    const { startDate, endDate } = this.getDateRange(dateRange);

    const cases = await this.prisma.case.findMany({
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

    const ageingByStatus: any[] = [];
    const statusGroups = casesWithAge.reduce(
      (acc, case_) => {
        if (!acc[case_.status]) acc[case_.status] = [];
        acc[case_.status].push(case_);
        return acc;
      },
      {} as Record<string, typeof casesWithAge>,
    );

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
    ageingDistribution.forEach((item) => {
      item.percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
    });

    const caseTypeResolution = await Promise.all(
      Object.values(AlertType).map(async (type) => {
        const whereClause: any = {
          status: {
            in: closedStatuses,
          },
        };

        if (type === AlertType.NONE) {
          whereClause.OR = [{ case_type: null }, { case_type: AlertType.NONE }];
        } else {
          whereClause.case_type = type;
        }

        const closedCasesOfType = await this.prisma.case.findMany({
          where: whereClause,
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

    const resolutionTrend: any[] = [];
    const currentDate = new Date();
    const trendStartDate = new Date(currentDate.getFullYear(), currentDate.getMonth() - 5, 1);

    const recentClosedCases = await this.prisma.case.findMany({
      where: {
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
      },
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

    const caseDetails = casesWithAge.slice(0, 5).map((case_) => ({
      caseId: case_.case_id,
      type: case_.case_type || 'NONE',
      status: this.formatStatusName(case_.status),
      createdDate: case_.created_at.toLocaleDateString('en-US'),
      ageDays: case_.ageDays,
      priority: case_.priority,
      userId: case_.case_owner_user_id || null,
      investigator: case_.case_owner_user_id ? `User ${case_.case_owner_user_id}` : 'Unassigned',
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
      ageingDistribution,
      caseTypeResolution,
      caseDetails,
    };
  }

  private getCaseTypeColor(caseType: AlertType | null): string {
    switch (caseType) {
      case AlertType.FRAUD:
        return '#ef4444';
      case AlertType.AML:
        return '#8b5cf6';
      case AlertType.FRAUD_AND_AML:
        return '#f59e0b';
      default:
        return '#3b82f6';
    }
  }

  private getTaskStatusColor(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.STATUS_30_COMPLETED:
        return '#10b981';
      case TaskStatus.STATUS_20_IN_PROGRESS:
        return '#3b82f6';
      case TaskStatus.STATUS_01_UNASSIGNED:
        return '#6b7280';
      case TaskStatus.STATUS_21_BLOCKED:
        return '#f59e0b';
      case TaskStatus.STATUS_10_ASSIGNED:
        return '#8b5cf6';
      default:
        return '#6b7280';
    }
  }

  private formatStatusName(status: CaseStatus): string {
    return status.replace('STATUS_', '').replace(/_/g, ' ');
  }

  private formatTaskStatusName(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.STATUS_30_COMPLETED:
        return 'Completed';
      case TaskStatus.STATUS_20_IN_PROGRESS:
        return 'In Progress';
      case TaskStatus.STATUS_01_UNASSIGNED:
        return 'Unassigned';
      case TaskStatus.STATUS_21_BLOCKED:
        return 'Blocked';
      case TaskStatus.STATUS_10_ASSIGNED:
        return 'Assigned';
      default:
        return 'Unknown';
    }
  }

  private getAuditLogType(outcome: string | null | undefined): 'Info' | 'Success' | 'Warning' | 'Error' {
    if (!outcome || typeof outcome !== 'string') return 'Info';

    if (outcome.includes('SUCCESS') || outcome.includes('COMPLETED')) return 'Success';
    if (outcome.includes('WARNING')) return 'Warning';
    if (outcome.includes('ERROR') || outcome.includes('FAILED')) return 'Error';
    return 'Info';
  }

  async getFilters() {
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
        value: ct.case_type || 'NONE',
        label: ct.case_type || 'None',
      })),
      priorities: priorities.map((p) => ({
        value: p.priority || 'NONE',
        label: p.priority || 'None',
      })),
      investigators: investigators.map((i) => ({
        value: i.case_owner_user_id || '',
        label: i.case_owner_user_id ? `User ${i.case_owner_user_id.slice(0, 8)}` : 'Unassigned',
      })),
    };
  }
}
