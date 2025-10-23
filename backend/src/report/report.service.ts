
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CaseService } from '../case/case.service';
import { TaskService } from '../task/task.service';
import { UserService } from '../shared/user.service';
import { AuditLogService } from '../audit/auditLog.service';
import { exportToCSV, exportToExcel, exportToPDF } from '../shared/utils/report-export.util';
import { CaseStatus, TaskStatus, CaseType, Priority } from '@prisma/client';

@Injectable()
export class ReportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly caseService: CaseService,
    private readonly taskService: TaskService,
    private readonly userService: UserService,
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

  async getCaseStatus(
    dateRange?: string, 
    filters?: { caseType?: string; priority?: string; investigator?: string }
  ) {
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

    const closedCasesWithTimes = await this.prisma.case.findMany({
      where: closedCasesWhere,
      select: {
        created_at: true,
        updated_at: true,
      },
    });

    const avgResolutionTime = closedCasesWithTimes.length > 0
      ? closedCasesWithTimes.reduce((sum, case_) => {
          const resolutionTime = (case_.updated_at.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24);
          return sum + resolutionTime;
        }, 0) / closedCasesWithTimes.length
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
    for (let i = 5; i >= 0; i--) {
      const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 0, 23, 59, 59, 999);
      
      const [created, closed] = await Promise.all([
        this.prisma.case.count({
          where: {
            created_at: {
              gte: monthStart,
              lte: monthEnd,
            },
          },
        }),
        this.prisma.case.count({
          where: {
            updated_at: {
              gte: monthStart,
              lte: monthEnd,
            },
            status: {
              in: closedStatuses,
            },
          },
        }),
      ]);

      monthlyTrend.push({
        month: monthStart.toLocaleDateString('en-US', { month: 'short' }),
        casesCreated: created,
        casesClosed: closed,
      });
    }

    const statusDetails: any[] = statusCounts.map(({ status, _count }) => {
      const percentage = totalCases > 0 ? ((_count.case_id / totalCases) * 100).toFixed(1) : '0.0';
      return {
        status: this.formatStatusName(status),
        count: _count.case_id,
        percentage: `${percentage}%`,
        avgTimeInStatus: 'N/A',
        currentTrendPeriod: '+0%', 
      };
    });

    return {
      stats: {
        totalCases,
        closedCases,
        openCases: totalCases - closedCases,
        avgResolutionTime: Math.round(avgResolutionTime * 10) / 10,
      },
      statusDistribution,
      caseTypes,
      outcomes,
      monthlyTrend,
      statusDetails,
    };
  }

  async getInvestigatorWorkload(dateRange?: string) {
    const { startDate, endDate } = this.getDateRange(dateRange);
    // Find all tasks in the date range, including related case
    const tasks = await this.prisma.task.findMany({
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
        case: {
          created_at: {
            gte: startDate,
            lte: endDate,
          },
        },
      },
      include: { case: true },
    });

    // Aggregate by investigator
    const investigatorIds = Array.from(
      new Set(tasks.map((task: any) => task.assigned_user_id).filter((id: any) => typeof id === 'string' && id))
    );
    const investigatorDetails: Record<string, any> = {};
    for (const userId of investigatorIds) {
      try {
        investigatorDetails[userId as string] = await this.userService.getUserDetails(userId as string);
      } catch {
        investigatorDetails[userId as string] = { username: 'Unknown', firstName: '', lastName: '', roles: [] };
      }
    }
    const investigatorMap: Record<string, any> = {};
    for (const task of tasks) {
      const invId = task.assigned_user_id;
      if (!invId) continue;
      const user = investigatorDetails[invId] || {};
      if (!investigatorMap[invId]) {
        investigatorMap[invId] = {
          investigatorId: invId,
          name: user.firstName ? `${user.firstName} ${user.lastName}` : user.username || 'Unknown',
          role: user.roles ? user.roles.join(', ') : 'Unknown',
          activeCases: 0,
          completedCases: 0,
          totalCases: 0,
          resolutionTimes: [],
          caseClosureCount: 0,
          monthlyCaseCounts: {},
          outcomeCounts: { CONFIRMED: 0, REFUTED: 0, INCONCLUSIVE: 0 },
        };
      }
      investigatorMap[invId].totalCases += 1;
  if (task.status === TaskStatus.STATUS_30_COMPLETED) {
        investigatorMap[invId].completedCases += 1;
        if (task.completed_at && task.created_at) {
          const resolutionTime = (new Date(task.completed_at).getTime() - new Date(task.created_at).getTime()) / (1000 * 60 * 60 * 24);
          investigatorMap[invId].resolutionTimes.push(resolutionTime);
        }
        investigatorMap[invId].caseClosureCount += 1;
      } else {
        investigatorMap[invId].activeCases += 1;
      }
      const created = task.created_at ? new Date(task.created_at) : null;
      if (created) {
        const monthKey = `${created.getFullYear()}-${String(created.getMonth() + 1).padStart(2, '0')}`;
        if (!investigatorMap[invId].monthlyCaseCounts[monthKey]) {
          investigatorMap[invId].monthlyCaseCounts[monthKey] = 0;
        }
        investigatorMap[invId].monthlyCaseCounts[monthKey] += 1;
      }
      const caseStatus = task.case?.status;
      if (caseStatus === CaseStatus.STATUS_82_CLOSED_CONFIRMED) {
        investigatorMap[invId].outcomeCounts.CONFIRMED += 1;
      } else if (caseStatus === CaseStatus.STATUS_81_CLOSED_REFUTED) {
        investigatorMap[invId].outcomeCounts.REFUTED += 1;
      } else if (caseStatus === CaseStatus.STATUS_83_CLOSED_INCONCLUSIVE) {
        investigatorMap[invId].outcomeCounts.INCONCLUSIVE += 1;
      }
    }

    const investigators = Object.values(investigatorMap);
    const totalInvestigators = investigators.length;
    const avgCasesPerInvestigator = totalInvestigators ? (tasks.length / totalInvestigators) : 0;
    const allResolutionTimes = investigators.flatMap((inv: any) => inv.resolutionTimes);
    const avgResolutionTime = allResolutionTimes.length
      ? (allResolutionTimes.reduce((a: number, b: number) => a + b, 0) / allResolutionTimes.length)
      : 0;
    const totalClosedCases = investigators.reduce((sum: number, inv: any) => sum + inv.caseClosureCount, 0);
    const caseClosureRate = tasks.length ? (totalClosedCases / tasks.length) * 100 : 0;
    const details = investigators.map((inv: any) => {
      // Determine performance trend based on monthlyCaseCounts (compare last month vs previous month)
      const months = Object.keys(inv.monthlyCaseCounts).sort();
      let performanceTrend = 'Stable';
      if (months.length >= 2) {
        const last = inv.monthlyCaseCounts[months[months.length - 1]] || 0;
        const prev = inv.monthlyCaseCounts[months[months.length - 2]] || 0;
        if (last > prev) performanceTrend = 'Improving';
        else if (last < prev) performanceTrend = 'Declining';
      }
      return {
        investigator: inv.name,
        role: inv.role,
        activeCases: inv.activeCases,
        completedCases: inv.completedCases,
        avgResolutionTime: inv.resolutionTimes.length
          ? (inv.resolutionTimes.reduce((a: number, b: number) => a + b, 0) / inv.resolutionTimes.length).toFixed(1)
          : 'N/A',
        caseClosureRate: inv.totalCases
          ? ((inv.caseClosureCount / inv.totalCases) * 100).toFixed(1) + '%'
          : '0%',
        performanceTrend,
      };
    });
    const allMonths = Array.from(new Set(
      investigators.flatMap((inv: any) => Object.keys(inv.monthlyCaseCounts))
    )).sort();
    const caseVolumeTrend = investigators.map((inv: any) => ({
      name: inv.name,
      data: allMonths.map(month => inv.monthlyCaseCounts[month] || 0),
    }));
    const caseOutcomeDistribution = investigators.map((inv: any) => ({
      name: inv.name,
      confirmed: inv.outcomeCounts.CONFIRMED,
      refuted: inv.outcomeCounts.REFUTED,
      inconclusive: inv.outcomeCounts.INCONCLUSIVE,
    }));
    const trends = {
      caseVolumeTrend: { months: allMonths, data: caseVolumeTrend },
      caseOutcomeDistribution,
    };
    const workloadByInvestigator = investigators.map((inv: any) => ({
      name: inv.name,
      activeCases: inv.activeCases,
      pendingTasks: inv.totalCases - inv.completedCases,
      performanceTrend: ((): string => {
        const months = Object.keys(inv.monthlyCaseCounts).sort();
        if (months.length < 2) return 'Stable';
        const last = inv.monthlyCaseCounts[months[months.length - 1]] || 0;
        const prev = inv.monthlyCaseCounts[months[months.length - 2]] || 0;
        if (last > prev) return 'Improving';
        if (last < prev) return 'Declining';
        return 'Stable';
      })(),
    }));
    return {
      metrics: {
        totalInvestigators,
        avgCasesPerInvestigator: Number(avgCasesPerInvestigator.toFixed(1)),
        avgResolutionTime: Number(avgResolutionTime.toFixed(1)),
        caseClosureRate: Number(caseClosureRate.toFixed(1)),
      },
      workloadByInvestigator,
      trends,
      details,
    };
  }

  async exportInvestigatorWorkloadReport(format: 'csv' | 'excel' | 'pdf', dateRange?: string): Promise<string | Buffer> {
    const data = await this.getInvestigatorWorkload(dateRange);
    if (!data.details || !data.details.length) return '';
    const headers = Object.keys(data.details[0]);
    if (format === 'csv') {
      return exportToCSV(data.details, headers);
    }
    if (format === 'excel') {
      return await exportToExcel(data.details, headers);
    }
    if (format === 'pdf') {
      return await exportToPDF(data.details, headers);
    }
    return '';
  }

  async exportCaseStatusReport(
    format: 'csv' | 'excel' | 'pdf',
    dateRange?: string,
    filters?: { caseType?: string; priority?: string; investigator?: string }
  ): Promise<string | Buffer> {
    const data = await this.getCaseStatus(dateRange, filters);
    // Flatten stats and statusDistribution for export
    const exportData = [
      { ...data.stats, ...data.statusDistribution }
    ];
    const headers = Object.keys(exportData[0] || {});
    if (!exportData.length) return '';
    if (format === 'csv') {
      return exportToCSV(exportData, headers);
    }
    if (format === 'excel') {
      return await exportToExcel(exportData, headers);
    }
    if (format === 'pdf') {
      return await exportToPDF(exportData, headers);
    }
    return '';
  }

  async exportTaskCompletionReport(
    format: 'csv' | 'excel' | 'pdf',
    dateRange?: string
  ): Promise<string | Buffer> {
    const data = await this.getTaskCompletion(dateRange);
    // Flatten stats for export
    const exportData = [
      { ...data.stats }
    ];
    const headers = Object.keys(exportData[0] || {});
    if (!exportData.length) return '';
    if (format === 'csv') {
      return exportToCSV(exportData, headers);
    }
    if (format === 'excel') {
      return await exportToExcel(exportData, headers);
    }
    if (format === 'pdf') {
      return await exportToPDF(exportData, headers);
    }
    return '';
  }

  async exportAuditLogsReport(
    format: 'csv' | 'excel' | 'pdf',
    dateRange?: string
  ): Promise<string | Buffer> {
    const data = await this.getAuditLogs(dateRange);
    // Export auditLogs array
    const exportData = data.auditLogs || [];
    if (!exportData.length) return '';
    const headers = Object.keys(exportData[0] || {});
    if (format === 'csv') {
      return exportToCSV(exportData, headers);
    }
    if (format === 'excel') {
      return await exportToExcel(exportData, headers);
    }
    if (format === 'pdf') {
      return await exportToPDF(exportData, headers);
    }
    return '';
  }

  async exportCaseAgeingReport(
    format: 'csv' | 'excel' | 'pdf',
    dateRange?: string
  ): Promise<string | Buffer> {
    const data = await this.getCaseAgeing(dateRange);
    // Flatten stats for export
    const exportData = [
      { ...data.stats }
    ];
    const headers = Object.keys(exportData[0] || {});
    if (!exportData.length) return '';
    if (format === 'csv') {
      return exportToCSV(exportData, headers);
    }
    if (format === 'excel') {
      return await exportToExcel(exportData, headers);
    }
    if (format === 'pdf') {
      return await exportToPDF(exportData, headers);
    }
    return '';
  }

  async getTaskCompletion(dateRange?: string) {
    try {
      const { startDate, endDate } = this.getDateRange(dateRange);

      try {
        const sampleTask = await this.prisma.task.findFirst();
      } catch (error) {
        console.error('Error accessing task table:', error.message);
        throw new Error('Task table not accessible. Please check database schema.');
      }

      const taskCounts = await this.prisma.task.groupBy({
        by: ['status'],
        where: {
          created_at: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: { task_id: true },
      });

      const taskTypeCounts = await this.prisma.task.groupBy({
        by: ['task_type'],
        where: {
          created_at: {
            gte: startDate,
            lte: endDate,
          },
        },
        _count: { task_id: true },
      });
      console.log('Task counts by type:', taskTypeCounts);

      const totalTasks = await this.prisma.task.count({
        where: {
          created_at: {
            gte: startDate,
            lte: endDate,
          },
        },
      });
      console.log('Total tasks:', totalTasks);

      const completedTasks = await this.prisma.task.count({
        where: {
          created_at: {
            gte: startDate,
            lte: endDate,
          },
          status: TaskStatus.STATUS_30_COMPLETED,
        },
      });
      console.log('Completed tasks:', completedTasks);

      const completionRate = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      const completedTasksWithTimes = await this.prisma.task.findMany({
        where: {
          created_at: {
            gte: startDate,
            lte: endDate,
          },
          status: TaskStatus.STATUS_30_COMPLETED,
          completed_at: { not: null },
        },
        select: {
          created_at: true,
          completed_at: true,
        },
      });

      const avgCompletionTime = completedTasksWithTimes.length > 0
        ? completedTasksWithTimes.reduce((sum, task) => {
            if (!task.completed_at) return sum;
            const completionTime = (task.completed_at.getTime() - task.created_at.getTime()) / (1000 * 60 * 60 * 24);
            return sum + completionTime;
          }, 0) / completedTasksWithTimes.length
        : 0;

      const completionByType = await Promise.all(taskTypeCounts.map(async ({ task_type, _count }) => {
        try {
          const completedTasks = await this.prisma.task.count({
            where: {
              created_at: {
                gte: startDate,
                lte: endDate,
              },
              status: TaskStatus.STATUS_30_COMPLETED,
              task_type: task_type,
            },
          });
          
          return {
            type: task_type || 'UNKNOWN',
            total: _count.task_id,
            completed: completedTasks,
            pending: _count.task_id - completedTasks,
          };
        } catch (error) {
          console.error('Error processing task type:', task_type, error);
          return {
            type: task_type || 'UNKNOWN',
            total: _count.task_id,
            completed: 0,
            pending: _count.task_id,
          };
        }
      }));

      const statusDistribution = taskCounts.map(({ status, _count }) => ({
        status: this.formatTaskStatusName(status),
        count: _count.task_id,
        percentage: totalTasks > 0 ? Math.round((_count.task_id / totalTasks) * 100) : 0,
        color: this.getTaskStatusColor(status),
      }));

      const result = {
        stats: {
          totalTasks,
          completionRate: Math.round(completionRate * 10) / 10,
          avgCompletionTime: Math.round(avgCompletionTime * 10) / 10,
          overdueTasks: 0,
        },
        completionByType,
        avgCompletionTime: completionByType.map(ct => ({
          type: ct.type,
          avgDays: 0, 
        })),
        completionTrend: [], 
        statusDistribution,
        taskDetails: completionByType.map(ct => ({
          taskType: ct.type,
          total: ct.total,
          completed: ct.completed,
          completionRate: ct.total > 0 ? Math.round((ct.completed / ct.total) * 100 * 10) / 10 : 0,
          avgTime: 0, 
          trend: 0, 
        })),
      };

      console.log('Task completion result generated successfully');
      return result;
    } catch (error) {
      console.error(' Error in getTaskCompletion:', error);
      console.error(' Error stack:', error.stack);
      throw new Error(`Failed to get task completion data: ${error.message}`);
    }
  }

  async getAuditLogs(dateRange?: string) {
    const { startDate, endDate } = this.getDateRange(dateRange);

    const auditLogs = await this.auditLogService.getLogs(100, 0);

    
    const filteredLogs = auditLogs.filter(log => 
      log.performed_at >= startDate && log.performed_at <= endDate
    );

  
    const caseActions = filteredLogs.filter(log => 
      log.entity_name === 'Case' || (log.action_performed && log.action_performed.includes('Case'))
    ).length;

    const userSessions = filteredLogs.filter(log => 
      log.action_performed && (log.action_performed.includes('login') || log.action_performed.includes('session'))
    ).length;

    const systemWarnings = filteredLogs.filter(log => 
      log.outcome && (log.outcome.includes('WARNING') || log.outcome.includes('ERROR'))
    ).length;

    const formattedLogs = filteredLogs.map(log => {
    
      return {
        audit_log_id: log.audit_log_id ? log.audit_log_id.toString() : '',
        user_id: log.user_id ? log.user_id.toString() : '',
        operation: log.operation ? log.operation.toString() : '',
        entity_name: log.entity_name ? log.entity_name.toString() : '',
        action_performed: log.action_performed ? log.action_performed.toString() : '',
        outcome: log.outcome ? log.outcome.toString() : '',
        performed_at: log.performed_at ? log.performed_at.toLocaleString('en-US', {
          month: '2-digit',
          day: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true,
        }) : '',
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
      where: {
        created_at: {
          gte: startDate,
          lte: endDate,
        },
      },
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
    const casesWithAge = cases.map(case_ => {
      const ageDays = Math.floor((now.getTime() - case_.created_at.getTime()) / (1000 * 60 * 60 * 24));
      return { ...case_, ageDays };
    });

    const avgCaseAge = casesWithAge.length > 0
      ? casesWithAge.reduce((sum, case_) => sum + case_.ageDays, 0) / casesWithAge.length
      : 0;

    const casesOver15Days = casesWithAge.filter(c => c.ageDays > 15).length;
    const casesOver30Days = casesWithAge.filter(c => c.ageDays > 30).length;

   
    const ageingByStatus: any[] = [];
    const statusGroups = casesWithAge.reduce((acc, case_) => {
      if (!acc[case_.status]) acc[case_.status] = [];
      acc[case_.status].push(case_);
      return acc;
    }, {} as Record<string, typeof casesWithAge>);

    Object.entries(statusGroups).forEach(([status, cases]) => {
      ageingByStatus.push({
        status: this.formatStatusName(status as CaseStatus),
        age0to7: cases.filter(c => c.ageDays <= 7).length,
        age8to15: cases.filter(c => c.ageDays > 7 && c.ageDays <= 15).length,
        age16to30: cases.filter(c => c.ageDays > 15 && c.ageDays <= 30).length,
        age30Plus: cases.filter(c => c.ageDays > 30).length,
      });
    });


    const ageingDistribution = [
      { ageRange: '0-7 days', count: casesWithAge.filter(c => c.ageDays <= 7).length, percentage: 0, color: '#10b981' },
      { ageRange: '8-15 days', count: casesWithAge.filter(c => c.ageDays > 7 && c.ageDays <= 15).length, percentage: 0, color: '#f59e0b' },
      { ageRange: '16-30 days', count: casesWithAge.filter(c => c.ageDays > 15 && c.ageDays <= 30).length, percentage: 0, color: '#ef4444' },
      { ageRange: '30+ days', count: casesWithAge.filter(c => c.ageDays > 30).length, percentage: 0, color: '#7c2d12' },
    ];

  
    const total = ageingDistribution.reduce((sum, item) => sum + item.count, 0);
    ageingDistribution.forEach(item => {
      item.percentage = total > 0 ? Math.round((item.count / total) * 100) : 0;
    });

    const caseTypeResolution = Object.values(CaseType).map(type => ({
      caseType: type,
      avgDays: 0, 
    }));

   
    const caseDetails = casesWithAge.slice(0, 5).map(case_ => ({
      caseId: case_.case_id.slice(0, 8),
      type: case_.case_type || 'NONE',
      status: this.formatStatusName(case_.status),
      createdDate: case_.created_at.toLocaleDateString('en-US'),
      ageDays: case_.ageDays,
      priority: case_.priority,
      investigator: case_.case_owner_user_id ? `User ${case_.case_owner_user_id.slice(0, 8)}` : 'Unassigned',
    }));

    return {
      stats: {
        avgCaseAge: Math.round(avgCaseAge * 10) / 10,
        avgResolutionTime: 0, 
        casesOver15Days,
        casesOver30Days,
      },
      ageingByStatus,
      resolutionTrend: [], 
      ageingDistribution,
      caseTypeResolution,
      caseDetails,
    };
  }

  private getCaseTypeColor(caseType: CaseType | null): string {
    switch (caseType) {
      case CaseType.FRAUD: return '#ef4444';
      case CaseType.AML: return '#8b5cf6';
      case CaseType.FRAUD_AND_AML: return '#f59e0b';
      default: return '#3b82f6';
    }
  }

  private getTaskStatusColor(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.STATUS_30_COMPLETED: return '#10b981';
      case TaskStatus.STATUS_20_IN_PROGRESS: return '#3b82f6';
      case TaskStatus.STATUS_01_UNASSIGNED: return '#6b7280';
      case TaskStatus.STATUS_21_BLOCKED: return '#f59e0b';
      case TaskStatus.STATUS_10_ASSIGNED: return '#8b5cf6';
      default: return '#6b7280';
    }
  }

  private formatStatusName(status: CaseStatus): string {
    return status.replace('STATUS_', '').replace(/_/g, ' ');
  }

  private formatTaskStatusName(status: TaskStatus): string {
    switch (status) {
      case TaskStatus.STATUS_30_COMPLETED: return 'Completed';
      case TaskStatus.STATUS_20_IN_PROGRESS: return 'In Progress';
      case TaskStatus.STATUS_01_UNASSIGNED: return 'Unassigned';
      case TaskStatus.STATUS_21_BLOCKED: return 'Blocked';
      case TaskStatus.STATUS_10_ASSIGNED: return 'Assigned';
      default: return 'Unknown';
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
      caseTypes: caseTypes.map(ct => ({
        value: ct.case_type || 'NONE',
        label: ct.case_type || 'None'
      })),
      priorities: priorities.map(p => ({
        value: p.priority || 'NONE',
        label: p.priority || 'None'
      })),
      investigators: investigators.map(i => ({
        value: i.case_owner_user_id || '',
        label: i.case_owner_user_id ? `User ${i.case_owner_user_id.slice(0, 8)}` : 'Unassigned'
      }))
    };
  }
}
